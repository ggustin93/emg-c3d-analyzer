"""User Repository.

===============

🎯 PURPOSE: User profile and authentication management
- Unified user profiles (therapists, researchers, admins)
- Role-based access control support
- Institution and department management
- Authentication integration with Supabase Auth

📊 SUPABASE PATTERNS:
- Integration with auth.users (Supabase Auth)
- Role-based filtering and access control
- Institution-based grouping
- UUID foreign key relationships with auth system

"""

import logging
from typing import Any
from uuid import UUID

from services.shared.repositories.base.abstract_repository import (
    AbstractRepository,
    RepositoryError,
)
from models.user.models import UserProfile, UserProfileCreate, UserProfileUpdate

logger = logging.getLogger(__name__)


class UserRepository(AbstractRepository[UserProfileCreate, UserProfileUpdate, UserProfile]):
    """Repository for user profile and authentication management.

    Handles unified user profiles with role-based access control,
    institutional affiliations, and authentication integration.
    """

    def get_table_name(self) -> str:
        """Return primary table name for user profiles."""
        return "user_profiles"

    def get_create_model(self) -> type[UserProfileCreate]:
        """Return the Pydantic model class for create operations."""
        return UserProfileCreate

    def get_update_model(self) -> type[UserProfileUpdate]:
        """Return the Pydantic model class for update operations."""
        return UserProfileUpdate

    def get_response_model(self) -> type[UserProfile]:
        """Return the Pydantic model class for response operations."""
        return UserProfile

    def get_user_profile(self, user_id: str | UUID) -> dict[str, Any] | None:
        """Get user profile by ID.

        Args:
            user_id: User UUID (from auth.users)

        Returns:
            Optional[Dict]: User profile or None if not found
        """
        try:
            validated_id = self._validate_uuid(user_id, "user_id")

            result = (
                self.client.table("user_profiles")
                .select("*")
                .eq("id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get", "user profile")
            return data[0] if data else None

        except Exception as e:
            self.logger.exception("Failed to get user profile %s", user_id)
            raise RepositoryError(f"Failed to get user profile: {e!s}") from e

    def get_users_by_role(
        self, role: str, active_only: bool = True, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Get users by role (therapist, researcher, admin).

        Args:
            role: User role to filter by
            active_only: Only return active users
            limit: Optional limit on results

        Returns:
            List[Dict]: List of user profiles
        """
        try:
            query = (
                self.client.table("user_profiles").select("*").eq("role", role).order("full_name")
            )

            if active_only:
                query = query.eq("active", True)

            if limit:
                query = query.limit(limit)

            result = query.execute()

            return self._handle_supabase_response(result, "get", f"users by role {role}")

        except Exception as e:
            self.logger.exception("Failed to get users by role %s", role)
            raise RepositoryError(f"Failed to get users by role: {e!s}") from e

    def get_users_by_institution(
        self, institution: str, active_only: bool = True, limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Get users by institution.

        Args:
            institution: Institution name to filter by
            active_only: Only return active users
            limit: Optional limit on results

        Returns:
            List[Dict]: List of user profiles
        """
        try:
            query = (
                self.client.table("user_profiles")
                .select("*")
                .eq("institution", institution)
                .order("full_name")
            )

            if active_only:
                query = query.eq("active", True)

            if limit:
                query = query.limit(limit)

            result = query.execute()

            return self._handle_supabase_response(
                result, "get", f"users by institution {institution}"
            )

        except Exception as e:
            self.logger.exception("Failed to get users by institution %s", institution)
            raise RepositoryError(f"Failed to get users by institution: {e!s}") from e

    def update_user_profile(
        self, user_id: str | UUID, update_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Update user profile data.

        Args:
            user_id: User UUID
            update_data: Data to update

        Returns:
            Dict: Updated user profile
        """
        try:
            validated_id = self._validate_uuid(user_id, "user_id")
            update_data = self._prepare_timestamps(update_data, update=True)

            # Update last_login if provided
            if "last_login" in update_data and not update_data["last_login"]:
                update_data["last_login"] = self._prepare_timestamps({})["updated_at"]

            result = (
                self.client.table("user_profiles")
                .update(update_data)
                .eq("id", validated_id)
                .execute()
            )

            updated_data = self._handle_supabase_response(result, "update", "user profile")

            if not updated_data:
                raise RepositoryError(f"User profile {user_id} not found for update")

            self.logger.info("✅ Updated user profile: %s", user_id)
            return updated_data[0]

        except Exception as e:
            error_msg = f"Failed to update user profile {user_id}: {e!s}"
            self.logger.exception(error_msg)
            raise RepositoryError(error_msg) from e

    def update_last_login(self, user_id: str | UUID) -> None:
        """Update user's last login timestamp.

        Args:
            user_id: User UUID
        """
        try:
            self.update_user_profile(user_id, {"last_login": True})
            self.logger.debug("Updated last login for user: %s", user_id)

        except Exception as e:
            # Don't raise exception for login timestamp update failures
            self.logger.warning("Failed to update last login for user %s: %s", user_id, e)

    def get_active_therapists(self, limit: int | None = None) -> list[dict[str, Any]]:
        """Get active therapists (convenience method).

        Args:
            limit: Optional limit on results

        Returns:
            List[Dict]: List of active therapist profiles
        """
        return self.get_users_by_role("therapist", active_only=True, limit=limit)

    def get_active_researchers(self, limit: int | None = None) -> list[dict[str, Any]]:
        """Get active researchers (convenience method).

        Args:
            limit: Optional limit on results

        Returns:
            List[Dict]: List of active researcher profiles
        """
        return self.get_users_by_role("researcher", active_only=True, limit=limit)

    def deactivate_user(self, user_id: str | UUID) -> dict[str, Any]:
        """Deactivate user account (soft delete).

        Args:
            user_id: User UUID

        Returns:
            Dict: Updated user profile
        """
        try:
            return self.update_user_profile(user_id, {"active": False})

        except Exception as e:
            error_msg = f"Failed to deactivate user {user_id}: {e!s}"
            self.logger.exception(error_msg)
            raise RepositoryError(error_msg) from e

    def reactivate_user(self, user_id: str | UUID) -> dict[str, Any]:
        """Reactivate user account.

        Args:
            user_id: User UUID

        Returns:
            Dict: Updated user profile
        """
        try:
            return self.update_user_profile(user_id, {"active": True})

        except Exception as e:
            error_msg = f"Failed to reactivate user {user_id}: {e!s}"
            self.logger.exception(error_msg)
            raise RepositoryError(error_msg) from e
