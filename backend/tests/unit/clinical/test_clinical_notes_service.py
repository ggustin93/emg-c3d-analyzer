"""
Unit Tests for Clinical Notes Service
=====================================

Tests the hybrid patient identification system and core business logic.
Only includes critical tests for patient code conversion and note operations.
"""

import pytest
from unittest.mock import MagicMock, Mock
from uuid import UUID, uuid4

from services.clinical.notes_service import ClinicalNotesService
from models.clinical.clinical_notes import NotesIndicators
from services.shared.repositories.base.abstract_repository import RepositoryError


class TestClinicalNotesService:
    """Critical tests for Clinical Notes Service."""

    @pytest.fixture
    def mock_supabase(self):
        """Mock Supabase client for testing."""
        return MagicMock()

    @pytest.fixture
    def service(self, mock_supabase):
        """Clinical Notes Service instance with mocked Supabase."""
        return ClinicalNotesService(mock_supabase)

    @pytest.fixture
    def sample_uuids(self):
        """Sample UUIDs for testing."""
        return {
            'author_id': uuid4(),
            'patient_id': UUID('0df2ff6d-cbc7-4189-b568-ad77fd91b7ad'),
            'note_id': uuid4()
        }

    def test_resolve_patient_code_to_id_success(self, service, mock_supabase, sample_uuids):
        """Test successful patient_code to UUID conversion."""
        # Arrange
        patient_code = "P001"
        expected_id = sample_uuids['patient_id']
        
        # Mock the synchronous chain
        mock_result = MagicMock()
        mock_result.data = [{'id': str(expected_id)}]
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Act
        result = service._resolve_patient_code_to_id(patient_code)
        
        # Assert
        assert result == expected_id
        mock_supabase.table.assert_called_with('patients')

    def test_resolve_patient_code_to_id_not_found(self, service, mock_supabase):
        """Test patient_code to UUID conversion when patient not found."""
        # Arrange
        patient_code = "P999"
        
        # Mock empty result
        mock_result = MagicMock()
        mock_result.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_result
        
        # Act
        result = service._resolve_patient_code_to_id(patient_code)
        
        # Assert
        assert result is None

    def test_resolve_patient_code_to_id_database_error(self, service, mock_supabase):
        """Test patient_code to UUID conversion with database error."""
        # Arrange
        patient_code = "P001"
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute.side_effect = Exception("Database error")
        
        # Act & Assert
        with pytest.raises(RepositoryError, match="Database error resolving patient"):
            service._resolve_patient_code_to_id(patient_code)

    def test_create_file_note_success(self, service, mock_supabase, sample_uuids):
        """Test successful file note creation."""
        # Arrange
        file_path = "/test/file.c3d"
        author_id = sample_uuids['author_id']
        content = "Test note content"
        
        mock_result = MagicMock()
        mock_result.data = [{
            'id': str(sample_uuids['note_id']),
            'content': content,
            'note_type': 'file',
            'file_path': file_path,
            'author_id': str(author_id),
            'created_at': '2024-01-01T00:00:00',
            'updated_at': '2024-01-01T00:00:00'
        }]
        mock_supabase.table.return_value.insert.return_value.execute.return_value = mock_result
        
        # Act
        result = service.create_file_note(file_path, content, author_id)
        
        # Assert
        assert result.content == content
        mock_supabase.table.assert_called_with('clinical_notes')

    def test_create_file_note_empty_content(self, service, sample_uuids):
        """Test file note creation with empty content."""
        # Act & Assert
        with pytest.raises(ValueError, match="Note content cannot be empty"):
            service.create_file_note("/test/file.c3d", "", sample_uuids['author_id'])

    def test_create_file_note_content_too_long(self, service, sample_uuids):
        """Test file note creation with content exceeding max length."""
        # Arrange
        long_content = "a" * 10001  # Max is 10000
        
        # Act & Assert
        with pytest.raises(ValueError, match="Note content exceeds maximum"):
            service.create_file_note("/test/file.c3d", long_content, sample_uuids['author_id'])


    def test_extract_patient_code_success(self):
        """Test patient code extraction from various file paths."""
        # Test cases: (file_path, expected_code)
        test_cases = [
            ("patients/P001/session_001/recording.c3d", "P001"),
            ("/storage/patients/P123/data.c3d", "P123"),
            ("P456/file.c3d", "P456"),
            ("/complex/path/P789/test.c3d", "P789")
        ]
        
        service = ClinicalNotesService(MagicMock())
        
        for file_path, expected_code in test_cases:
            result = service.extract_patient_code_from_file_path(file_path)
            assert result == expected_code, f"Failed for {file_path}"

    def test_extract_patient_code_error_handling(self):
        """Test patient code extraction error cases."""
        # Test cases that should return None
        test_cases = [
            "/data/no_patient_code.c3d",
            "/path/to/X001_not_patient.c3d",
            "invalid_file.c3d",
            None
        ]
        
        service = ClinicalNotesService(MagicMock())
        
        for file_path in test_cases:
            result = service.extract_patient_code_from_file_path(file_path)
            assert result is None, f"Should return None for {file_path}"