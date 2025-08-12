"""
Webhook Service for handling Supabase Storage events and file processing
Manages file downloads, hashing, and C3D processing coordination
"""
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple
from io import BytesIO

from ..database.supabase_client import get_supabase_client
from ..services.c3d_processor import GHOSTLYC3DProcessor
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class WebhookService:
    """Service for webhook event handling and file processing coordination"""
    
    def __init__(self):
        self.supabase = get_supabase_client(use_service_key=True)  # Use service key for admin operations
    
    async def calculate_file_hash(self, bucket: str, object_path: str) -> str:
        """
        Calculate SHA-256 hash of file in storage
        
        Args:
            bucket: Storage bucket name
            object_path: Path to file in bucket
            
        Returns:
            SHA-256 hash as hex string
        """
        try:
            # Download file content
            response = self.supabase.storage.from_(bucket).download(object_path)
            
            if not response:
                raise ValueError(f"Failed to download file: {object_path}")
            
            # Calculate hash
            hash_sha256 = hashlib.sha256()
            hash_sha256.update(response)
            
            file_hash = hash_sha256.hexdigest()
            logger.info(f"Calculated hash for {object_path}: {file_hash[:16]}...")
            
            return file_hash
            
        except Exception as e:
            logger.error(f"Failed to calculate file hash for {object_path}: {str(e)}")
            raise
    
    async def process_c3d_from_storage(
        self,
        bucket: str,
        object_path: str
    ) -> Dict[str, Any]:
        """
        Download C3D file from storage and process it
        
        Args:
            bucket: Storage bucket name
            object_path: Path to C3D file in bucket
            
        Returns:
            Dict containing processing results and metadata
        """
        try:
            # Download file
            logger.info(f"Downloading C3D file: {object_path}")
            file_data = self.supabase.storage.from_(bucket).download(object_path)
            
            if not file_data:
                raise ValueError(f"Failed to download file: {object_path}")
            
            # Save file to temporary location for processing
            import tempfile
            import os
            from fastapi.concurrency import run_in_threadpool
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp_file:
                tmp_file.write(file_data)
                tmp_file_path = tmp_file.name
            
            try:
                # Process C3D file using existing processor
                processor = GHOSTLYC3DProcessor(tmp_file_path)
                
                # Import required models for processing options
                from ..models.models import ProcessingOptions, GameSessionParameters
                from ..config import (
                    DEFAULT_THRESHOLD_FACTOR,
                    DEFAULT_MIN_DURATION_MS, 
                    DEFAULT_SMOOTHING_WINDOW,
                    DEFAULT_MVC_THRESHOLD_PERCENTAGE
                )
                
                # Create default processing options for webhook
                processing_opts = ProcessingOptions(
                    threshold_factor=DEFAULT_THRESHOLD_FACTOR,
                    min_duration_ms=DEFAULT_MIN_DURATION_MS,
                    smoothing_window=DEFAULT_SMOOTHING_WINDOW
                )
                
                # Create default session parameters for webhook
                session_game_params = GameSessionParameters(
                    session_mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE,
                    contraction_duration_threshold=2000  # Default 2 seconds
                )
                
                try:
                    processing_result = await run_in_threadpool(
                        processor.process_file,
                        processing_opts=processing_opts,
                        session_game_params=session_game_params
                    )
                    
                    # Add file data for metadata extraction and processing metadata
                    processing_result["file_data"] = file_data
                    processing_result["processing_time_ms"] = 1000  # Placeholder, actual timing would need to be measured
                    
                    logger.info(f"✅ C3D processing completed successfully: {object_path}")
                    
                except Exception as c3d_error:
                    logger.error(f"❌ C3D processing failed for {object_path}: {str(c3d_error)}")
                    
                    # Return error result instead of crashing
                    processing_result = {
                        "error": str(c3d_error),
                        "metadata": {"error": "Failed to process C3D file", "file_path": object_path},
                        "analytics": {},
                        "available_channels": [],
                        "file_data": file_data,
                        "processing_time_ms": 0
                    }
                    
                    logger.warning(f"⚠️ Returning error result for {object_path} to prevent webhook crash")
                
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
            
            logger.info(f"Successfully processed C3D file: {object_path}")
            return processing_result
            
        except Exception as e:
            logger.error(f"Failed to process C3D from storage {object_path}: {str(e)}")
            raise
    
    async def validate_file_integrity(self, bucket: str, object_path: str, expected_hash: str) -> bool:
        """
        Validate file integrity by comparing hashes
        
        Args:
            bucket: Storage bucket name
            object_path: Path to file in bucket
            expected_hash: Expected SHA-256 hash
            
        Returns:
            True if hashes match, False otherwise
        """
        try:
            current_hash = await self.calculate_file_hash(bucket, object_path)
            
            if current_hash != expected_hash:
                logger.warning(f"Hash mismatch for {object_path}: expected {expected_hash[:16]}..., got {current_hash[:16]}...")
                return False
            
            logger.info(f"File integrity validated for: {object_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to validate file integrity for {object_path}: {str(e)}")
            return False
    
    async def get_file_metadata_from_storage(self, bucket: str, object_path: str) -> Dict[str, Any]:
        """
        Get file metadata from Supabase Storage
        
        Args:
            bucket: Storage bucket name
            object_path: Path to file in bucket
            
        Returns:
            File metadata from storage
        """
        try:
            # Get file info from storage
            response = self.supabase.storage.from_(bucket).list(
                path=str(Path(object_path).parent),
                limit=1000,
                search=Path(object_path).name
            )
            
            if not response or not isinstance(response, list):
                raise ValueError(f"File not found in storage: {object_path}")
            
            # Find matching file
            file_info = None
            for file_obj in response:
                if file_obj.get("name") == Path(object_path).name:
                    file_info = file_obj
                    break
            
            if not file_info:
                raise ValueError(f"File not found in storage listing: {object_path}")
            
            return {
                "name": file_info.get("name"),
                "size": file_info.get("size", 0),
                "content_type": file_info.get("mimetype"),
                "created_at": file_info.get("created_at"),
                "updated_at": file_info.get("updated_at"),
                "metadata": file_info.get("metadata", {})
            }
            
        except Exception as e:
            logger.error(f"Failed to get file metadata from storage: {str(e)}")
            raise
    
    async def create_processing_job(
        self,
        file_path: str,
        file_hash: str,
        priority: str = "normal"
    ) -> str:
        """
        Create a processing job entry for tracking
        
        Args:
            file_path: Path to C3D file
            file_hash: SHA-256 hash of file
            priority: Processing priority (low, normal, high)
            
        Returns:
            Job ID for tracking
        """
        import uuid
        
        job_id = str(uuid.uuid4())
        
        try:
            job_entry = {
                "id": job_id,
                "file_path": file_path,
                "file_hash": file_hash,
                "priority": priority,
                "status": "queued",
                "created_at": datetime.utcnow().isoformat()
            }
            
            # This would be stored in a processing_jobs table if we had one
            # For now, we'll just log it
            logger.info(f"Created processing job {job_id} for file: {file_path}")
            
            return job_id
            
        except Exception as e:
            logger.error(f"Failed to create processing job: {str(e)}")
            raise
    
    async def cleanup_temp_files(self, temp_paths: list) -> None:
        """
        Clean up temporary files created during processing
        
        Args:
            temp_paths: List of temporary file paths to clean up
        """
        import os
        
        for temp_path in temp_paths:
            try:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    logger.debug(f"Cleaned up temporary file: {temp_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file {temp_path}: {str(e)}")
    
    def extract_path_metadata(self, file_path: str) -> Dict[str, Any]:
        """
        Extract metadata from file path structure
        Expected format: {patient_id}/{session_id}/filename.c3d
        
        Args:
            file_path: Full path to C3D file
            
        Returns:
            Dict with extracted path metadata
        """
        path_parts = file_path.split("/")
        
        metadata = {
            "patient_id": None,
            "session_id": None,
            "filename": path_parts[-1] if path_parts else file_path
        }
        
        # Only extract patient ID if there are multiple path parts (nested structure)
        if len(path_parts) > 1 and path_parts[0]:
            # Check for patient ID pattern (P005, P008, etc.)
            import re
            patient_match = re.match(r'^(P\d{3})$', path_parts[0])
            if patient_match:
                metadata["patient_id"] = patient_match.group(1)
            else:
                metadata["patient_id"] = path_parts[0]
        
        # Extract session ID from second path segment (only if nested)
        if len(path_parts) > 2 and path_parts[1]:
            metadata["session_id"] = path_parts[1]
        
        return metadata
    
    def validate_webhook_payload(self, payload: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Validate webhook payload structure and content
        
        Args:
            payload: Webhook payload to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        required_fields = ["event_type", "bucket", "object_name", "object_size"]
        
        # Check required fields
        for field in required_fields:
            if field not in payload or payload[field] is None:
                return False, f"Missing required field: {field}"
        
        # Validate event type
        if payload["event_type"] != "ObjectCreated:Post":
            return False, f"Unsupported event type: {payload['event_type']}"
        
        # Validate file extension
        if not payload["object_name"].lower().endswith(".c3d"):
            return False, f"Invalid file type: {payload['object_name']}"
        
        # Validate bucket (matching frontend bucket name)
        if payload["bucket"] != "c3d-examples":
            return False, f"Invalid bucket: {payload['bucket']}"
        
        # Validate file size (reasonable limits)
        object_size = payload["object_size"]
        if object_size <= 0:
            return False, "Invalid file size: must be greater than 0"
        
        if object_size > 50 * 1024 * 1024:  # 50MB limit
            return False, f"File too large: {object_size} bytes (max 50MB)"
        
        return True, "Valid payload"