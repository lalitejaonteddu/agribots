# Crop-Sim ASCII Serial Protocol Specification

## 1. Communication Parameters

- **Baud Rate**: 115200 baud
- **Framing**: 8 Data Bits, No Parity, 1 Stop Bit (8N1)
- **Termination**: Line-based ASCII ending with `\n` (LF) or `\r\n` (CRLF)
- **Maximum Line Length**: 64 characters (longer inputs rejected with `ERR Line exceeds 64 chars`)
- **Case Sensitivity**: Commands and parameters are case-insensitive.

---

## 2. Command Set (Host PC → STM32)

### `PING`
Refreshes the 2000 ms hardware failsafe watchdog.
- **Example**: `PING\n`
- **Reply**: `OK PING\n`

### `SET <A|B> <on|off> <freqHz>`
Configures and switches PWM emission for a specific transducer zone.
- Frequency must be between $1000\text{ Hz}$ and $50000\text{ Hz}$.
- **Examples**:
  - `SET A on 40000\n` $\rightarrow$ `OK SET A on 40000\n`
  - `SET B off 3000\n` $\rightarrow$ `OK SET B off 3000\n`

### `ALLOFF`
Immediately stops PWM generation across both zones and puts drivers into standby.
- **Example**: `ALLOFF\n`
- **Reply**: `OK ALLOFF\n`

### `STATUS`
Queries the instantaneous hardware operational state.
- **Example**: `STATUS\n`
- **Reply**:
  `STATUS A=<0|1>,<actualHz> B=<0|1>,<actualHz> uptime=<ms> failsafe=<0|1>\n`
- **Field Details**:
  - `A=<0|1>,<actualHz>`: 1 if Zone A PWM active, followed by real achieved frequency.
  - `B=<0|1>,<actualHz>`: 1 if Zone B PWM active, followed by real achieved frequency.
  - `uptime=<ms>`: Microcontroller millisecond uptime counter (`HAL_GetTick`).
  - `failsafe=<0|1>`: 1 if 2000 ms communication silence triggered safety shutoff.

---

## 3. Error Responses (STM32 → Host PC)

When an invalid or dangerous command is received, the STM32 replies with:
`ERR <reason>\n`

Examples:
- `ERR Line exceeds 64 chars\n`
- `ERR Frequency out of range [1000..50000]\n`
- `ERR Zone must be A or B\n`
- `ERR State must be ON or OFF\n`
- `ERR Unknown command\n`
