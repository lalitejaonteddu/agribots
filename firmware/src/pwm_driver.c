#include "pwm_driver.h"

#ifdef USE_HAL_DRIVER
#include "stm32f4xx_hal.h"

static TIM_HandleTypeDef htim3; // Zone A: PB4 (TIM3_CH1)
static TIM_HandleTypeDef htim1; // Zone B: PA8 (TIM1_CH1)
static bool tim3_initialized = false;
static bool tim1_initialized = false;

static uint32_t get_apb1_timer_clock(void) {
    uint32_t pclk1 = HAL_RCC_GetPCLK1Freq();
    RCC_ClkInitTypeDef clk_init;
    uint32_t flash_latency;
    HAL_RCC_GetClockConfig(&clk_init, &flash_latency);
    // If APB1 prescaler != 1, timer clock = 2 * PCLK1
    if (clk_init.APB1CLKDivider != RCC_HCLK_DIV1) {
        return pclk1 * 2;
    }
    return pclk1;
}

static uint32_t get_apb2_timer_clock(void) {
    uint32_t pclk2 = HAL_RCC_GetPCLK2Freq();
    RCC_ClkInitTypeDef clk_init;
    uint32_t flash_latency;
    HAL_RCC_GetClockConfig(&clk_init, &flash_latency);
    // If APB2 prescaler != 1, timer clock = 2 * PCLK2
    if (clk_init.APB2CLKDivider != RCC_HCLK_DIV1) {
        return pclk2 * 2;
    }
    return pclk2;
}
#endif

void pwm_driver_calc_params(uint32_t tim_clk, uint32_t target_hz,
                           uint32_t *out_psc, uint32_t *out_arr,
                           uint32_t *out_ccr, uint32_t *out_actual_hz) {
    if (target_hz < 1000) target_hz = 1000;
    if (target_hz > 50000) target_hz = 50000;

    // For f in [1000, 50000] and tim_clk = 100MHz, PSC = 0 gives ARR in [1999, 99999]
    // Max 16-bit timer ARR is 65535.
    uint32_t psc = 0;
    uint32_t period_ticks = tim_clk / target_hz;
    if (period_ticks > 65535) {
        psc = period_ticks / 65535;
        period_ticks = tim_clk / ((psc + 1) * target_hz);
    }
    uint32_t arr = period_ticks > 0 ? period_ticks - 1 : 0;
    uint32_t ccr = (arr + 1) / 2; // 50% duty cycle
    uint32_t actual = tim_clk / ((psc + 1) * (arr + 1));

    if (out_psc) *out_psc = psc;
    if (out_arr) *out_arr = arr;
    if (out_ccr) *out_ccr = ccr;
    if (out_actual_hz) *out_actual_hz = actual;
}

#ifdef USE_HAL_DRIVER
void pwm_driver_init(void) {
    // Enable GPIO Clocks
    __HAL_RCC_GPIOB_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_TIM3_CLK_ENABLE();
    __HAL_RCC_TIM1_CLK_ENABLE();

    // 1. Zone A: PB4 -> TIM3_CH1 (AF2)
    GPIO_InitTypeDef gpio_b;
    gpio_b.Pin = GPIO_PIN_4;
    gpio_b.Mode = GPIO_MODE_AF_PP;
    gpio_b.Pull = GPIO_PULLDOWN; // Safe pull-down at boot
    gpio_b.Speed = GPIO_SPEED_FREQ_HIGH;
    gpio_b.Alternate = GPIO_AF2_TIM3;
    HAL_GPIO_Init(GPIOB, &gpio_b);

    // 2. Zone B: PA8 -> TIM1_CH1 (AF1)
    GPIO_InitTypeDef gpio_a;
    gpio_a.Pin = GPIO_PIN_8;
    gpio_a.Mode = GPIO_MODE_AF_PP;
    gpio_a.Pull = GPIO_PULLDOWN; // Safe pull-down at boot
    gpio_a.Speed = GPIO_SPEED_FREQ_HIGH;
    gpio_a.Alternate = GPIO_AF1_TIM1;
    HAL_GPIO_Init(GPIOA, &gpio_a);

    pwm_driver_all_off();
}

