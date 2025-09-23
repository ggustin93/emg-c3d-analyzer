"""User Repository Package.

=========================

Repository pattern implementation for user management domain.
Handles authentication, user profiles, and role-based access control.

"""

from services.user.repositories.user_repository import UserRepository

__all__ = ["UserRepository"]
