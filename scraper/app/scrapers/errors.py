import logging

from app.schemas.models import ErrorCode

logger = logging.getLogger("mealmatch.scraper")

_MAX_USER_MESSAGE_LENGTH = 160


def _sanitize(message: str) -> str:
    """Collapse a raw exception (which may include a multi-line Playwright
    call log) into a single short, user-safe sentence. The full message is
    still logged server-side for diagnosing selector breakage."""
    first_line = message.strip().splitlines()[0].strip()
    if len(first_line) > _MAX_USER_MESSAGE_LENGTH:
        first_line = first_line[: _MAX_USER_MESSAGE_LENGTH - 1].rstrip() + "…"
    return first_line


class ScraperError(Exception):
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = _sanitize(message)
        if self.message != message:
            logger.warning("scraper error [%s]: %s", code, message)
        super().__init__(message)
