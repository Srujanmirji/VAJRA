"""Replay Controller for VAJRA Demonstration.
Allows stepping through stored/synthetic convective events at 1x, 10x, and 60x speed,
enabling forecasters and hackathon evaluators to see the real-time 5-minute cycle on stage.
"""

from typing import Dict, Any, Optional
import asyncio
from app.pipeline.engine import PipelineEngine


class ReplayController:
    """Controls time-stepped event replay across supported regions."""

    def __init__(self, engine: PipelineEngine):
        self.engine = engine
        self.current_step = 0
        self.max_steps = 12  # 12 steps x 5 min = 1 hour event
        self.is_playing = False
        self.speed_multiplier = 10.0  # 1x, 10x, 60x
        self._task: Optional[asyncio.Task] = None

    def step(self) -> Dict[str, Any]:
        """Advances by one 5-minute frame."""
        self.current_step = (self.current_step + 1) % self.max_steps
        return self.engine.execute_cycle(step=self.current_step)

    def set_step(self, step: int) -> Dict[str, Any]:
        """Sets specific step index (0 to max_steps - 1)."""
        self.current_step = max(0, min(step, self.max_steps - 1))
        return self.engine.execute_cycle(step=self.current_step)

    def set_speed(self, speed: float):
        """Sets replay speed multiplier (e.g. 1.0, 10.0, 60.0)."""
        if speed in [1.0, 10.0, 60.0]:
            self.speed_multiplier = speed
        else:
            self.speed_multiplier = float(speed)

    def pause(self):
        """Pauses the replay loop."""
        self.is_playing = False
        if self._task and not self._task.done():
            self._task.cancel()

    def play(self):
        """Resumes playback."""
        self.is_playing = True
