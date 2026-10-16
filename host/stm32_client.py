"""
STM32 Serial Client & Link Supervisor (Part 3 & 4).

Features:
1. Auto-detects ST-Link Virtual COM Port (VID: 0x0483) or CDC device.
2. 115200 baud, line-based ASCII '\n' protocol.
3. Sends PING every 500 ms to refresh the 2000 ms hardware failsafe watchdog.
4. Sends SET A / SET B only when actuation state or frequency changes.
5. Reconnects automatically on device hot-unplug / replug.
6. Mock serial mode (--mock-serial) for testing without connected hardware.
"""

from __future__ import annotations

import logging
import re
import sys
import threading
import time
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("STM32Client")

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    serial = None


class STM32SerialClient:
    def __init__(
        self,
        port: Optional[str] = None,
        baud: int = 115200,
        mock: bool = False,
        ping_interval_s: float = 0.5,
    ):
        self.port_name = port
        self.baud = baud
        self.mock = mock
        self.ping_interval_s = ping_interval_s

        self.ser: Optional[Any] = None
        self.is_connected = False
        self.failsafe_active = False
        self.last_ping_time = 0.0
        self.last_status: Dict[str, Any] = {
            "A_active": False,
            "A_freq": 40000,
            "B_active": False,
            "B_freq": 40000,
            "uptime_ms": 0,
            "failsafe": 0,
        }

        # Comm lock
        self.lock = threading.Lock()

    @staticmethod
    def find_stm32_port() -> Optional[str]:
        """Scans system serial ports for ST-Link V2.1 (VID: 0x0483) or USB CDC devices."""
        if serial is None:
            return None
        ports = serial.tools.list_ports.comports()
        for p in ports:
            # Check STMicroelectronics VID: 0x0483
            if p.vid == 0x0483:
                return p.device
            desc = (p.description or "").lower()
            if "stlink" in desc or "stm32" in desc or "nucleo" in desc or "vcp" in desc:
                return p.device
        return None

    def connect(self) -> bool:
        if self.mock:
            self.is_connected = True
            print("[STM32 Serial] Connected in MOCK mode (--mock-serial active).")
            return True

        if serial is None:
            print("[STM32 Serial Error] pyserial is not installed. Run: pip install pyserial")
            return False

        target_port = self.port_name or self.find_stm32_port()
        if not target_port:
            self.is_connected = False
            return False

        try:
            with self.lock:
                self.ser = serial.Serial(target_port, self.baud, timeout=0.1)
                self.port_name = target_port
                self.is_connected = True
                print(f"[STM32 Serial] Successfully connected to {target_port} at {self.baud} baud.")
                # Request initial status
                self._send_raw("STATUS")
                return True
        except Exception as e:
            logger.debug("Failed opening %s: %s", target_port, e)
            self.is_connected = False
            return False

    def _send_raw(self, cmd_line: str) -> Optional[str]:
        """Transmits line command and reads immediate response."""
        line = cmd_line.strip() + "\n"
        if self.mock:
            if line.strip() != "PING":  # don't flood the console with heartbeats
                print(f"[MOCK SERIAL TX] -> {line.strip()}")
            if line.startswith("STATUS"):
                return f"STATUS A={int(self.last_status['A_active'])},{self.last_status['A_freq']} B={int(self.last_status['B_active'])},{self.last_status['B_freq']} uptime=12345 failsafe=0"
            return f"OK {cmd_line.strip()}"

        if not self.ser or not self.is_connected:
            return None

        try:
            with self.lock:
                self.ser.write(line.encode("ascii"))
                reply = self.ser.readline().decode("ascii", errors="replace").strip()
                self._parse_reply(reply)
                return reply
        except Exception as e:
            print(f"[STM32 Serial Error] Communication lost: {e}")
            self.disconnect()
            return None

    def _parse_reply(self, reply: str):
        if not reply:
            return
        if reply.startswith("STATUS"):
            # Format: STATUS A=<0|1>,<actualHz> B=<0|1>,<actualHz> uptime=<ms> failsafe=<0|1>
            match = re.search(r"A=([01]),(\d+)\s+B=([01]),(\d+)\s+uptime=(\d+)\s+failsafe=([01])", reply)
            if match:
                self.last_status["A_active"] = match.group(1) == "1"
                self.last_status["A_freq"] = int(match.group(2))
                self.last_status["B_active"] = match.group(3) == "1"
                self.last_status["B_freq"] = int(match.group(4))
                self.last_status["uptime_ms"] = int(match.group(5))
                self.last_status["failsafe"] = int(match.group(6))
                self.failsafe_active = self.last_status["failsafe"] == 1
        elif "FAILSAFE" in reply.upper():
            self.failsafe_active = True

    def ping(self):
        """Sends periodic PING to satisfy the 2000 ms STM32 hardware watchdog."""
        now = time.time()
        if now - self.last_ping_time >= self.ping_interval_s:
            self.last_ping_time = now
            self._send_raw("PING")

    def set_zone(self, zone: str, on: bool, freq_hz: int):
        """Sends SET <A|B> <on|off> <freqHz>."""
        state_str = "on" if on else "off"
        cmd = f"SET {zone.upper()} {state_str} {int(freq_hz)}"
        if self.mock:
            if zone.upper() == "A":
                self.last_status["A_active"] = on
                self.last_status["A_freq"] = freq_hz
            elif zone.upper() == "B":
                self.last_status["B_active"] = on
                self.last_status["B_freq"] = freq_hz
        return self._send_raw(cmd)

    def all_off(self):
        """Sends ALLOFF command."""
        if self.mock:
            self.last_status["A_active"] = False
            self.last_status["B_active"] = False
        return self._send_raw("ALLOFF")

    def query_status(self):
        return self._send_raw("STATUS")

    def disconnect(self):
        with self.lock:
            self.is_connected = False
            if self.ser:
                try:
                    self.ser.close()
                except Exception:
                    pass
                self.ser = None

    def tick_maintenance(self):
        """Maintains link: handles auto-reconnect and periodic ping."""
        if not self.is_connected:
            # look for the board at most every 2 s (port scanning every frame slows the camera loop)
            now = time.time()
            if now - getattr(self, "_last_connect_try", 0.0) >= 2.0:
                self._last_connect_try = now
                self.connect()
        else:
            self.ping()
