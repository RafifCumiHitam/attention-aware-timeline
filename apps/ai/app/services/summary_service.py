"""Summary service."""

from app.models.summary import SummaryRequest, SummaryResult
from app.summary.interfaces import SummaryGenerator


class SummaryService:
    def __init__(self, generator: SummaryGenerator) -> None:
        self._generator = generator

    async def generate(self, request: SummaryRequest) -> SummaryResult:
        return await self._generator.generate(request)
