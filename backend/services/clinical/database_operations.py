"""Database Operations Service - Centralized Data Access Layer (Schema v2.0)
========================================================================

🎯 PURPOSE: Eliminate DRY violations by centralizing database operations
- Single source of truth for all therapy session database operations
- Consistent error handling and logging across all database interactions
- Simplified testing and maintenance through service isolation

🔄 SCHEMA V2.0 CHANGES:
- Redis cache migration: Removed analytics_cache database operations
- UUID patient_id support: Updated for proper foreign key relationships
- Unified user management: Support for public.user_profiles table
- Schema separation: Support for private.patient_pii sensitive data
- RGPD compliance: Separate handling of pseudonymized vs PII data

📊 SOLID COMPLIANCE:
- Single Responsibility: Only handles database operations
- Open/Closed: Extensible without modifying existing operations
- Dependency Inversion: Depends on Supabase client abstraction

Author: EMG C3D Analyzer Team - Architecture Refactoring
Date: 2025-08-26 | Updated: 2025-08-27 (Schema v2.0)
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class DatabaseOperationError(Exception):
    """Raised when database operations fail"""


class TherapySessionDatabaseOperations:
    """Centralized database operations for therapy session management
    
    Eliminates DRY violations by providing reusable database operations
    with consistent error handling and logging patterns.
    """

    def __init__(self, supabase_client=None):
        """Initialize with dependency injection for testability"""
        self.supabase = supabase_client or get_supabase_client(use_service_key=True)
        logger.info("🗄️ Database operations service initialized")

    def create_therapy_session(self, session_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new therapy session record
        
        Args:
            session_data: Dictionary containing session information
            
        Returns:
            Created session record with generated ID
            
        Raises:
            DatabaseOperationError: If session creation fails
        """
        try:
            logger.info(f"📝 Creating therapy session: {session_data.get('patient_id', 'Unknown')}")
            result = self.supabase.table("therapy_sessions").insert(session_data).execute()

            if not result.data:
                raise DatabaseOperationError("Failed to create therapy session - no data returned")

            session = result.data[0]
            logger.info(f"✅ Created session: {session['id']}")
            return session

        except Exception as e:
            error_msg = f"Failed to create therapy session: {e!s}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e

    def update_therapy_session(self, session_id: str | UUID, update_data: dict[str, Any]) -> dict[str, Any]:
        """Update an existing therapy session record
        
        Args:
            session_id: Session UUID to update
            update_data: Fields to update
            
        Returns:
            Updated session record
            
        Raises:
            DatabaseOperationError: If update fails
        """
        try:
            logger.info(f"🔄 Updating session {session_id} with {len(update_data)} fields")
            result = self.supabase.table("therapy_sessions").update(update_data).eq("id", str(session_id)).execute()

            if not result.data:
                raise DatabaseOperationError(f"Session {session_id} not found or update failed")

            logger.info(f"✅ Updated session: {session_id}")
            return result.data[0]

        except Exception as e:
            error_msg = f"Failed to update session {session_id}: {e!s}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e

    def get_therapy_session(self, session_id: str | UUID) -> dict[str, Any] | None:
        """Retrieve a therapy session by ID
        
        Args:
            session_id: Session UUID to retrieve
            
        Returns:
            Session record if found, None otherwise
            
        Raises:
            DatabaseOperationError: If retrieval fails
        """
        try:
            logger.info(f"🔍 Retrieving session: {session_id}")
            result = self.supabase.table("therapy_sessions").select("*").eq("id", str(session_id)).execute()

            if result.data:
                logger.info(f"✅ Found session: {session_id}")
                return result.data[0]
            else:
                logger.warning(f"⚠️ Session not found: {session_id}")
                return None

        except Exception as e:
            error_msg = f"Failed to retrieve session {session_id}: {e!s}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e

    def get_session_by_file_hash(self, file_hash: str) -> dict[str, Any] | None:
        """Find existing session by file hash to prevent duplicates
        
        Args:
            file_hash: SHA-256 hash of the C3D file
            
        Returns:
            Existing session if found, None otherwise
        """
        try:
            logger.info(f"🔍 Checking for duplicate session with hash: {file_hash[:16]}...")
            result = self.supabase.table("therapy_sessions").select("*").eq("file_hash", file_hash).execute()

            if result.data:
                session = result.data[0]
                logger.info(f"⚠️ Found duplicate session: {session['id']}")
                return session
            else:
                logger.info("✅ No duplicate session found")
                return None

        except Exception as e:
            logger.error(f"Failed to check for duplicate session: {e!s}")
            # Don't raise error for duplicate check - continue processing
            return None

    def get_patient_profile(self, patient_id: str | UUID) -> dict[str, Any] | None:
        """Retrieve patient profile information from new schema
        
        Args:
            patient_id: Patient UUID (new schema uses UUID)
            
        Returns:
            Patient profile from public.patients table if found, None otherwise
        """
        try:
            logger.info(f"👤 Retrieving patient profile: {patient_id}")
            result = self.supabase.table("patients").select(
                "id, patient_code, therapist_id, age_group, gender, pathology_category, created_at, active"
            ).eq("id", str(patient_id)).execute()

            if result.data:
                logger.info(f"✅ Found patient profile: {patient_id}")
                return result.data[0]
            else:
                logger.warning(f"⚠️ Patient profile not found: {patient_id}")
                return None

        except Exception as e:
            logger.error(f"Failed to retrieve patient profile {patient_id}: {e!s}")
            # Don't raise error for profile lookup - continue without profile data
            return None

    def get_user_profile(self, user_id: str | UUID) -> dict[str, Any] | None:
        """Retrieve unified user profile (therapists + researchers)
        
        Args:
            user_id: User UUID from auth.users
            
        Returns:
            User profile from public.user_profiles table if found, None otherwise
        """
        try:
            logger.info(f"👨‍⚕️ Retrieving user profile: {user_id}")
            result = self.supabase.table("user_profiles").select(
                "id, role, first_name, last_name, full_name, institution, department, access_level, active, created_at"
            ).eq("id", str(user_id)).execute()

            if result.data:
                logger.info(f"✅ Found user profile: {user_id} (role: {result.data[0].get('role')})")
                return result.data[0]
            else:
                logger.warning(f"⚠️ User profile not found: {user_id}")
                return None

        except Exception as e:
            logger.error(f"Failed to retrieve user profile {user_id}: {e!s}")
            return None

    def get_patient_pii(self, patient_id: str | UUID) -> dict[str, Any] | None:
        """Retrieve sensitive patient PII from private schema (therapists only)
        
        Args:
            patient_id: Patient UUID
            
        Returns:
            Patient PII from private.patient_pii table if found, None otherwise
        """
        try:
            logger.info(f"🔒 Retrieving patient PII: {patient_id}")
            result = self.supabase.table("patient_pii").select(
                "patient_id, first_name, last_name, date_of_birth, email, phone, medical_notes, emergency_contact"
            ).eq("patient_id", str(patient_id)).execute()

            if result.data:
                logger.info(f"✅ Found patient PII: {patient_id}")
                return result.data[0]
            else:
                logger.warning(f"⚠️ Patient PII not found: {patient_id}")
                return None

        except Exception as e:
            logger.error(f"Failed to retrieve patient PII {patient_id}: {e!s}")
            return None

    def create_patient(self, patient_data: dict[str, Any], pii_data: dict[str, Any] | None = None) -> dict[str, Any]:
        """Create a new patient with optional PII data
        
        Args:
            patient_data: Public patient data for patients table
            pii_data: Optional sensitive PII data for private.patient_pii table
            
        Returns:
            Created patient record
            
        Raises:
            DatabaseOperationError: If patient creation fails
        """
        try:
            logger.info(f"👤 Creating patient for therapist: {patient_data.get('therapist_id')}")

            # Create public patient record
            result = self.supabase.table("patients").insert(patient_data).execute()

            if not result.data:
                raise DatabaseOperationError("Failed to create patient - no data returned")

            patient = result.data[0]
            patient_id = patient["id"]

            # Create private PII record if provided
            if pii_data:
                pii_data["patient_id"] = patient_id
                pii_data["created_by"] = patient_data.get("therapist_id")

                try:
                    self.supabase.table("patient_pii").insert(pii_data).execute()
                    logger.info(f"✅ Created patient with PII: {patient_id}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to create PII data for patient {patient_id}: {e}")
            else:
                logger.info(f"✅ Created patient (no PII): {patient_id}")

            return patient

        except Exception as e:
            error_msg = f"Failed to create patient: {e!s}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e

    def bulk_insert_emg_statistics(self, stats_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Insert multiple EMG statistics records in a single operation
        
        Args:
            stats_data: List of EMG statistics records
            
        Returns:
            List of created records
            
        Raises:
            DatabaseOperationError: If bulk insert fails
        """
        try:
            logger.info(f"📊 Inserting {len(stats_data)} EMG statistics records")
            result = self.supabase.table("emg_statistics").insert(stats_data).execute()

            if not result.data:
                raise DatabaseOperationError("Failed to insert EMG statistics - no data returned")

            logger.info(f"✅ Inserted {len(result.data)} EMG statistics records")
            return result.data

        except Exception as e:
            error_msg = f"Failed to insert EMG statistics: {e!s}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e

    async def insert_processing_parameters(self, params_data: dict[str, Any]) -> dict[str, Any]:
        """Insert processing parameters record
        
        Args:
            params_data: Processing parameters dictionary
            
        Returns:
            Created parameters record
            
        Raises:
            DatabaseOperationError: If insert fails
        """
        try:
            logger.info("⚙️ Inserting processing parameters")
            result = self.supabase.table("processing_parameters").insert(params_data).execute()

            if not result.data:
                raise DatabaseOperationError("Failed to insert processing parameters")

            logger.info("✅ Processing parameters inserted")
            return result.data[0]

        except Exception as e:
            error_msg = f"Failed to insert processing parameters: {e!s}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e

    async def upsert_table_data(self, table_name: str, data: dict[str, Any],
                         unique_key: str = "session_id", unique_value: Any = None) -> dict[str, Any]:
        """Insert or update table data using upsert pattern
        
        Args:
            table_name: Target table name
            data: Data to insert or update
            unique_key: Key to check for existing records
            unique_value: Value to match for existing records
            
        Returns:
            Created or updated record
            
        Raises:
            DatabaseOperationError: If upsert fails
        """
        try:
            if unique_value is None:
                unique_value = data.get(unique_key)

            logger.info(f"🔄 Upserting {table_name} data for {unique_key}={unique_value}")

            # Try insert first (faster for new records)
            try:
                result = self.supabase.table(table_name).insert(data).execute()
                if result.data:
                    logger.info(f"✅ Inserted new record in {table_name}")
                    return result.data[0]
            except Exception:
                # If insert fails, try update
                logger.info(f"🔄 Insert failed, attempting update for {table_name}")
                update_result = self.supabase.table(table_name).update(data).eq(unique_key, unique_value).execute()

                if update_result.data:
                    logger.info(f"✅ Updated existing record in {table_name}")
                    return update_result.data[0]
                else:
                    # If update also fails, retry insert (race condition handling)
                    retry_result = self.supabase.table(table_name).insert(data).execute()
                    if retry_result.data:
                        logger.info(f"✅ Insert successful on retry for {table_name}")
                        return retry_result.data[0]

            raise DatabaseOperationError(f"Failed to upsert data in {table_name}")

        except Exception as e:
            error_msg = f"Failed to upsert {table_name} data: {e!s}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e

    # REMOVED: update_session_analytics_cache() - Migrated to Redis Cache Service
    # Analytics caching is now handled by services/cache/redis_cache_service.py
    # for ~100x performance improvement over database caching

    def update_session_status(self, session_id: str | UUID, status: str,
                            error_message: str | None = None) -> None:
        """Update session processing status
        
        Args:
            session_id: Session UUID
            status: New processing status
            error_message: Optional error message if status is 'error'
            
        Raises:
            DatabaseOperationError: If status update fails
        """
        try:
            update_data = {
                "processing_status": status,
                "updated_at": datetime.now().isoformat()
            }

            if error_message:
                update_data["processing_error_message"] = error_message

            logger.info(f"🔄 Updating session {session_id} status to: {status}")
            self.supabase.table("therapy_sessions").update(update_data).eq("id", str(session_id)).execute()
            logger.info(f"✅ Session status updated: {session_id} -> {status}")

        except Exception as e:
            error_msg = f"Failed to update session {session_id} status: {e!s}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
