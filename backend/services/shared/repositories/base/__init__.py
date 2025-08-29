"""Base Repository Components.
=========================

Common interfaces and error handling for all domain repositories.
"""

from services.shared.repositories.base.abstract_repository import (
    AbstractRepository,
    RepositoryError,
)

__all__ = ["AbstractRepository", "RepositoryError"]
