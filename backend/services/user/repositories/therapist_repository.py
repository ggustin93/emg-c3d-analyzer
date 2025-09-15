"""
Therapist Repository for data access following SOLID principles.

This module provides clean data access layer for therapist-related operations,
implementing the repository pattern with Supabase client integration.
"""

from typing import Optional, Dict, List
import logging
from supabase import Client

logger = logging.getLogger(__name__)


class TherapistRepository:
    """Repository for therapist data access following SOLID principles.
    
    Single Responsibility: Database operations for therapist data
    Open/Closed: Extensible through inheritance
    Dependency Inversion: Depends on Supabase client abstraction
    """
    
    def __init__(self, supabase_client: Client):
        """Initialize therapist repository with Supabase client.
        
        Args:
            supabase_client: Authenticated Supabase client instance
        """
        self.client = supabase_client
        self.table_name = 'user_profiles'
        self.logger = logger
    
    def get_therapist_for_patient_code(self, patient_code: str) -> Optional[Dict]:
        """Get therapist information for a single patient code.
        
        KISS: Simple join query using Supabase client to resolve
        therapist from patient relationship.
        
        Args:
            patient_code: Patient code (e.g., 'P001')
            
        Returns:
            Dictionary with therapist info or None if not found
        """
        try:
            # Query patients table with join to user_profiles
            response = self.client.table('patients').select(
                'therapist_id, user_profiles!patients_therapist_id_fkey(id, first_name, last_name, user_code, role)'
            ).eq('patient_code', patient_code.upper()).single().execute()
            
            if response.data and response.data.get('user_profiles'):
                therapist = response.data['user_profiles']
                return {
                    'id': therapist['id'],
                    'first_name': therapist.get('first_name'),
                    'last_name': therapist.get('last_name'),
                    'user_code': therapist.get('user_code'),
                    'role': therapist.get('role'),
                    'display_name': self._format_display_name(therapist)
                }
            
            self.logger.debug(f"No therapist found for patient code: {patient_code}")
            return None
            
        except Exception as e:
            self.logger.error(f"Error fetching therapist for patient {patient_code}: {e}")
            return None
    
    def get_therapists_for_patient_codes(self, patient_codes: List[str]) -> Dict[str, Dict]:
        """Batch get therapists for multiple patient codes.
        
        DRY: Single query for multiple codes, avoiding N+1 problem.
        
        Args:
            patient_codes: List of patient codes
            
        Returns:
            Dictionary mapping patient_code to therapist info
        """
        if not patient_codes:
            return {}
        
        try:
            # Normalize patient codes to uppercase
            codes = [code.upper() for code in patient_codes]
            
            # Single query with IN clause for efficiency
            response = self.client.table('patients').select(
                'patient_code, therapist_id, user_profiles!patients_therapist_id_fkey(id, first_name, last_name, user_code, role)'
            ).in_('patient_code', codes).execute()
            
            # Debug logging
            self.logger.info(f"Query response data count: {len(response.data)}")
            if response.data:
                self.logger.info(f"First row: {response.data[0]}")
            
            result = {}
            for row in response.data:
                if row.get('user_profiles'):
                    therapist = row['user_profiles']
                    result[row['patient_code']] = {
                        'id': therapist['id'],
                        'first_name': therapist.get('first_name'),
                        'last_name': therapist.get('last_name'),
                        'user_code': therapist.get('user_code'),
                        'role': therapist.get('role'),
                        'display_name': self._format_display_name(therapist)
                    }
            
            # Log missing patient codes for debugging
            missing = set(codes) - set(result.keys())
            if missing:
                self.logger.debug(f"No therapists found for patient codes: {missing}")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error in batch therapist fetch: {e}")
            return {}
    
    def get_therapist_by_id(self, therapist_id: str) -> Optional[Dict]:
        """Get therapist by their UUID.
        
        Args:
            therapist_id: Therapist UUID
            
        Returns:
            Dictionary with therapist info or None if not found
        """
        try:
            response = self.client.table('user_profiles').select(
                'id, first_name, last_name, user_code, role'
            ).eq('id', therapist_id).eq('role', 'therapist').single().execute()
            
            if response.data:
                return {
                    'id': response.data['id'],
                    'first_name': response.data.get('first_name'),
                    'last_name': response.data.get('last_name'),
                    'user_code': response.data.get('user_code'),
                    'role': response.data.get('role'),
                    'display_name': self._format_display_name(response.data)
                }
            return None
            
        except Exception as e:
            self.logger.error(f"Error fetching therapist by ID {therapist_id}: {e}")
            return None
    
    def _format_display_name(self, therapist: Dict) -> str:
        """Format therapist display name as 'Dr. LastName'.
        
        Priority: Dr. LastName > User code > 'Unknown'
        
        Args:
            therapist: Dictionary with therapist data
            
        Returns:
            Formatted display name as 'Dr. LastName'
        """
        last_name = therapist.get('last_name', '').strip()
        
        if last_name:
            return f"Dr. {last_name}"
        elif therapist.get('user_code'):
            return therapist['user_code']
        else:
            return 'Unknown Therapist'