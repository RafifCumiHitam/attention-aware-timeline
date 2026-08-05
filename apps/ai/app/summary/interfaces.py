"""Summary Generator interface."""

from typing import Protocol, runtime_checkable

from app.models.summary import SummaryRequest, SummaryResult


@runtime_checkable
class SummaryGenerator(Protocol):
    """Generate learning session summaries from interaction timelines."""

    async def generate(self, request: SummaryRequest) -> SummaryResult:
        """
        Produce natural-language and structured summary of a learning session.

        Real implementation may call an LLM or template engine over analytics.
        """
        ...
