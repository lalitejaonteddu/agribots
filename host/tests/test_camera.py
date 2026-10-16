"""
Unit tests for host/camera.py (Strict External USB Webcam Policy).
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

HOST_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HOST_DIR))

from camera import CameraDevice, ExternalWebcamStream, is_name_builtin_or_virtual


def test_builtin_and_virtual_name_detection():
    """Confirms keywords (macbook, facetime, virtual, etc.) trigger rejection."""
    assert is_name_builtin_or_virtual("MacBook Air Camera")[0] is True
    assert is_name_builtin_or_virtual("FaceTime HD Camera")[0] is True
    assert is_name_builtin_or_virtual("OBS Virtual Camera")[0] is True
    assert is_name_builtin_or_virtual("Snap Camera")[0] is True
    assert is_name_builtin_or_virtual("iPhone 15 Pro Camera")[0] is True
    assert is_name_builtin_or_virtual("Logitech Webcam C920")[0] is False
    assert is_name_builtin_or_virtual("USB 2.0 PC Camera")[0] is False


def test_external_chosen_when_builtin_present():
    """When both built-in and external USB cameras exist, external must be chosen."""
    mock_devices = [
        CameraDevice(index=0, name="MacBook Air Camera", backend="AVFOUNDATION", is_external=False, classification_reason="built-in"),
        CameraDevice(index=1, name="Logitech C920 HD Pro", backend="AVFOUNDATION", is_external=True, classification_reason="external USB"),
    ]

    with patch("camera.list_all_cameras", return_value=mock_devices):
        stream = ExternalWebcamStream()
        chosen = stream.select_camera()
        assert chosen.index == 1
        assert chosen.name == "Logitech C920 HD Pro"
        assert chosen.is_external is True


def test_error_raised_when_only_builtin_present():
    """Program must raise RuntimeError if no external USB webcam is connected."""
    mock_devices = [
        CameraDevice(index=0, name="MacBook Air Camera", backend="AVFOUNDATION", is_external=False, classification_reason="built-in")
    ]

    with patch("camera.list_all_cameras", return_value=mock_devices):
        stream = ExternalWebcamStream()
        with pytest.raises(RuntimeError) as exc_info:
            stream.select_camera()
        assert "No external USB webcam found" in str(exc_info.value)


def test_multiple_externals_prompts_camera_name():
    """Multiple external cameras require explicit --camera-name filter."""
    mock_devices = [
        CameraDevice(index=1, name="Logitech C920", backend="V4L2", is_external=True, classification_reason="external"),
        CameraDevice(index=2, name="Aukey 1080p", backend="V4L2", is_external=True, classification_reason="external"),
    ]

    with patch("camera.list_all_cameras", return_value=mock_devices):
        stream = ExternalWebcamStream()
        with pytest.raises(RuntimeError) as exc_info:
            stream.select_camera()
        assert "Multiple external USB webcams found" in str(exc_info.value)

        # Passing camera-name filter resolves ambiguity
        stream_filtered = ExternalWebcamStream(camera_name="Aukey")
        chosen = stream_filtered.select_camera()
        assert chosen.name == "Aukey 1080p"


def test_unplug_invokes_failsafe_callback():
    """Camera disconnect triggers unplug callback (which sends ALLOFF)."""
    unplug_mock = MagicMock()
    stream = ExternalWebcamStream(on_unplug_callback=unplug_mock)
    stream.is_connected = True
    stream.cap = MagicMock()

    stream.handle_disconnect()
    assert stream.is_connected is False
    unplug_mock.assert_called_once()


def test_builtin_test_mode_picks_mac_camera_never_iphone():
    """--builtin: the MacBook camera is used; an iPhone Continuity camera is never chosen."""
    mock_devices = [
        CameraDevice(index=0, name="iPhone Camera", backend="AVFOUNDATION", is_external=False, classification_reason="virtual"),
        CameraDevice(index=1, name="MacBook Air Camera", backend="AVFOUNDATION", is_external=False, classification_reason="built-in"),
    ]
    with patch("camera.list_all_cameras", return_value=mock_devices):
        chosen = ExternalWebcamStream(allow_builtin=True).select_camera()
        assert chosen.name == "MacBook Air Camera"


def test_builtin_test_mode_does_not_touch_camera_json(tmp_path):
    mock_devices = [
        CameraDevice(index=0, name="FaceTime HD Camera", backend="AVFOUNDATION", is_external=False, classification_reason="built-in"),
    ]
    with patch("camera.list_all_cameras", return_value=mock_devices), patch("camera.CAMERA_CONFIG_PATH", tmp_path / "camera.json"):
        ExternalWebcamStream(allow_builtin=True).select_camera()
        assert not (tmp_path / "camera.json").exists()


def test_without_builtin_flag_mac_camera_is_still_refused():
    mock_devices = [
        CameraDevice(index=0, name="FaceTime HD Camera", backend="AVFOUNDATION", is_external=False, classification_reason="built-in"),
    ]
    with patch("camera.list_all_cameras", return_value=mock_devices):
        with pytest.raises(RuntimeError, match="No external USB webcam"):
            ExternalWebcamStream().select_camera()


def test_short_frame_glitch_is_not_an_unplug():
    stream = ExternalWebcamStream()
    stream.cap = MagicMock()
    stream.cap.read.return_value = (False, None)
    stream.is_connected = True
    calls = []
    stream.on_unplug_callback = lambda: calls.append(1)
    for _ in range(ExternalWebcamStream.MAX_FAILED_READS - 1):
        stream.read()
    assert stream.is_connected and not calls
    stream.read()
    assert not stream.is_connected and calls == [1]
