"""User Domain Services.

====================

Domain services for user management, authentication, and role-based access control.
Separated from clinical domain to follow Domain-Driven Design principles.

Repositories:
- UserRepository: User profiles, authentication, and RBAC

"""

from services.user.repositories.user_repository import UserRepository

__all__ = ["UserRepository"]
