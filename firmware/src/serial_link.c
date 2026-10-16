#include "serial_link.h"
#include <string.h>

#ifdef USE_HAL_DRIVER
#include "stm32f4xx_hal.h"

static UART_HandleTypeDef huart2;
static uint8_t rx_byte;
static volatile uint8_t ring_buffer[RX_RING_BUFFER_SIZE];
static volatile uint16_t ring_head = 0;
static volatile uint16_t ring_tail = 0;

void serial_link_init(uint32_t baudrate) {
    __HAL_RCC_USART2_CLK_ENABLE();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    // PA2 -> USART2_TX, PA3 -> USART2_RX
    GPIO_InitTypeDef gpio;
    gpio.Pin = GPIO_PIN_2 | GPIO_PIN_3;
    gpio.Mode = GPIO_MODE_AF_PP;
    gpio.Pull = GPIO_PULLUP;
    gpio.Speed = GPIO_SPEED_FREQ_HIGH;
    gpio.Alternate = GPIO_AF7_USART2;
    HAL_GPIO_Init(GPIOA, &gpio);

    huart2.Instance = USART2;
    huart2.Init.BaudRate = baudrate;
    huart2.Init.WordLength = UART_WORDLENGTH_8B;
    huart2.Init.StopBits = UART_STOPBITS_1;
    huart2.Init.Parity = UART_PARITY_NONE;
    huart2.Init.Mode = UART_MODE_TX_RX;
    huart2.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    huart2.Init.OverSampling = UART_OVERSAMPLING_16;
    HAL_UART_Init(&huart2);

    HAL_NVIC_SetPriority(USART2_IRQn, 1, 0);
    HAL_NVIC_EnableIRQ(USART2_IRQn);

    // Start listening for single byte interrupts
    HAL_UART_Receive_IT(&huart2, &rx_byte, 1);
}

void USART2_IRQHandler(void) {
    HAL_UART_IRQHandler(&huart2);
}

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    if (huart->Instance == USART2) {
        uint16_t next_head = (ring_head + 1) % RX_RING_BUFFER_SIZE;
        if (next_head != ring_tail) {
            ring_buffer[ring_head] = rx_byte;
            ring_head = next_head;
        }
        HAL_UART_Receive_IT(&huart2, &rx_byte, 1);
    }
}

bool serial_link_get_line(char *out_line, size_t max_len) {
    if (!out_line || max_len == 0) return false;

    // Search for newline in buffer without blocking
    uint16_t current = ring_tail;
    bool found_nl = false;
    uint16_t count = 0;

    while (current != ring_head) {
        count++;
        if (ring_buffer[current] == '\n' || ring_buffer[current] == '\r') {
            found_nl = true;
            break;
        }
        current = (current + 1) % RX_RING_BUFFER_SIZE;
    }

    if (!found_nl && count <= MAX_LINE_LEN) {
        return false; // Incomplete line, keep receiving
    }

    // Extract line
    size_t out_idx = 0;
    while (ring_tail != ring_head) {
        uint8_t ch = ring_buffer[ring_tail];
        ring_tail = (ring_tail + 1) % RX_RING_BUFFER_SIZE;

        if (ch == '\n' || ch == '\r') {
            if (out_idx > 0) break; // Finished line
            continue; // Skip leading empty CR/LF
        }

        if (out_idx < max_len - 1) {
            out_line[out_idx++] = (char)ch;
        }
    }
    out_line[out_idx] = '\0';
    return (out_idx > 0);
}

void serial_link_write(const char *data, size_t len) {
    if (!data || len == 0) return;
    HAL_UART_Transmit(&huart2, (uint8_t *)data, (uint16_t)len, 50);
}

void serial_link_write_str(const char *str) {
    if (str) {
        serial_link_write(str, strlen(str));
    }
}

#else
// Stub for native simulation
bool serial_link_get_line(char *out_line, size_t max_len) { (void)out_line; (void)max_len; return false; }
void serial_link_write(const char *data, size_t len) { (void)data; (void)len; }
void serial_link_write_str(const char *str) { (void)str; }
void serial_link_init(uint32_t baudrate) { (void)baudrate; }
#endif
