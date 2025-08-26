"""
Database Operations Service - Centralized Data Access Layer
=========================================================

🎯 PURPOSE: Eliminate DRY violations by centralizing database operations
- Single source of truth for all therapy session database operations
- Consistent error handling and logging across all database interactions
- Simplified testing and maintenance through service isolation

📊 SOLID COMPLIANCE:
- Single Responsibility: Only handles database operations
- Open/Closed: Extensible without modifying existing operations
- Dependency Inversion: Depends on Supabase client abstraction

Author: EMG C3D Analyzer Team - Architecture Refactoring
Date: 2025-08-26
"""

import logging
from typing import Dict, Any, Optional, List, Union
from uuid import UUID
from datetime import datetime

from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class DatabaseOperationError(Exception):
    """Raised when database operations fail"""
    pass


class TherapySessionDatabaseOperations:
    """
    Centralized database operations for therapy session management
    
    Eliminates DRY violations by providing reusable database operations
    with consistent error handling and logging patterns.
    """
    
    def __init__(self, supabase_client=None):
        """Initialize with dependency injection for testability"""
        self.supabase = supabase_client or get_supabase_client(use_service_key=True)
        logger.info("🗄️ Database operations service initialized")
    
    def create_therapy_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new therapy session record
        
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
            error_msg = f"Failed to create therapy session: {str(e)}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
    
    def update_therapy_session(self, session_id: Union[str, UUID], update_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update an existing therapy session record
        
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
            error_msg = f"Failed to update session {session_id}: {str(e)}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
    
    def get_therapy_session(self, session_id: Union[str, UUID]) -> Optional[Dict[str, Any]]:
        """
        Retrieve a therapy session by ID
        
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
            error_msg = f"Failed to retrieve session {session_id}: {str(e)}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
    
    def get_session_by_file_hash(self, file_hash: str) -> Optional[Dict[str, Any]]:
        """
        Find existing session by file hash to prevent duplicates
        
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
            logger.error(f"Failed to check for duplicate session: {str(e)}")
            # Don't raise error for duplicate check - continue processing
            return None
    
    def get_patient_profile(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve patient profile information
        
        Args:
            patient_id: Patient identifier
            
        Returns:
            Patient profile if found, None otherwise
        """
        try:
            logger.info(f"👤 Retrieving patient profile: {patient_id}")
            result = self.supabase.table("patient_profiles").select(
                "id, age, gender, height_cm, weight_kg, dominant_hand, medical_conditions"
            ).eq("id", patient_id).execute()
            
            if result.data:
                logger.info(f"✅ Found patient profile: {patient_id}")
                return result.data[0]
            else:
                logger.warning(f"⚠️ Patient profile not found: {patient_id}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to retrieve patient profile {patient_id}: {str(e)}")
            # Don't raise error for profile lookup - continue without profile data
            return None
    
    def bulk_insert_emg_statistics(self, stats_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Insert multiple EMG statistics records in a single operation
        
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
            error_msg = f"Failed to insert EMG statistics: {str(e)}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
    
    async def insert_processing_parameters(self, params_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Insert processing parameters record
        
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
            error_msg = f"Failed to insert processing parameters: {str(e)}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
    
    async def upsert_table_data(self, table_name: str, data: Dict[str, Any], 
                         unique_key: str = "session_id", unique_value: Any = None) -> Dict[str, Any]:
        """
        Insert or update table data using upsert pattern
        
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
            error_msg = f"Failed to upsert {table_name} data: {str(e)}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
    
    def update_session_analytics_cache(self, session_id: Union[str, UUID], 
                                     cache_data: Dict[str, Any]) -> None:
        """
        Update session analytics cache fields
        
        Args:
            session_id: Session UUID
            cache_data: Analytics data to cache
            
        Raises:
            DatabaseOperationError: If cache update fails
        """
        try:
            logger.info(f"📈 Updating analytics cache for session: {session_id}")
            self.supabase.table("therapy_sessions").update(cache_data).eq("id", str(session_id)).execute()
            logger.info(f"✅ Analytics cache updated for session: {session_id}")
            
        except Exception as e:
            error_msg = f"Failed to update analytics cache for session {session_id}: {str(e)}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
    
    def update_session_status(self, session_id: Union[str, UUID], status: str, 
                            error_message: Optional[str] = None) -> None:
        """
        Update session processing status
        
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
            error_msg = f"Failed to update session {session_id} status: {str(e)}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e