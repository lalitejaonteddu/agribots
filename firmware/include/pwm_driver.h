#ifndef PWM_DRIVER_H
#define PWM_DRIVER_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Initializes TIM3_CH1 (PB4, Zone A) and TIM1_CH1 (PA8, Zone B) GPIO and base registers.
 * Both outputs are initialized in OFF state (GPIO LOW).
 */
void pwm_driver_init(void);

/**
 * Calculates PSC, ARR, CCR, and actual frequency for a given target frequency.
 * @param tim_clk Real timer input clock in Hz.
 * @param target_hz Requested frequency in Hz (1000 to 50000 Hz).
 * @param out_psc Pointer to output Prescaler value.
 * @param out_arr Pointer to output Auto-Reload Register value.
 * @param out_ccr Pointer to output Capture/Compare Register value (50% duty).
 * @param out_actual_hz Pointer to output achieved frequency.
 */
void pwm_driver_calc_params(uint32_t tim_clk, uint32_t target_hz,
                           uint32_t *out_psc, uint32_t *out_arr,
                           uint32_t *out_ccr, uint32_t *out_actual_hz);

/**
 * Enables or disables PWM output for a specific zone at a target frequency.
 * @param zone 'A' (PB4/TIM3) or 'B' (PA8/TIM1).
 * @param enable true to start PWM, false to stop.
 * @param freq_hz Desired frequency in Hz.
 * @return actual achieved frequency in Hz.
 */
uint32_t pwm_driver_set_zone(char zone, bool enable, uint32_t freq_hz);

/**
 * Immediately shuts off all PWM outputs.
 */
void pwm_driver_all_off(void);

#ifdef __cplusplus
}
#endif

#endif // PWM_DRIVER_H
