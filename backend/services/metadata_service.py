"""
Metadata Service for C3D file metadata extraction and storage
Handles database operations for C3D metadata and implements frontend-consistent resolution patterns
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4
import re
from pathlib import Path

from ..database.supabase_client import get_supabase_client
from ..services.c3d_reader import C3DReader

logger = logging.getLogger(__name__)


class MetadataService:
    """Service for managing C3D file metadata with frontend-consistent resolution patterns"""
    
    def __init__(self):
        self.supabase = get_supabase_client(use_service_key=True)  # Use service key for admin operations
        self.c3d_reader = C3DReader()
    
    async def create_metadata_entry(
        self,
        file_path: str,
        file_hash: str,
        file_size_bytes: int,
        patient_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> UUID:
        """
        Create initial metadata entry with basic file information
        
        Args:
            file_path: Path to C3D file in storage
            file_hash: SHA-256 hash of file content
            file_size_bytes: File size in bytes
            patient_id: Optional patient ID from storage path
            session_id: Optional session ID from storage path
            metadata: Optional additional metadata from webhook
            
        Returns:
            UUID: ID of created metadata entry
        """
        metadata_id = uuid4()
        
        # Calculate size category using frontend logic
        size_category = self._get_size_category(file_size_bytes)
        
        # Prepare metadata entry
        entry = {
            "id": str(metadata_id),
            "file_path": file_path,
            "file_hash": file_hash,
            "file_size_bytes": file_size_bytes,
            "patient_id": patient_id,
            "session_id": session_id,
            "size_category": size_category,
            "bucket_name": "c3d-examples",
            "object_metadata": metadata or {},
            "processing_status": "pending"
        }
        
        try:
            result = self.supabase.table("c3d_metadata").insert(entry).execute()
            logger.info(f"Created metadata entry for file: {file_path}")
            return metadata_id
            
        except Exception as e:
            logger.error(f"Failed to create metadata entry: {str(e)}")
            raise
    
    async def extract_c3d_metadata(self, file_data: bytes) -> Dict[str, Any]:
        """
        Extract technical metadata from C3D file content
        
        Args:
            file_data: Raw C3D file bytes
            
        Returns:
            Dict containing C3D technical metadata
        """
        try:
            # Use C3D reader to extract metadata
            c3d_info = await self.c3d_reader.extract_metadata(file_data)
            
            return {
                "channel_names": c3d_info.get("channel_names", []),
                "channel_count": len(c3d_info.get("channel_names", [])),
                "sampling_rate": c3d_info.get("sampling_rate"),
                "duration_seconds": c3d_info.get("duration_seconds"),
                "frame_count": c3d_info.get("frame_count"),
                "game_metadata": c3d_info.get("game_metadata", {}),
                "session_duration": c3d_info.get("session_duration"),
                "session_notes": c3d_info.get("session_notes"),
                "therapist_id": c3d_info.get("therapist_id"),
                "player_name": c3d_info.get("player_name")
            }
            
        except Exception as e:
            logger.error(f"Failed to extract C3D metadata: {str(e)}")
            raise
    
    async def update_metadata(
        self,
        metadata_id: UUID,
        channel_names: List[str],
        channel_count: int,
        sampling_rate: float,
        duration_seconds: float,
        frame_count: int,
        **kwargs
    ) -> None:
        """
        Update metadata entry with extracted C3D information and resolved fields
        
        Args:
            metadata_id: UUID of metadata entry
            channel_names: List of EMG channel names
            channel_count: Number of channels
            sampling_rate: Sampling rate in Hz
            duration_seconds: Duration in seconds
            frame_count: Total frame count
            **kwargs: Additional metadata fields
        """
        try:
            # Get current metadata for resolution
            current = self.supabase.table("c3d_metadata").select("*").eq("id", str(metadata_id)).execute()
            
            if not current.data:
                raise ValueError(f"Metadata entry not found: {metadata_id}")
                
            current_data = current.data[0]
            
            # Prepare update with technical metadata
            update_data = {
                "channel_names": channel_names,
                "channel_count": channel_count,
                "sampling_rate": sampling_rate,
                "duration_seconds": duration_seconds,
                "frame_count": frame_count,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # Add any additional metadata
            for key, value in kwargs.items():
                if value is not None:
                    update_data[key] = value
            
            # Apply frontend-consistent resolution patterns
            resolved_fields = self._resolve_metadata_fields(
                file_path=current_data["file_path"],
                file_size_bytes=current_data["file_size_bytes"],
                c3d_metadata=kwargs,
                storage_metadata={
                    "patient_id": current_data.get("patient_id"),
                    "therapist_id": current_data.get("therapist_id")
                }
            )
            
            update_data.update(resolved_fields)
            
            # Update the database
            result = self.supabase.table("c3d_metadata").update(update_data).eq("id", str(metadata_id)).execute()
            
            logger.info(f"Updated metadata for entry: {metadata_id}")
            
        except Exception as e:
            logger.error(f"Failed to update metadata: {str(e)}")
            raise
    
    def _resolve_metadata_fields(
        self,
        file_path: str,
        file_size_bytes: int,
        c3d_metadata: Dict[str, Any],
        storage_metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply frontend-consistent metadata resolution patterns
        
        Args:
            file_path: Path to C3D file
            file_size_bytes: File size in bytes  
            c3d_metadata: Extracted C3D metadata
            storage_metadata: Storage-level metadata
            
        Returns:
            Dict with resolved metadata fields
        """
        resolved = {}
        
        # Patient ID resolution (consistent with FileMetadataBar and C3DFileDataResolver)
        # Priority: 1) Subfolder pattern, 2) C3D metadata.player_name, 3) storage metadata
        resolved_patient_id = self._resolve_patient_id(file_path, c3d_metadata, storage_metadata)
        resolved["resolved_patient_id"] = resolved_patient_id
        
        # Therapist ID resolution  
        # Priority: 1) C3D metadata.therapist_id, 2) storage metadata.therapist_id
        resolved_therapist_id = self._resolve_therapist_id(c3d_metadata, storage_metadata)
        resolved["resolved_therapist_id"] = resolved_therapist_id
        
        # Session date resolution (consistent with FileMetadataBar and C3DFileDataResolver)
        # Priority: 1) Filename pattern, 2) C3D metadata.session_date, 3) C3D metadata.time
        resolved_session_date = self._resolve_session_date(file_path, c3d_metadata)
        if resolved_session_date:
            resolved["resolved_session_date"] = resolved_session_date
        
        # Update game metadata with resolved information
        game_metadata = c3d_metadata.get("game_metadata", {})
        if c3d_metadata.get("player_name"):
            game_metadata["player_name"] = c3d_metadata["player_name"]
        if c3d_metadata.get("therapist_id"):
            game_metadata["therapist_id"] = c3d_metadata["therapist_id"]
        
        if game_metadata:
            resolved["game_metadata"] = game_metadata
        
        return resolved
    
    def _resolve_patient_id(self, file_path: str, c3d_metadata: Dict, storage_metadata: Dict) -> str:
        """
        Resolve patient ID using frontend-consistent priority system
        Priority: 1) Subfolder pattern (P005/), 2) C3D metadata.player_name, 3) storage metadata
        """
        # Priority 1: Storage subfolder pattern
        subfolder_match = re.match(r'^(P\d{3})/', file_path)
        if subfolder_match:
            return subfolder_match.group(1)
        
        # Priority 2: C3D metadata player_name
        if c3d_metadata.get("player_name"):
            return str(c3d_metadata["player_name"])
        
        # Priority 3: Storage metadata patient_id
        if storage_metadata.get("patient_id"):
            return str(storage_metadata["patient_id"])
        
        # Priority 4: Filename pattern extraction
        filename_match = re.search(r'[_-](P\d{3})[_-]', file_path, re.IGNORECASE)
        if filename_match:
            return filename_match.group(1).upper()
        
        return "Unknown"
    
    def _resolve_therapist_id(self, c3d_metadata: Dict, storage_metadata: Dict) -> str:
        """
        Resolve therapist ID using frontend-consistent priority system
        Priority: 1) C3D metadata.therapist_id, 2) storage metadata.therapist_id
        """
        # Priority 1: C3D metadata
        if c3d_metadata.get("therapist_id"):
            return str(c3d_metadata["therapist_id"])
        
        # Priority 2: Storage metadata
        if storage_metadata.get("therapist_id"):
            return str(storage_metadata["therapist_id"])
        
        return "Unknown"
    
    def _resolve_session_date(self, file_path: str, c3d_metadata: Dict) -> Optional[str]:
        """
        Resolve session date using frontend-consistent priority system
        Priority: 1) Filename extraction, 2) C3D metadata.session_date, 3) C3D metadata.time
        """
        # Priority 1: Filename extraction (consistent with C3DFileDataResolver)
        extracted_date = self._extract_date_from_filename(file_path)
        if extracted_date:
            return extracted_date
        
        # Priority 2: C3D metadata session_date
        if c3d_metadata.get("session_date"):
            return str(c3d_metadata["session_date"])
        
        # Priority 3: C3D metadata time field
        if c3d_metadata.get("time"):
            return str(c3d_metadata["time"])
        
        return None
    
    def _extract_date_from_filename(self, filename: str) -> Optional[str]:
        """
        Extract date from filename using patterns from C3DFileDataResolver
        Patterns: YYYYMMDD, YYYY-MM-DD, DD-MM-YYYY
        """
        # Pattern 1 & 2: YYYYMMDD format
        yyyymmdd = re.search(r'(\d{4})(\d{2})(\d{2})', filename)
        if yyyymmdd:
            year, month, day = yyyymmdd.groups()
            year_num = int(year)
            if 2020 <= year_num <= 2030:
                return f"{year}-{month}-{day}"
        
        # Pattern 3: YYYY-MM-DD format
        iso_date = re.search(r'(\d{4})-(\d{2})-(\d{2})', filename)
        if iso_date:
            year, month, day = iso_date.groups()
            year_num = int(year)
            if 2020 <= year_num <= 2030:
                return f"{year}-{month}-{day}"
        
        # Pattern 4: DD-MM-YYYY format
        ddmmyyyy = re.search(r'(\d{2})-(\d{2})-(\d{4})', filename)
        if ddmmyyyy:
            day, month, year = ddmmyyyy.groups()
            year_num = int(year)
            if 2020 <= year_num <= 2030:
                return f"{year}-{month}-{day}"
        
        return None
    
    def _get_size_category(self, bytes_size: int) -> str:
        """
        Get size category using frontend logic (from getSizeCategory)
        """
        if bytes_size < 2000000:  # < 2MB
            return "small"
        elif bytes_size < 3000000:  # < 3MB
            return "medium"
        else:
            return "large"
    
    async def get_by_file_hash(self, file_hash: str) -> Optional[Dict]:
        """Get metadata by file hash"""
        try:
            result = self.supabase.table("c3d_metadata").select("*").eq("file_hash", file_hash).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to get metadata by hash: {str(e)}")
            return None
    
    async def get_by_id(self, metadata_id: UUID) -> Optional[Dict]:
        """Get metadata by ID"""
        try:
            result = self.supabase.table("c3d_metadata").select("*").eq("id", str(metadata_id)).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to get metadata by ID: {str(e)}")
            return None
    
    async def update_processing_status(
        self,
        metadata_id: UUID,
        status: str,
        error_message: Optional[str] = None
    ) -> None:
        """Update processing status"""
        try:
            update_data = {
                "processing_status": status,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if status == "completed":
                update_data["processed_at"] = datetime.utcnow().isoformat()
            elif status == "failed" and error_message:
                update_data["error_message"] = error_message
            
            self.supabase.table("c3d_metadata").update(update_data).eq("id", str(metadata_id)).execute()
            
            logger.info(f"Updated processing status to {status} for metadata: {metadata_id}")
            
        except Exception as e:
            logger.error(f"Failed to update processing status: {str(e)}")
            raise