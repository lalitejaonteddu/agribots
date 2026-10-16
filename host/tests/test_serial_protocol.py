"""
Unit tests for host/stm32_client.py (Part 3 & 4 Serial Protocol & Mock Communication).
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

HOST_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HOST_DIR))

from stm32_client import STM32SerialClient


def test_mock_serial_responds_to_commands():
    """Validates commands execute cleanly in mock mode without throwing errors."""
    client = STM32SerialClient(mock=True)
    assert client.connect() is True
    assert client.is_connected is True

    reply = client.set_zone("A", on=True, freq_hz=40000)
    assert "OK" in reply

    status_reply = client.query_status()
    assert "STATUS" in status_reply
    assert "A=1,40000" in status_reply

    alloff_reply = client.all_off()
    assert "OK" in alloff_reply
    assert client.last_status["A_active"] is False


def test_status_reply_regex_parsing():
    """Tests regex extraction of frequency, uptime, and failsafe flag."""
    client = STM32SerialClient(mock=False)
    client._parse_reply("STATUS A=1,40000 B=0,38500 uptime=45210 failsafe=0")

    assert client.last_status["A_active"] is True
    assert client.last_status["A_freq"] == 40000
    assert client.last_status["B_active"] is False
    assert client.last_status["B_freq"] == 38500
    assert client.last_status["uptime_ms"] == 45210
    assert client.failsafe_active is False

    # Test failsafe flag
    client._parse_reply("STATUS A=0,40000 B=0,40000 uptime=46210 failsafe=1")
    assert client.failsafe_active is True
