class SkrapeAPIError(Exception):
    """Raised when the Skrape.ai API returns an error."""
    pass

class SkrapeValidationError(Exception):
    """Raised when the response data doesn't match the provided schema."""
    pass
