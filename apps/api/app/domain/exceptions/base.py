"""Domain and application exceptions."""

from typing import Any


class AppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str = "An error occurred",
        code: str = "app_error",
        status_code: int = 400,
        details: Any = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        super().__init__(message)


class NotFoundError(AppException):
    def __init__(self, resource: str = "Resource", identifier: Any = None):
        msg = f"{resource} not found" if identifier is None else f"{resource} '{identifier}' not found"
        super().__init__(message=msg, code="not_found", status_code=404)


class ConflictError(AppException):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message=message, code="conflict", status_code=409)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Not authenticated"):
        super().__init__(message=message, code="unauthorized", status_code=401)


class ForbiddenError(AppException):
    def __init__(self, message: str = "Not enough permissions"):
        super().__init__(message=message, code="forbidden", status_code=403)


class ValidationError(AppException):
    def __init__(self, message: str = "Validation error", details: Any = None):
        super().__init__(message=message, code="validation_error", status_code=422, details=details)


class BadRequestError(AppException):
    def __init__(self, message: str = "Bad request"):
        super().__init__(message=message, code="bad_request", status_code=400)
