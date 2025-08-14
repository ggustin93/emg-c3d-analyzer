"""
Therapy Session Processor - Core Business Logic
==============================================

Single Responsibility: Manage therapy session lifecycle and C3D processing.
Works with actual database schema (therapy_sessions, emg_statistics, etc.)

SOLID Principles:
- S: Single responsibility - therapy session management
- O: Open for extension - pluggable analysis modules  
- L: Liskov substitution - consistent interface
- I: Interface segregation - focused public methods
- D: Dependency inversion - depends on abstractions

Author: EMG C3D Analyzer Team
Date: 2025-08-14
"""

import hashlib
import logging
import tempfile
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from uuid import UUID, uuid4

from database.supabase_client import get_supabase_client
from services.c3d_processor import GHOSTLYC3DProcessor
from services.c3d_reader import C3DReader
from models.models import ProcessingOptions, GameSessionParameters
from config import (
    DEFAULT_THRESHOLD_FACTOR,
    DEFAULT_MIN_DURATION_MS, 
    DEFAULT_SMOOTHING_WINDOW,
    DEFAULT_MVC_THRESHOLD_PERCENTAGE,
    DEFAULT_LOWPASS_CUTOFF,
    DEFAULT_FILTER_ORDER,
    DEFAULT_RMS_WINDOW_MS,
    PROCESSING_VERSION
)

logger = logging.getLogger(__name__)


