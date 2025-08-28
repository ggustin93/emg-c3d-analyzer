"""Abstract Repository Base Class
==============================

🎯 PURPOSE: Common interface and error handling for all domain repositories
- Supabase client injection with testability
- Consistent error handling and logging patterns  
- Common CRUD patterns with PostgreSQL best practices
- UUID handling and type safety

📊 SUPABASE PATTERNS:
- PostgREST API integration with proper error handling
- Row Level Security (RLS) compliance
- Optimized queries with proper indexing awareness
- Schema separation support (public/private)

Author: EMG C3D Analyzer Team  
Date: 2025-08-27
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class RepositoryError(Exception):
    """Base exception for all repository operations"""


class AbstractRepository(ABC):
    """Abstract base class for all domain repositories
    
    Provides common Supabase patterns and error handling
    following SOLID principles and DDD architecture.
    """

    def __init__(self, supabase_client=None):
        """Initialize repository with dependency injection for testability
        
        Args:
            supabase_client: Optional Supabase client (for testing)
        """
        self.client = supabase_client or get_supabase_client()
        self.logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")

    def _validate_uuid(self, value: str | UUID, field_name: str) -> str:
        """Validate and convert UUID values for Supabase queries
        
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
        """Handle Supabase API responses with consistent error handling
        
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
        """Add standard timestamp fields to data
        
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
        self,
        table_name: str,
        data: dict[str, Any],
        unique_key: str = "session_id"
    ) -> dict[str, Any]:
        """Generic upsert operation for any table
        
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
                prepared_data["session_id"] = self._validate_uuid(prepared_data["session_id"], "session_id")

            # Check if record exists
            unique_value = prepared_data[unique_key]
            existing_result = (
                self.client
                .table(table_name)
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
                    self.client
                    .table(table_name)
                    .update(self._prepare_timestamps(prepared_data, update=True))
                    .eq(unique_key, unique_value)
                    .execute()
                )
                operation = "update"
            else:
                # Insert new record
                result = (
                    self.client
                    .table(table_name)
                    .insert(prepared_data)
                    .execute()
                )
                operation = "insert"

            upserted_data = self._handle_supabase_response(result, operation, f"{table_name} record")[0]

            self.logger.info(f"✅ {operation.title()}ed {table_name} record: {unique_key}={unique_value}")
            return upserted_data

        except Exception as e:
            error_msg = f"Failed to upsert {table_name} record: {e!s}"
            self.logger.error(error_msg, exc_info=True)
            raise RepositoryError(error_msg) from e

    @abstractmethod
    def get_table_name(self) -> str:
        """Return the primary table name for this repository"""

    def exists(self, entity_id: str | UUID) -> bool:
        """Check if entity exists by ID
        
        Args:
            entity_id: Entity UUID
            
        Returns:
            bool: True if entity exists
        """
        try:
            validated_id = self._validate_uuid(entity_id, "entity_id")

            result = (
                self.client
                .table(self.get_table_name())
                .select("id")
                .eq("id", validated_id)
                .limit(1)
                .execute()
            )

            data = self._handle_supabase_response(result, "check existence", self.get_table_name())
            return len(data) > 0

        except Exception as e:
            self.logger.error(f"Failed to check {self.get_table_name()} existence: {e!s}")
            return False
