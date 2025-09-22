"""Abstract Repository Base Class.
==============================

🎯 PURPOSE: Common interface and error handling for all domain repositories
- Supabase client injection with testability
- Consistent error handling and logging patterns
- Common CRUD patterns with PostgreSQL best practices
- UUID handling and type safety
- Pydantic model integration for validation

📊 SUPABASE PATTERNS:
- PostgREST API integration with proper error handling
- Row Level Security (RLS) compliance
- Optimized queries with proper indexing awareness
- Schema separation support (public/private)
- Comprehensive CRUD operations with Pydantic models

UDate: 2025-08-27 | Enhanced: 2025-08-28
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ValidationError

from database.supabase_client import get_supabase_client

# Generic types for Pydantic models
CreateModelType = TypeVar("CreateModelType", bound=BaseModel)
UpdateModelType = TypeVar("UpdateModelType", bound=BaseModel)
ResponseModelType = TypeVar("ResponseModelType", bound=BaseModel)

logger = logging.getLogger(__name__)


class RepositoryError(Exception):
    """Base exception for all repository operations."""


class AbstractRepository(ABC, Generic[CreateModelType, UpdateModelType, ResponseModelType]):
    """Abstract base class for all domain repositories with Pydantic model support.

    Provides common Supabase patterns and error handling
    following SOLID principles and DDD architecture.

    Type Parameters:
        CreateModelType: Pydantic model for create operations
        UpdateModelType: Pydantic model for update operations
        ResponseModelType: Pydantic model for response serialization
    """

    def __init__(self, supabase_client=None):
        """Initialize repository with dependency injection for testability.

        Args:
            supabase_client: Optional Supabase client (for testing)
        """
        self.client = supabase_client or get_supabase_client()
        self.logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")

    def _validate_uuid(self, value: str | UUID, field_name: str) -> str:
        """Validate and convert UUID values for Supabase queries.

        Args:
            value: UUID string or UUID object
            field_name: Field name for error messages

        Returns:
            str: Valid UUID string

        Raises:
            RepositoryError: If UUID is invalid
        """
        try:
            if isinstance(value, UUID):
                return str(value)
            elif isinstance(value, str):
                # Validate UUID format
                UUID(value)
                return value
            else:
                raise ValueError(f"Invalid UUID type: {type(value)}")
        except (ValueError, TypeError) as e:
            raise RepositoryError(f"Invalid {field_name}: {value} - {e!s}") from e

    def _handle_supabase_response(self, result, operation: str, entity_name: str) -> Any:
        """Handle Supabase API responses with consistent error handling.

        Args:
            result: Supabase query result
            operation: Operation name (for logging)
            entity_name: Entity name (for logging)

        Returns:
            Data from successful response

        Raises:
            RepositoryError: If operation failed
        """
        try:
            if hasattr(result, "data") and hasattr(result, "count"):
                # PostgREST response format
                if result.data is not None:
                    return result.data
                else:
                    # Check for errors in the response
                    error_message = getattr(result, "error", "Unknown error")
                    raise RepositoryError(f"{operation} {entity_name} failed: {error_message}")
            else:
                # Direct data response
                return result

        except Exception as e:
            error_msg = f"Failed to {operation} {entity_name}: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def _prepare_timestamps(self, data: dict[str, Any], update: bool = False) -> dict[str, Any]:
        """Add standard timestamp fields to data.

        Args:
            data: Data dictionary to modify
            update: If True, only add updated_at

        Returns:
            Dict with timestamp fields added
        """
        now = datetime.now().isoformat()

        if not update:
            data["created_at"] = now
        data["updated_at"] = now

        return data

    async def generic_upsert(
        self, table_name: str, data: dict[str, Any], unique_key: str = "session_id"
    ) -> dict[str, Any]:
        """Generic upsert operation for any table.

        Args:
            table_name: Name of the table
            data: Data to upsert
            unique_key: Field to use for upsert matching

        Returns:
            Dict: Upserted data
        """
        try:
            prepared_data = self._prepare_timestamps(data.copy())

            # Validate session_id if present
            if "session_id" in prepared_data:
                prepared_data["session_id"] = self._validate_uuid(
                    prepared_data["session_id"], "session_id"
                )

            # Check if record exists
            unique_value = prepared_data[unique_key]
            existing_result = (
                self.client.table(table_name)
                .select("id")
                .eq(unique_key, unique_value)
                .limit(1)
                .execute()
            )

            existing_data = self._handle_supabase_response(
                existing_result, "check existing", f"{table_name} record"
            )

            if existing_data:
                # Update existing record
                result = (
                    self.client.table(table_name)
                    .update(self._prepare_timestamps(prepared_data, update=True))
                    .eq(unique_key, unique_value)
                    .execute()
                )
                operation = "update"
            else:
                # Insert new record
                result = self.client.table(table_name).insert(prepared_data).execute()
                operation = "insert"

            upserted_data = self._handle_supabase_response(
                result, operation, f"{table_name} record"
            )[0]

            self.logger.info(
                f"✅ {operation.title()}ed {table_name} record: {unique_key}={unique_value}"
            )
            return upserted_data

        except Exception as e:
            error_msg = f"Failed to upsert {table_name} record: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    @abstractmethod
    def get_table_name(self) -> str:
        """Return the primary table name for this repository."""

    def exists(self, entity_id: str | UUID) -> bool:
        """Check if entity exists by ID.

        Args:
            entity_id: Entity UUID

        Returns:
            bool: True if entity exists
        """
        try:
            validated_id = self._validate_uuid(entity_id, "entity_id")

            result = (
                self.client.table(self.get_table_name())
                .select("id")
                .eq("id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "check existence", self.get_table_name())
            return len(data) > 0

        except Exception as e:
            self.logger.exception(f"Failed to check {self.get_table_name()} existence: {e!s}")
            return False

    # =============================================================================
    # ENHANCED CRUD OPERATIONS WITH PYDANTIC MODELS
    # =============================================================================

    @abstractmethod
    def get_create_model(self) -> type[CreateModelType]:
        """Return the Pydantic model class for create operations."""

    @abstractmethod
    def get_update_model(self) -> type[UpdateModelType]:
        """Return the Pydantic model class for update operations."""

    @abstractmethod
    def get_response_model(self) -> type[ResponseModelType]:
        """Return the Pydantic model class for response serialization."""

    def create(self, data: CreateModelType) -> ResponseModelType:
        """Create a new entity with Pydantic validation.

        Args:
            data: Validated Pydantic model for creation

        Returns:
            ResponseModelType: Created entity

        Raises:
            RepositoryError: If creation fails
        """
        try:
            # Convert Pydantic model to dict
            create_dict = data.model_dump(exclude_unset=True, exclude_none=True)

            # Prepare with timestamps
            prepared_data = self._prepare_timestamps(create_dict)

            # Validate UUIDs if present
            for field in ["id", "patient_id", "therapist_id", "session_id", "scoring_config_id"]:
                if field in prepared_data:
                    prepared_data[field] = self._validate_uuid(prepared_data[field], field)

            # Execute insert
            result = self.client.table(self.get_table_name()).insert(prepared_data).execute()

            created_data = self._handle_supabase_response(result, "create", self.get_table_name())

            if not created_data:
                raise RepositoryError(f"No data returned after creating {self.get_table_name()}")

            # Return first created record as Pydantic model
            response_model = self.get_response_model()
            created_entity = response_model.model_validate(created_data[0])

            self.logger.info(
                f"✅ Created {self.get_table_name()}: {getattr(created_entity, 'id', 'unknown')}"
            )
            return created_entity

        except ValidationError as e:
            raise RepositoryError(f"Validation error creating {self.get_table_name()}: {e}") from e
        except Exception as e:
            error_msg = f"Failed to create {self.get_table_name()}: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    def get_by_id(self, entity_id: str | UUID) -> ResponseModelType | None:
        """Get entity by ID with Pydantic serialization.

        Args:
            entity_id: Entity UUID

        Returns:
            Optional[ResponseModelType]: Entity if found, None otherwise
        """
        try:
            validated_id = self._validate_uuid(entity_id, "entity_id")

            result = (
                self.client.table(self.get_table_name())
                .select("*")
                .eq("id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "get by id", self.get_table_name())

            if not data:
                return None

            response_model = self.get_response_model()
            return response_model.model_validate(data[0])

        except Exception:
            self.logger.exception(f"Failed to get {self.get_table_name()} by id {entity_id}")
            return None

    def get_many(
        self,
        filters: dict[str, Any] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        order_by: str | None = None,
        order_direction: str = "asc",
    ) -> list[ResponseModelType]:
        """Get multiple entities with filtering and pagination.

        Args:
            filters: Dictionary of field:value filters
            limit: Maximum number of records to return
            offset: Number of records to skip
            order_by: Field to order by
            order_direction: "asc" or "desc"

        Returns:
            List[ResponseModelType]: List of entities
        """
        try:
            query = self.client.table(self.get_table_name()).select("*")

            # Apply filters
            if filters:
                for field, value in filters.items():
                    if isinstance(value, str | UUID) and field.endswith("_id"):
                        value = self._validate_uuid(value, field)
                    query = query.eq(field, value)

            # Apply ordering
            if order_by:
                query = query.order(order_by, desc=(order_direction.lower() == "desc"))

            # Apply pagination
            if limit:
                query = query.limit(limit)
            if offset:
                query = query.offset(offset)

            result = query.execute()
            data = self._handle_supabase_response(result, "get many", self.get_table_name())

            # Convert to Pydantic models
            response_model = self.get_response_model()
            return [response_model.model_validate(item) for item in data]

        except Exception as e:
            error_msg = f"Failed to get {self.get_table_name()} records: {e!s}"
            self.logger.exception(error_msg)
            return []

    def update(self, entity_id: str | UUID, data: UpdateModelType) -> ResponseModelType | None:
        """Update entity with Pydantic validation.

        Args:
            entity_id: Entity UUID to update
            data: Validated Pydantic model for updates

        Returns:
            Optional[ResponseModelType]: Updated entity if successful

        Raises:
            RepositoryError: If update fails
        """
        try:
            validated_id = self._validate_uuid(entity_id, "entity_id")

            # Convert Pydantic model to dict, excluding unset fields
            update_dict = data.model_dump(exclude_unset=True, exclude_none=False)

            if not update_dict:
                raise RepositoryError("No fields to update")

            # Prepare with updated timestamp
            prepared_data = self._prepare_timestamps(update_dict, update=True)

            # Validate UUIDs if present
            for field in ["patient_id", "therapist_id", "session_id", "scoring_config_id"]:
                if field in prepared_data:
                    prepared_data[field] = self._validate_uuid(prepared_data[field], field)

            # Execute update
            result = (
                self.client.table(self.get_table_name())
                .update(prepared_data)
                .eq("id", validated_id)
                .execute()
            )

            updated_data = self._handle_supabase_response(result, "update", self.get_table_name())

            if not updated_data:
                return None

            response_model = self.get_response_model()
            updated_entity = response_model.model_validate(updated_data[0])

            self.logger.info("Updated %s: %s", self.get_table_name(), entity_id)
            return updated_entity

        except ValidationError as e:
            raise RepositoryError(f"Validation error updating {self.get_table_name()}: {e}") from e
        except Exception as e:
            error_msg = f"Failed to update {self.get_table_name()} {entity_id}: {e!s}"
            self.logger.exception(error_msg)
            raise RepositoryError(error_msg) from e

    def delete(self, entity_id: str | UUID) -> bool:
        """Delete entity by ID.

        Args:
            entity_id: Entity UUID to delete

        Returns:
            bool: True if deleted successfully
        """
        try:
            validated_id = self._validate_uuid(entity_id, "entity_id")

            result = (
                self.client.table(self.get_table_name()).delete().eq("id", validated_id).execute()
            )

            deleted_data = self._handle_supabase_response(result, "delete", self.get_table_name())

            success = deleted_data is not None and len(deleted_data) > 0
            if success:
                self.logger.info("Deleted %s: %s", self.get_table_name(), entity_id)
            return success

        except Exception as e:
            error_msg = f"Failed to delete {self.get_table_name()} {entity_id}: {e!s}"
            self.logger.exception(error_msg)
            return False

    def count(self, filters: dict[str, Any] | None = None) -> int:
        """Count entities with optional filters.

        Args:
            filters: Dictionary of field:value filters

        Returns:
            int: Number of matching entities
        """
        try:
            query = self.client.table(self.get_table_name()).select("id", count="exact")

            # Apply filters
            if filters:
                for field, value in filters.items():
                    if isinstance(value, str | UUID) and field.endswith("_id"):
                        value = self._validate_uuid(value, field)
                    query = query.eq(field, value)

            result = query.execute()
            return result.count or 0
        except Exception:
            self.logger.exception("Failed to count %s", self.get_table_name())
            return 0

    def bulk_create(self, data_list: list[CreateModelType]) -> list[ResponseModelType]:
        """Create multiple entities in a single transaction.

        Args:
            data_list: List of validated Pydantic models for creation

        Returns:
            List[ResponseModelType]: Created entities

        Raises:
            RepositoryError: If bulk creation fails
        """
        try:
            if not data_list:
                return []

            # Convert all Pydantic models to dicts
            create_dicts = []
            for data in data_list:
                create_dict = data.model_dump(exclude_unset=True, exclude_none=True)
                prepared_data = self._prepare_timestamps(create_dict)

                # Validate UUIDs if present
                for field in [
                    "id",
                    "patient_id",
                    "therapist_id",
                    "session_id",
                    "scoring_config_id",
                ]:
                    if field in prepared_data:
                        prepared_data[field] = self._validate_uuid(prepared_data[field], field)

                create_dicts.append(prepared_data)

            # Execute bulk insert
            result = self.client.table(self.get_table_name()).insert(create_dicts).execute()

            created_data = self._handle_supabase_response(
                result, "bulk create", self.get_table_name()
            )

            # Convert to Pydantic models
            response_model = self.get_response_model()
            created_entities = [response_model.model_validate(item) for item in created_data]

            self.logger.info(
                "Bulk created %d %s records", len(created_entities), self.get_table_name()
            )
            return created_entities

        except ValidationError as e:
            raise RepositoryError(
                f"Validation error in bulk create {self.get_table_name()}: {e}"
            ) from e
        except Exception as e:
            error_msg = f"Failed to bulk create {self.get_table_name()}: {e!s}"
            self.logger.exception(error_msg)
            raise RepositoryError(error_msg) from e
