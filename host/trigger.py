"""
Two-Stage Deterrence Trigger State Machine (Part 3).

Logic:
1. Hit condition: insect_count >= min_count.
2. Consecutive qualifying frames >= confirm_frames -> Output ON.
3. Once active, if no qualifying frames for hold_seconds -> Output OFF.
4. Zones filter: 'A' (Zone A active, B control), 'B' (Zone B active, A control), 'AB' (Both).
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Tuple


@dataclass
class TriggerConfig:
    min_count: int = 1
    confirm_frames: int = 2
    hold_seconds: float = 4.0
    zones: str = "AB"  # "A", "B", or "AB"


class DeterrenceTrigger:
    def __init__(self, config: TriggerConfig):
        self.config = config
        self.streak = 0
        self.is_active = False
        self.last_seen_time = 0.0
        self.total_activations = 0

    def update(self, insect_count: int, now: float = None) -> Tuple[bool, bool]:
        """
        Processes new frame count.
        Returns: (is_active, state_changed)
        """
        if now is None:
            now = time.time()

        hit = insect_count >= self.config.min_count
        if hit:
            self.streak += 1
            self.last_seen_time = now
        else:
            self.streak = 0

        prev_active = self.is_active

        if not self.is_active:
            if self.streak >= self.config.confirm_frames:
                self.is_active = True
                self.total_activations += 1
        else:
            if (now - self.last_seen_time) > self.config.hold_seconds:
                self.is_active = False

        state_changed = self.is_active != prev_active
        return self.is_active, state_changed

    def get_zone_states(self) -> Tuple[bool, bool]:
        """Returns (zone_a_active, zone_b_active) based on --zones setting."""
        if not self.is_active:
            return False, False

        z = self.config.zones.upper()
        zone_a = "A" in z
        zone_b = "B" in z
        return zone_a, zone_b

    def reset(self):
        self.streak = 0
        self.is_active = False
        self.last_seen_time = 0.0
