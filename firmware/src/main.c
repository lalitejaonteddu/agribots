/**
 * Crop-Sim Agricultural Insect Deterrence STM32 Firmware (Part 4).
 * Platform: ST Nucleo-F411RE (STM32Cube HAL)
 * 
 * Safety Features:
 * - 2000 ms watchdog: shut down both zones if host communication stops.
 * - 120 s continuous on-time limiter per zone.
 * - Hardware pull-downs and all outputs off at boot.
 * - IWDG independent watchdog (~1s period).
 * - Multi-state status LED (Off = idle, Solid = on, 10 Hz blink = failsafe).
 */

#ifdef USE_HAL_DRIVER
#include "stm32f4xx_hal.h"
#include "protocol.h"
#include "pwm_driver.h"
#include "serial_link.h"
#include <string.h>

#define FAILSAFE_TIMEOUT_MS 2000
#define MAX_ZONE_ON_TIME_MS 120000

static IWDG_HandleTypeDef hiwdg;
static SystemStatus g_status;
static uint32_t last_valid_cmd_time = 0;
static uint32_t zone_a_start_time = 0;
static uint32_t zone_b_start_time = 0;
static uint32_t last_led_toggle_time = 0;

static void SystemClock_Config(void) {
    RCC_OscInitTypeDef osc;
    RCC_ClkInitTypeDef clk;

    __HAL_RCC_PWR_CLK_ENABLE();
    __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);

    // HSI 16 MHz -> PLL -> 100 MHz SYSCLK
    osc.OscillatorType = RCC_OSCILLATORTYPE_HSI;
    osc.HSIState = RCC_HSI_ON;
    osc.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
    osc.PLL.PLLState = RCC_PLL_ON;
    osc.PLL.PLLSource = RCC_PLLSOURCE_HSI;
    osc.PLL.PLLM = 16;
    osc.PLL.PLLN = 400;
    osc.PLL.PLLP = RCC_PLLP_DIV4; // 16 * (400/16) / 4 = 100 MHz
    osc.PLL.PLLQ = 7;
    HAL_RCC_OscConfig(&osc);

    clk.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    clk.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    clk.AHBCLKDivider = RCC_SYSCLK_DIV1;  // HCLK = 100 MHz
    clk.APB1CLKDivider = RCC_HCLK_DIV2;   // PCLK1 = 50 MHz (Timer clock = 100 MHz)
    clk.APB2CLKDivider = RCC_HCLK_DIV1;   // PCLK2 = 100 MHz (Timer clock = 100 MHz)
    HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_3);
}

static void IWDG_Init(void) {
    hiwdg.Instance = IWDG;
    hiwdg.Init.Prescaler = IWDG_PRESCALER_64; // ~32 kHz LSI / 64 = 500 Hz
    hiwdg.Init.Reload = 500;                 // 500 ticks = ~1.0 second timeout
    HAL_IWDG_Init(&hiwdg);
}

static void LED_Init(void) {
    __HAL_RCC_GPIOA_CLK_ENABLE();
    GPIO_InitTypeDef gpio;
    gpio.Pin = GPIO_PIN_5;
    gpio.Mode = GPIO_MODE_OUTPUT_PP;
    gpio.Pull = GPIO_NOPULL;
    gpio.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOA, &gpio);
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
}

static void update_led_state(uint32_t now) {
    if (g_status.failsafe) {
        // Fast blink (10 Hz = 50 ms toggle)
        if (now - last_led_toggle_time >= 50) {
            last_led_toggle_time = now;
            HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
        }
    } else if (g_status.zone_a_on || g_status.zone_b_on) {
        // Solid ON when emitting ultrasound
        HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);
    } else {
        // OFF when idle
        HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
    }
}

int main(void) {
    HAL_Init();
    SystemClock_Config();
    LED_Init();
    serial_link_init(115200);
    pwm_driver_init();
    IWDG_Init();

    memset(&g_status, 0, sizeof(g_status));
    g_status.zone_a_actual_hz = 40000;
    g_status.zone_b_actual_hz = 40000;
    last_valid_cmd_time = HAL_GetTick();

    char line_buf[MAX_LINE_LEN + 1];
    char reply_buf[128];

    while (1) {
        uint32_t now = HAL_GetTick();
        HAL_IWDG_Refresh(&hiwdg);
        g_status.uptime_ms = now;

        // 1. Process Inbound Serial Line Commands
        if (serial_link_get_line(line_buf, sizeof(line_buf))) {
            ParsedCommand cmd;
            bool valid = protocol_parse_line(line_buf, &cmd);

            if (valid && cmd.type != CMD_TYPE_NONE) {
                // Refresh failsafe timer on valid command
                last_valid_cmd_time = now;
                g_status.failsafe = false;

                switch (cmd.type) {
                    case CMD_TYPE_PING:
                        break;

                    case CMD_TYPE_ALLOFF:
                        pwm_driver_all_off();
                        g_status.zone_a_on = false;
                        g_status.zone_b_on = false;
                        break;

                    case CMD_TYPE_SET:
                        if (cmd.zone == 'A') {
                            g_status.zone_a_actual_hz = pwm_driver_set_zone('A', cmd.enable, cmd.freq_hz);
                            g_status.zone_a_on = cmd.enable;
                            if (cmd.enable) zone_a_start_time = now;
                        } else if (cmd.zone == 'B') {
                            g_status.zone_b_actual_hz = pwm_driver_set_zone('B', cmd.enable, cmd.freq_hz);
                            g_status.zone_b_on = cmd.enable;
                            if (cmd.enable) zone_b_start_time = now;
                        }
                        break;

                    case CMD_TYPE_STATUS:
                        break;

                    default:
                        break;
                }
            }

            // Transmit formatted reply
            size_t reply_len = protocol_format_reply(&cmd, &g_status, reply_buf, sizeof(reply_buf));
            if (reply_len > 0) {
                serial_link_write(reply_buf, reply_len);
            }
        }

        // 2. Safety Watchdogs
        // Failsafe: No valid command within 2000 ms -> force outputs OFF
        if (!g_status.failsafe && (now - last_valid_cmd_time > FAILSAFE_TIMEOUT_MS)) {
            g_status.failsafe = true;
            pwm_driver_all_off();
            g_status.zone_a_on = false;
            g_status.zone_b_on = false;
        }

        // 120s Continuous Safety Shutoff per zone
        if (g_status.zone_a_on && (now - zone_a_start_time > MAX_ZONE_ON_TIME_MS)) {
            pwm_driver_set_zone('A', false, g_status.zone_a_actual_hz);
            g_status.zone_a_on = false;
        }
        if (g_status.zone_b_on && (now - zone_b_start_time > MAX_ZONE_ON_TIME_MS)) {
            pwm_driver_set_zone('B', false, g_status.zone_b_actual_hz);
            g_status.zone_b_on = false;
        }

        // 3. Status LED Management
        update_led_state(now);
    }
}

// SysTick Handler
void SysTick_Handler(void) {
    HAL_IncTick();
}

#else
int main(void) { return 0; }
#endif
