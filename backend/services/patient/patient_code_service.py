"""Patient Code Service.

T012: Backend patient code extraction and resolution service.
Provides patient code derivation from patient_id, filenames, and session metadata.
Following backend CLAUDE.md: KISS principle, Repository pattern, synchronous Supabase client.
"""

import logging
import re
from typing import Optional, Dict, Any
from uuid import UUID
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PatientCodeResult:
    """Patient code extraction result with source tracking."""
    patient_code: Optional[str]
    source: str  # 'patient_id', 'filename', 'session_metadata', 'unknown'
    confidence: str  # 'high', 'medium', 'low'


class PatientCodeService:
    """Patient code extraction and resolution service.
    
    Provides patient code derivation using multiple strategies:
    1. Database lookup via patient_id (highest confidence)
    2. Filename pattern matching (high confidence for valid patterns)
    3. Session metadata extraction (medium confidence)
    4. Fallback pattern matching (low confidence)
    
    Following backend CLAUDE.md: Repository pattern, synchronous client, domain organization.
    """

    def __init__(self, supabase_client):
        """Initialize service with Supabase client.
        
        Args:
            supabase_client: Synchronous Supabase client (CLAUDE.md #14)
        """
        self.supabase = supabase_client

    def extract_patient_code_from_patient_id(self, patient_id: str) -> PatientCodeResult:
        """Extract patient code from patient_id via database lookup.
        
        T012: Database integration for patient code resolution.
        Uses synchronous Supabase client following CLAUDE.md #14.
        
        Args:
            patient_id: UUID string for patient lookup
            
        Returns:
            PatientCodeResult with extraction details
        """
        if not patient_id or not isinstance(patient_id, str):
            return PatientCodeResult(
                patient_code=None,
                source='patient_id',
                confidence='low'
            )
        
        try:
            # Validate UUID format
            UUID(patient_id)
            
            # Query user_profiles table for patient code
            result = self.supabase.table('user_profiles').select('patient_code').eq('id', patient_id).single().execute()
            
            if result.data and result.data.get('patient_code'):
                patient_code = result.data['patient_code'].strip()
                
                # Validate P### format
                if self._validate_patient_code_format(patient_code):
                    return PatientCodeResult(
                        patient_code=patient_code.upper(),
                        source='patient_id',
                        confidence='high'
                    )
                else:
                    return PatientCodeResult(
                        patient_code=patient_code,
                        source='patient_id',
                        confidence='medium'
                    )
            
            # Fallback: Query sessions table for patient code
            session_result = self.supabase.table('sessions').select('patient_code').eq('user_id', patient_id).order('created_at', desc=True).limit(1).single().execute()
            
            if session_result.data and session_result.data.get('patient_code'):
                patient_code = session_result.data['patient_code'].strip()
                
                if self._validate_patient_code_format(patient_code):
                    return PatientCodeResult(
                        patient_code=patient_code.upper(),
                        source='patient_id',
                        confidence='high'
                    )
                else:
                    return PatientCodeResult(
                        patient_code=patient_code,
                        source='patient_id',
                        confidence='medium'
                    )
                    
        except Exception as e:
            logger.warning(f"Database lookup failed for patient_id {patient_id}: {e}")
        
        return PatientCodeResult(
            patient_code=None,
            source='patient_id',
            confidence='low'
        )

    def extract_patient_code_from_filename(self, filename: str) -> PatientCodeResult:
        """Extract patient code from filename pattern matching.
        
        T012: Robust pattern matching for P###/Ghostly_Emg_* and variants.
        
        Args:
            filename: Source filename to analyze
            
        Returns:
            PatientCodeResult with pattern match confidence
        """
        if not filename or not isinstance(filename, str):
            return PatientCodeResult(
                patient_code=None,
                source='filename',
                confidence='low'
            )
        
        # Clean filename: normalize paths and whitespace
        clean_filename = filename.strip().replace('\\', '/')
        
        # Pattern 1: P###/Ghostly_Emg_*.c3d (highest confidence)
        primary_pattern = r'(?:^|/)(P\d{3})/.*Ghostly_Emg_.*\.c3d$'
        match = re.search(primary_pattern, clean_filename, re.IGNORECASE)
        if match:
            return PatientCodeResult(
                patient_code=match.group(1).upper(),
                source='filename',
                confidence='high'
            )
        
        # Pattern 2: P###/any_file.c3d (high confidence)
        secondary_pattern = r'(?:^|/)(P\d{3})/.*\.c3d$'
        match = re.search(secondary_pattern, clean_filename, re.IGNORECASE)
        if match:
            return PatientCodeResult(
                patient_code=match.group(1).upper(),
                source='filename',
                confidence='high'
            )
        
        # Pattern 3: P###_anything.c3d (medium confidence)
        tertiary_pattern = r'(?:^|/)(P\d{3})_.*\.c3d$'
        match = re.search(tertiary_pattern, clean_filename, re.IGNORECASE)
        if match:
            return PatientCodeResult(
                patient_code=match.group(1).upper(),
                source='filename',
                confidence='medium'
            )
        
        # Pattern 4: P### anywhere in filename (low confidence)
        fallback_pattern = r'(P\d{3})'
        match = re.search(fallback_pattern, clean_filename, re.IGNORECASE)
        if match:
            return PatientCodeResult(
                patient_code=match.group(1).upper(),
                source='filename',
                confidence='medium'
            )
        
        # Pattern 5: p### (case insensitive, lowest confidence)
        case_insensitive_pattern = r'[Pp](\d{3})'
        match = re.search(case_insensitive_pattern, clean_filename)
        if match:
            return PatientCodeResult(
                patient_code=f"P{match.group(1)}",
                source='filename',
                confidence='low'
            )
        
        return PatientCodeResult(
            patient_code=None,
            source='filename',
            confidence='low'
        )

    def get_patient_code(self, analysis_result: Dict[str, Any]) -> PatientCodeResult:
        """Unified patient code extraction with fallback chain.
        
        T012: Comprehensive extraction logic with multiple sources.
        Priority: patient_id → filename → session_metadata → unknown
        
        Args:
            analysis_result: EMG analysis result dictionary
            
        Returns:
            PatientCodeResult with highest confidence available
        """
        if not analysis_result:
            return PatientCodeResult(
                patient_code=None,
                source='unknown',
                confidence='low'
            )
        
        # Strategy 1: Extract from patient_id (highest priority)
        patient_id = analysis_result.get('patient_id')
        if patient_id:
            result = self.extract_patient_code_from_patient_id(patient_id)
            if result.patient_code:
                return result
        
        # Strategy 2: Extract from source filename
        source_filename = analysis_result.get('source_filename')
        if source_filename:
            filename_result = self.extract_patient_code_from_filename(source_filename)
            if filename_result.patient_code and filename_result.confidence != 'low':
                return filename_result
            # Store low-confidence result as fallback
            low_confidence_fallback = filename_result if filename_result.confidence == 'low' else None
        
        # Strategy 3: Extract from session metadata
        metadata = analysis_result.get('metadata', {})
        if metadata:
            # Check for direct patient_code field
            if metadata.get('patient_code'):
                patient_code = str(metadata['patient_code']).strip()
                confidence = 'high' if self._validate_patient_code_format(patient_code) else 'medium'
                return PatientCodeResult(
                    patient_code=patient_code.upper(),
                    source='session_metadata',
                    confidence=confidence
                )
            
            # Check for patient_id in metadata
            metadata_patient_id = metadata.get('patient_id')
            if metadata_patient_id:
                metadata_result = self.extract_patient_code_from_patient_id(metadata_patient_id)
                if metadata_result.patient_code:
                    return PatientCodeResult(
                        patient_code=metadata_result.patient_code,
                        source='session_metadata',
                        confidence=metadata_result.confidence
                    )
            
            # Check for filename in metadata
            metadata_filename = metadata.get('filename') or metadata.get('source_filename')
            if metadata_filename:
                metadata_filename_result = self.extract_patient_code_from_filename(metadata_filename)
                if metadata_filename_result.patient_code and metadata_filename_result.confidence != 'low':
                    return PatientCodeResult(
                        patient_code=metadata_filename_result.patient_code,
                        source='session_metadata',
                        confidence=metadata_filename_result.confidence
                    )
        
        # Strategy 4: Return low-confidence filename result if available
        if low_confidence_fallback and low_confidence_fallback.patient_code:
            return low_confidence_fallback
        
        # Strategy 5: Last resort - check IDs
        for id_field in ['file_id', 'session_id', 'id']:
            id_value = analysis_result.get(id_field)
            if id_value and isinstance(id_value, str):
                id_result = self.extract_patient_code_from_filename(id_value)
                if id_result.patient_code:
                    return PatientCodeResult(
                        patient_code=id_result.patient_code,
                        source='session_metadata',
                        confidence='low'
                    )
        
        # No patient code found
        return PatientCodeResult(
            patient_code=None,
            source='unknown',
            confidence='low'
        )

    def _validate_patient_code_format(self, patient_code: str) -> bool:
        """Validate patient code follows P### format.
        
        Args:
            patient_code: Code to validate
            
        Returns:
            True if valid P### format
        """
        if not patient_code or not isinstance(patient_code, str):
            return False
        
        return bool(re.match(r'^P\d{3}$', patient_code.strip().upper()))

    def enhance_export_data_with_patient_code(self, export_data: Dict[str, Any], analysis_result: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance export data with patient code information.
        
        T013: Integration method for adding patient code to export data.
        
        Args:
            export_data: Existing export data dictionary
            analysis_result: Analysis result containing patient information
            
        Returns:
            Enhanced export data with patient code metadata
        """
        try:
            # Get patient code using unified extraction
            patient_code_result = self.get_patient_code(analysis_result)
            
            # Enhance export metadata
            if 'session_metadata' not in export_data:
                export_data['session_metadata'] = {}
            
            export_data['session_metadata'].update({
                'patient_code': patient_code_result.patient_code,
                'patient_code_source': patient_code_result.source,
                'patient_code_confidence': patient_code_result.confidence
            })
            
            # Enhance filename if patient code is available and high confidence
            if (patient_code_result.patient_code and 
                patient_code_result.confidence in ['high', 'medium'] and
                'request_metadata' in export_data):
                
                original_filename = export_data['request_metadata'].get('filename', '')
                if original_filename and not original_filename.startswith(patient_code_result.patient_code):
                    # Create enhanced filename with patient code prefix
                    enhanced_filename = f"{patient_code_result.patient_code}_{original_filename}"
                    export_data['session_metadata']['enhanced_filename'] = enhanced_filename
            
            logger.info(f"Enhanced export data with patient code: {patient_code_result.patient_code} "
                       f"(source: {patient_code_result.source}, confidence: {patient_code_result.confidence})")
            
        except Exception as e:
            logger.error(f"Failed to enhance export data with patient code: {e}")
            # Add error information but don't fail the export
            if 'session_metadata' not in export_data:
                export_data['session_metadata'] = {}
            export_data['session_metadata'].update({
                'patient_code': None,
                'patient_code_source': 'unknown',
                'patient_code_confidence': 'low',
                'patient_code_error': str(e)
            })
        
        return export_data