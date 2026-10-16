# Electrical Wiring & Hardware Interfacing Guide

## 1. Safety Rules (Read Before Powering On)

> [!CAUTION]
> **HIGH VOLTAGE WARNING (12 V)**:
> 1. **NEVER** apply 12 V to any pin of the STM32 board. The STM32 operates at 3.3 V.
> 2. The 12 V power rail must go **EXCLUSIVELY to pin 6 ($V_{DD}$) of the TC4427 MOSFET driver**.
> 3. The STM32 outputs (`PB4` and `PA8`) deliver 3.3 V logic levels to the TC4427 inputs (`INA` and `INB`). The TC4427 has a logic-high threshold $V_{IH} = 2.4\text{ V}$, so 3.3 V reliably drives it.
> 4. Ensure a **common ground** connects the 12 V power supply ground and the STM32 ground.

---

## 2. STM32 Nucleo-F411RE Pin Connections

| STM32 Signal | Physical Pin | Header Location | Connects To | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Zone A PWM** | **`PB4`** | CN7 Pin 27 (Arduino D5) | TC4427 Pin 2 (`INA`) | 5V-Tolerant (`FT`), `TIM3_CH1` |
| **Zone B PWM** | **`PA8`** | CN10 Pin 23 (Arduino D7) | TC4427 Pin 4 (`INB`) | 5V-Tolerant (`FT`), `TIM1_CH1` |
| **GND** | **`GND`** | CN7 Pin 20 / CN10 Pin 9 | TC4427 Pin 3 (`GND`) & 12V Supply Return | Common reference |
| **ST-Link USB** | Micro-USB | Top of Nucleo | Host PC USB Port | 115200 baud Virtual COM Port |

---

## 3. TC4427 Dual High-Speed MOSFET Driver Pinout

```
           +---+-+---+
        NC | 1     8 | NC
   INA <---| 2     7 |---> OUTA (Zone A Transducers)
   GND <---| 3     6 |<--- VDD (+12 V Supply)
   INB <---| 4     5 |---> OUTB (Zone B Transducers)
           +---------+
```

### Component Values & Decoupling:
- **Pull-Down Resistors**:
  - Connect a **$10\text{ k}\Omega$ resistor between `INA` (Pin 2) and `GND` (Pin 3)**.
  - Connect a **$10\text{ k}\Omega$ resistor between `INB` (Pin 4) and `GND` (Pin 3)**.
  - *Purpose*: Guarantees transducers remain strictly OFF while the microcontroller boots or during firmware flashing.
- **Power Decoupling**:
  - Place a **$0.1\ \mu\text{F}$ ceramic capacitor** directly across Pin 6 ($V_{DD}$) and Pin 3 ($GND$) with minimal lead length.
  - Place a **$10\ \mu\text{F}$ electrolytic capacitor** in parallel across Pin 6 and Pin 3 to absorb high inductive switching transients.
- **Transducer Output Resistors**:
  - Place a **$100\ \Omega$, $1\text{ W}$ resistor in series** with each transducer branch to dampen piezo acoustic ringing and protect the output stage.

---

## 4. Transducer Configuration

- **Zone A**: Left side of bed (Pillar 1 Front-Left + Pillar 3 Back-Left).
- **Zone B**: Right side of bed (Pillar 2 Front-Right + Pillar 4 Back-Right).
- **Transducer Type**: 40 kHz Ultrasonic Transmitters (e.g. TCT40-16T / 400ST).