class TherapySessionProcessor:
    """
    Core processor for therapy sessions and C3D file analysis.
    
    Manages the complete lifecycle:
    1. Create therapy_sessions record
    2. Process C3D file 
    3. Populate related tables (emg_statistics, c3d_technical_data, etc.)
    4. Calculate performance scores
    5. Update session with results
    """
    
    def __init__(self):
        self.supabase = get_supabase_client(use_service_key=True)
        self.c3d_reader = C3DReader()
    
    async def create_session(
        self,
        file_path: str,
        file_metadata: Dict[str, Any],
        patient_id: Optional[str] = None,
        therapist_id: Optional[str] = None
    ) -> str:
        """
        Create new therapy session record
        
        Args:
            file_path: Storage path to C3D file
            file_metadata: File metadata from storage
            patient_id: Optional patient ID
            therapist_id: Optional therapist ID
            
        Returns:
            str: Created session UUID
        """
        try:
            # Generate file hash for deduplication
            file_hash = await self._calculate_file_hash_from_path(file_path)
            
            # Check for existing session with same file hash
            existing = await self._find_existing_session(file_hash)
            if existing:
                logger.info(f"♻️ Found existing session: {existing['id']}")
                return str(existing['id'])
            
            session_data = {
                "id": str(uuid4()),
                "file_path": file_path,
                "file_hash": file_hash,
                "file_size_bytes": file_metadata.get("size", 0),
                "patient_id": patient_id,
                "therapist_id": therapist_id,
                "processing_status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "analytics_cache": {},
                "game_metadata": {}
            }
            
            result = self.supabase.table("therapy_sessions").insert(session_data).execute()
            
            if not result.data:
                raise Exception("Failed to create therapy session")
            
            session_id = result.data[0]["id"]
            logger.info(f"✅ Created therapy session: {session_id}")
            
            return session_id
            
        except Exception as e:
            logger.error(f"Failed to create session: {str(e)}", exc_info=True)
            raise
    
    async def process_c3d_file(
        self,
        session_id: str,
        bucket: str,
        object_path: str
    ) -> Dict[str, Any]:
        """
        Complete C3D file processing
        
        Args:
            session_id: Therapy session UUID
            bucket: Storage bucket name  
            object_path: Path to C3D file in storage
            
        Returns:
            Dict with processing results
        """
        try:
            # Download C3D file
            file_data = await self._download_file(bucket, object_path)
            
            # Save to temporary file for processing
            with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp_file:
                tmp_file.write(file_data)
                tmp_file_path = tmp_file.name
            
            try:
                # Process C3D file
                processor = GHOSTLYC3DProcessor(tmp_file_path)
                
                # Default processing options
                processing_opts = ProcessingOptions(
                    threshold_factor=DEFAULT_THRESHOLD_FACTOR,
                    min_duration_ms=DEFAULT_MIN_DURATION_MS,
                    smoothing_window=DEFAULT_SMOOTHING_WINDOW
                )
                
                session_params = GameSessionParameters(
                    session_mvc_threshold_percentage=DEFAULT_MVC_THRESHOLD_PERCENTAGE
                )
                
                # Process file
                result = processor.process_file(
                    processing_opts=processing_opts,
                    session_game_params=session_params
                )
                
                # Populate database tables
                await self._populate_database_tables(
                    session_id=session_id,
                    processing_result=result,
                    file_data=file_data,
                    processing_opts=processing_opts
                )
                
                # Update session with analytics cache
                await self._update_session_cache(session_id, result)
                
                return {
                    "success": True,
                    "channels_analyzed": len(result.get("analytics", {})),
                    "overall_score": self._calculate_overall_score(result),
                    "processing_result": result
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
                    
        except Exception as e:
            logger.error(f"C3D processing failed: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def update_session_status(
        self,
        session_id: str,
        status: str,
        error_message: Optional[str] = None
    ) -> None:
        """
        Update therapy session processing status
        
        Args:
            session_id: Session UUID
            status: New status (pending, processing, completed, failed)
            error_message: Optional error message if status is failed
        """
        try:
            update_data = {
                "processing_status": status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if status == "completed":
                update_data["processed_at"] = datetime.now(timezone.utc).isoformat()
            elif status == "failed" and error_message:
                update_data["processing_error_message"] = error_message
            
            self.supabase.table("therapy_sessions").update(update_data).eq("id", session_id).execute()
            
            logger.info(f"📊 Session {session_id} status: {status}")
            
        except Exception as e:
            logger.error(f"Failed to update session status: {str(e)}", exc_info=True)
            raise
    
    async def get_session_status(self, session_id: str) -> Optional[Dict]:
        """
        Get therapy session status and data
        
        Args:
            session_id: Session UUID
            
        Returns:
            Session data or None if not found
        """
        try:
            result = self.supabase.table("therapy_sessions").select("*").eq("id", session_id).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get session status: {str(e)}", exc_info=True)
            return None
    
    # === PRIVATE METHODS ===
    
    async def _calculate_file_hash_from_path(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file from storage path"""
        try:
            # Extract bucket and object path
            parts = file_path.split("/", 1)
            if len(parts) != 2:
                raise ValueError(f"Invalid file path format: {file_path}")
            
            bucket, object_path = parts
            file_data = await self._download_file(bucket, object_path)
            
            return hashlib.sha256(file_data).hexdigest()
            
        except Exception as e:
            logger.error(f"Failed to calculate file hash: {str(e)}")
            # Fallback to path-based hash for uniqueness
            return hashlib.sha256(file_path.encode()).hexdigest()
    
    async def _download_file(self, bucket: str, object_path: str) -> bytes:
        """Download file from Supabase Storage"""
        try:
            response = self.supabase.storage.from_(bucket).download(object_path)
            
            if not response:
                raise ValueError(f"Failed to download: {bucket}/{object_path}")
            
            return response
            
        except Exception as e:
            logger.error(f"Download failed: {str(e)}")
            raise
    
    async def _find_existing_session(self, file_hash: str) -> Optional[Dict]:
        """Find existing session with same file hash"""
        try:
            result = self.supabase.table("therapy_sessions").select("*").eq("file_hash", file_hash).execute()
            
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Error finding existing session: {str(e)}")
            return None
    
    async def _populate_database_tables(
        self,
        session_id: str,
        processing_result: Dict[str, Any],
        file_data: bytes,
        processing_opts: ProcessingOptions
    ) -> None:
        """
        Populate all related database tables
        
        Tables populated:
        - c3d_technical_data
        - emg_statistics (per channel)
        - processing_parameters  
        - performance_scores
        """
        try:
            # C3D Technical Data
            metadata = processing_result.get("metadata", {})
            technical_data = {
                "session_id": session_id,
                "original_sampling_rate": metadata.get("sampling_rate", 1000.0),
                "original_duration_seconds": metadata.get("duration_seconds", 0.0),
                "original_sample_count": metadata.get("frame_count", 0),
                "channel_count": len(processing_result.get("analytics", {})),
                "channel_names": list(processing_result.get("analytics", {}).keys()),
                "sampling_rate": metadata.get("sampling_rate", 1000.0),
                "duration_seconds": metadata.get("duration_seconds", 0.0),
                "frame_count": metadata.get("frame_count", 0),
                "extracted_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self._upsert_table("c3d_technical_data", technical_data, "session_id")
            
            # EMG Statistics (per channel)
            analytics = processing_result.get("analytics", {})
            for channel_name, channel_data in analytics.items():
                # Use default clinical values when not available from C3D metadata
                DEFAULT_MVC_THRESHOLD_VALUE = 1e-5  # 10μV - reasonable EMG threshold
                DEFAULT_MVC_VALUE = channel_data.get("mvc_threshold", DEFAULT_MVC_THRESHOLD_VALUE) / 0.75  # Reverse calculate from 75%
                
                stats_data = {
                    "session_id": session_id,
                    "channel_name": channel_name,
                    "total_contractions": channel_data.get("total_contractions", 0),
                    "good_contractions": channel_data.get("good_contractions", 0),
                    "compliance_rate": channel_data.get("compliance_rate", 0.0),
                    "mvc_value": channel_data.get("mvc_value", DEFAULT_MVC_VALUE),
                    "mvc_threshold": max(channel_data.get("mvc_threshold", DEFAULT_MVC_THRESHOLD_VALUE), DEFAULT_MVC_THRESHOLD_VALUE),
                    "mvc_threshold_actual_value": 75.0,  # Default 75% MVC threshold
                    "duration_threshold_actual_value": 2000.0,  # Default 2 seconds duration threshold  
                    "total_time_under_tension_ms": channel_data.get("total_time_under_tension_ms", 0.0),
                    "avg_duration_ms": channel_data.get("avg_duration_ms", 0.0),
                    "max_duration_ms": channel_data.get("max_duration_ms", 0.0),
                    "min_duration_ms": channel_data.get("min_duration_ms", 0.0),
                    "avg_amplitude": channel_data.get("avg_amplitude", 0.0),
                    "max_amplitude": channel_data.get("max_amplitude", 0.0),
                    "rms_mean": channel_data.get("rms_mean", 0.0),
                    "rms_std": channel_data.get("rms_std", 0.0),
                    "signal_quality_score": channel_data.get("signal_quality_score", 0.0),
                    "processing_confidence": channel_data.get("processing_confidence", 0.0),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                
                # Insert EMG statistics record
                self.supabase.table("emg_statistics").insert(stats_data).execute()
            
            # Processing Parameters - Use config values
            # Get actual sampling rate from metadata
            sampling_rate = metadata.get("sampling_rate", 1000.0)
            
            # Calculate Nyquist-compliant high cutoff (must be < sampling_rate/2)
            # Use 90% of Nyquist frequency to safely satisfy the constraint
            nyquist_freq = sampling_rate / 2
            safe_high_cutoff = min(DEFAULT_LOWPASS_CUTOFF, nyquist_freq * 0.9)
            
            params_data = {
                "session_id": session_id,
                "sampling_rate_hz": sampling_rate,
                "filter_low_cutoff_hz": 20.0,  # Standard EMG high-pass
                "filter_high_cutoff_hz": safe_high_cutoff,  # Nyquist-compliant
                "filter_order": DEFAULT_FILTER_ORDER,  # From config.py
                "rms_window_ms": DEFAULT_RMS_WINDOW_MS,  # From config.py
                "rms_overlap_percent": 50.0,
                "mvc_window_seconds": 3.0,
                "mvc_threshold_percentage": processing_opts.threshold_factor * 100,
                "processing_version": PROCESSING_VERSION,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            self.supabase.table("processing_parameters").insert(params_data).execute()
            
            # Performance Scores (basic calculation)
            overall_score = self._calculate_overall_score(processing_result)
            compliance_score = self._calculate_compliance_score(analytics)
            
            scores_data = {
                "session_id": session_id,
                "overall_score": overall_score,
                "compliance_score": compliance_score,
                "symmetry_score": self._calculate_symmetry_score(analytics),
                "effort_score": self._calculate_effort_score(analytics),
                "bfr_compliant": True,  # Default until BFR data available
                "bfr_pressure_aop": 50.0,  # Default 50% AOP
                "rpe_post_session": 5,  # Default RPE 5 (moderate effort on 0-10 scale)
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self._upsert_table("performance_scores", scores_data, "session_id")
            
            logger.info(f"📊 Populated all database tables for session: {session_id}")
            
        except Exception as e:
            logger.error(f"Failed to populate database tables: {str(e)}", exc_info=True)
            raise
    
    async def _upsert_table(self, table_name: str, data: Dict, unique_key: str) -> None:
        """Upsert data into table (insert or update if exists)"""
        try:
            # Try insert first
            result = self.supabase.table(table_name).insert(data).execute()
            
            if not result.data:
                # If insert failed, try update
                unique_value = data[unique_key]
                self.supabase.table(table_name).update(data).eq(unique_key, unique_value).execute()
                
        except Exception as e:
            # If insert failed due to unique constraint, try update
            unique_value = data[unique_key]
            self.supabase.table(table_name).update(data).eq(unique_key, unique_value).execute()
    
    async def _update_session_cache(self, session_id: str, processing_result: Dict) -> None:
        """Update session analytics cache"""
        try:
            cache_data = {
                "analytics_cache": {
                    "channels": list(processing_result.get("analytics", {}).keys()),
                    "summary": {
                        "total_channels": len(processing_result.get("analytics", {})),
                        "overall_compliance": self._calculate_compliance_score(processing_result.get("analytics", {})),
                        "cached_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                "processing_time_ms": processing_result.get("processing_time_ms", 0),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            self.supabase.table("therapy_sessions").update(cache_data).eq("id", session_id).execute()
            
        except Exception as e:
            logger.error(f"Failed to update session cache: {str(e)}")
            # Not critical, continue processing
    
    def _calculate_overall_score(self, processing_result: Dict) -> float:
        """Calculate overall performance score"""
        analytics = processing_result.get("analytics", {})
        if not analytics:
            return 0.0
        
        # Simple average of compliance rates
        compliance_scores = [
            channel.get("compliance_rate", 0.0) 
            for channel in analytics.values()
        ]
        
        return sum(compliance_scores) / len(compliance_scores) if compliance_scores else 0.0
    
    def _calculate_compliance_score(self, analytics: Dict) -> float:
        """Calculate compliance score from analytics"""
        if not analytics:
            return 0.0
        
        compliance_scores = [
            channel.get("compliance_rate", 0.0) 
            for channel in analytics.values()
        ]
        
        return sum(compliance_scores) / len(compliance_scores) if compliance_scores else 0.0
    
    def _calculate_symmetry_score(self, analytics: Dict) -> Optional[float]:
        """Calculate symmetry score if bilateral channels exist"""
        # Look for left/right channel pairs
        left_channels = {k: v for k, v in analytics.items() if 'L' in k.upper()}
        right_channels = {k: v for k, v in analytics.items() if 'R' in k.upper()}
        
        if not (left_channels and right_channels):
            return None
        
        # Simple symmetry calculation
        left_avg = sum(ch.get("compliance_rate", 0) for ch in left_channels.values()) / len(left_channels)
        right_avg = sum(ch.get("compliance_rate", 0) for ch in right_channels.values()) / len(right_channels)
        
        # Symmetry as 1 - abs(difference)
        return max(0.0, 1.0 - abs(left_avg - right_avg))
    
    def _calculate_effort_score(self, analytics: Dict) -> Optional[float]:
        """Calculate effort score based on intensity metrics"""
        if not analytics:
            return None
        
        # Use average amplitude as effort proxy
        amplitudes = [
            channel.get("avg_amplitude", 0.0) 
            for channel in analytics.values()
        ]
        
        avg_amplitude = sum(amplitudes) / len(amplitudes) if amplitudes else 0.0
        
        # Normalize to 0-1 scale (assuming max expected amplitude)
        max_expected_amplitude = 1000.0  # Adjust based on your data
        return min(1.0, avg_amplitude / max_expected_amplitude)