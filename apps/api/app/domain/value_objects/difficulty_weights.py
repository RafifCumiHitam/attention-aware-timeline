"""Configurable weights for Behavioral Difficulty Score (not scientifically validated)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DifficultyWeights:
    """
    Transparent weighted baseline for Behavioral Difficulty Score.

    This is a heuristic behavioral baseline — not a validated psychometric measure.
    """

    pause_density: float = 0.20
    seek_density: float = 0.20
    backward_seek_density: float = 0.20
    replay_density: float = 0.15
    revisit_density: float = 0.15
    normalized_seek_distance: float = 0.10

    def normalized(self) -> "DifficultyWeights":
        total = (
            self.pause_density
            + self.seek_density
            + self.backward_seek_density
            + self.replay_density
            + self.revisit_density
            + self.normalized_seek_distance
        )
        if total <= 0:
            return DEFAULT_DIFFICULTY_WEIGHTS
        return DifficultyWeights(
            pause_density=self.pause_density / total,
            seek_density=self.seek_density / total,
            backward_seek_density=self.backward_seek_density / total,
            replay_density=self.replay_density / total,
            revisit_density=self.revisit_density / total,
            normalized_seek_distance=self.normalized_seek_distance / total,
        )


DEFAULT_DIFFICULTY_WEIGHTS = DifficultyWeights()
DEFAULT_BUCKET_SECONDS = 10.0

# Soft caps for density normalization (count → [0,1])
PAUSE_CAP = 3.0
SEEK_CAP = 4.0
BACKWARD_SEEK_CAP = 3.0
REPLAY_CAP = 3.0
REVISIT_CAP = 4.0
SEEK_DISTANCE_CAP = 120.0  # seconds of jump magnitude
