"""
Unit tests for host/trigger.py (Part 3 Confirm & Hold Deterrence Logic).
"""

import sys
from pathlib import Path

HOST_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HOST_DIR))

from trigger import DeterrenceTrigger, TriggerConfig


def test_trigger_activates_only_after_confirm_frames():
    """Trigger must only fire after confirm_frames (default 2) consecutive frames with insects."""
    cfg = TriggerConfig(min_count=1, confirm_frames=2, hold_seconds=4.0)
    trig = DeterrenceTrigger(cfg)

    # Frame 1: 1 insect -> Not active yet
    active, changed = trig.update(insect_count=1, now=10.0)
    assert active is False
    assert changed is False
    assert trig.streak == 1

    # Frame 2: 1 insect -> Activates!
    active, changed = trig.update(insect_count=1, now=10.1)
    assert active is True
    assert changed is True
    assert trig.streak == 2


def test_trigger_holds_for_hold_seconds_and_shuts_off():
    """Output remains active for hold_seconds after last detection, then transitions OFF."""
    cfg = TriggerConfig(min_count=1, confirm_frames=1, hold_seconds=4.0)
    trig = DeterrenceTrigger(cfg)

    trig.update(1, now=10.0)
    assert trig.is_active is True

    # 3.0s later with 0 insects -> Still active (holding)
    active, changed = trig.update(0, now=13.0)
    assert active is True
    assert changed is False

    # 4.1s later with 0 insects -> Drops to standby (OFF)
    active, changed = trig.update(0, now=14.1)
    assert active is False
    assert changed is True


def test_zone_selection_controls():
    """Verifies --zones A | B | AB channel gating."""
    trig_ab = DeterrenceTrigger(TriggerConfig(confirm_frames=1, zones="AB"))
    trig_ab.update(1)
    assert trig_ab.get_zone_states() == (True, True)

    trig_a = DeterrenceTrigger(TriggerConfig(confirm_frames=1, zones="A"))
    trig_a.update(1)
    assert trig_a.get_zone_states() == (True, False)  # B is control

    trig_b = DeterrenceTrigger(TriggerConfig(confirm_frames=1, zones="B"))
    trig_b.update(1)
    assert trig_b.get_zone_states() == (False, True)  # A is control
