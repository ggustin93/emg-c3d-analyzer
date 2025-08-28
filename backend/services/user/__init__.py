"""User Domain Services.
====================

Domain services for user management, authentication, and role-based access control.
Separated from clinical domain to follow Domain-Driven Design principles.

Repositories:
- UserRepository: User profiles, authentication, and RBAC

Author: EMG C3D Analyzer Team
Date: 2025-08-27
"""

from backend.services.user.repositories.user_repository import UserRepository

__all__ = ["UserRepository"]