uint32_t pwm_driver_set_zone(char zone, bool enable, uint32_t freq_hz) {
    uint32_t psc = 0, arr = 0, ccr = 0, actual_hz = 0;

    if (zone == 'A') {
        uint32_t clk = get_apb1_timer_clock();
        pwm_driver_calc_params(clk, freq_hz, &psc, &arr, &ccr, &actual_hz);

        if (!enable) {
            HAL_TIM_PWM_Stop(&htim3, TIM_CHANNEL_1);
            return actual_hz;
        }

        htim3.Instance = TIM3;
        htim3.Init.Prescaler = psc;
        htim3.Init.CounterMode = TIM_COUNTERMODE_UP;
        htim3.Init.Period = arr;
        htim3.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
        HAL_TIM_PWM_Init(&htim3);

        TIM_OC_InitTypeDef sConfigOC;
        sConfigOC.OCMode = TIM_OCMODE_PWM1;
        sConfigOC.Pulse = ccr;
        sConfigOC.OCPolarity = TIM_OCPOLARITY_HIGH;
        sConfigOC.OCFastMode = TIM_OCFAST_DISABLE;
        HAL_TIM_PWM_ConfigChannel(&htim3, &sConfigOC, TIM_CHANNEL_1);

        HAL_TIM_PWM_Start(&htim3, TIM_CHANNEL_1);
        tim3_initialized = true;
        return actual_hz;
    } else if (zone == 'B') {
        uint32_t clk = get_apb2_timer_clock();
        pwm_driver_calc_params(clk, freq_hz, &psc, &arr, &ccr, &actual_hz);

        if (!enable) {
            HAL_TIM_PWM_Stop(&htim1, TIM_CHANNEL_1);
            return actual_hz;
        }

        htim1.Instance = TIM1;
        htim1.Init.Prescaler = psc;
        htim1.Init.CounterMode = TIM_COUNTERMODE_UP;
        htim1.Init.Period = arr;
        htim1.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
        htim1.Init.RepetitionCounter = 0;
        HAL_TIM_PWM_Init(&htim1);

        TIM_OC_InitTypeDef sConfigOC;
        sConfigOC.OCMode = TIM_OCMODE_PWM1;
        sConfigOC.Pulse = ccr;
        sConfigOC.OCPolarity = TIM_OCPOLARITY_HIGH;
        sConfigOC.OCNPolarity = TIM_OCNPOLARITY_HIGH;
        sConfigOC.OCFastMode = TIM_OCFAST_DISABLE;
        sConfigOC.OCIdleState = TIM_OCIDLESTATE_RESET;
        sConfigOC.OCNIdleState = TIM_OCNIDLESTATE_RESET;
        HAL_TIM_PWM_ConfigChannel(&htim1, &sConfigOC, TIM_CHANNEL_1);

        HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_1);
        tim1_initialized = true;
        return actual_hz;
    }
    return 0;
}

void pwm_driver_all_off(void) {
    if (tim3_initialized) HAL_TIM_PWM_Stop(&htim3, TIM_CHANNEL_1);
    if (tim1_initialized) HAL_TIM_PWM_Stop(&htim1, TIM_CHANNEL_1);
}

#else
// Stub implementations for native unit testing
void pwm_driver_init(void) {}
uint32_t pwm_driver_set_zone(char zone, bool enable, uint32_t freq_hz) {
    uint32_t psc, arr, ccr, actual;
    pwm_driver_calc_params(100000000, freq_hz, &psc, &arr, &ccr, &actual);
    return actual;
}
void pwm_driver_all_off(void) {}
#endif
