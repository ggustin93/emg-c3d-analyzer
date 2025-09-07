"""
Unit Tests for Clinical Notes Service
=====================================

Tests the hybrid patient identification system and core business logic.
Validates patient_code to UUID conversion and note management operations.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID, uuid4
from datetime import datetime

from services.clinical.notes_service import ClinicalNotesService
from models.clinical.clinical_notes import (
    ClinicalNote,
    ClinicalNoteWithPatientCode,
    NotesIndicators
)
from services.shared.repositories.base.abstract_repository import RepositoryError


class TestClinicalNotesService:
    """Test suite for Clinical Notes Service with hybrid patient identification."""

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
            'patient_id': uuid4(),
            'note_id': uuid4()
        }

    @pytest.fixture
    def sample_note_data(self, sample_uuids):
        """Sample note data for testing."""
        return {
            'id': sample_uuids['note_id'],
            'author_id': sample_uuids['author_id'],
            'patient_id': sample_uuids['patient_id'],
            'file_path': None,
            'content': 'Patient shows improvement in muscle activation.',
            'note_type': 'patient',
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }


class TestPatientIdentificationConversion:
    """Test hybrid patient identification: patient_code ↔ patient_id conversion."""

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
            'patient_id': uuid4()
        }

    @pytest.mark.asyncio
    async def test_resolve_patient_code_to_id_success(self, service, mock_supabase, sample_uuids):
        """Test successful patient_code to UUID conversion."""
        # Arrange
        patient_code = "P001"
        expected_id = sample_uuids['patient_id']
        
        # Create async mock for the complete chain
        mock_execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.data = [{'id': str(expected_id)}]
        mock_execute.return_value = mock_result
        
        # Set up the async chain
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute = mock_execute
        
        # Act
        result = await service._resolve_patient_code_to_id(patient_code)
        
        # Assert
        assert result == expected_id
        mock_supabase.table.assert_called_with('patients')

    @pytest.mark.asyncio
    async def test_resolve_patient_code_to_id_not_found(self, service, mock_supabase):
        """Test patient_code to UUID conversion when patient not found."""
        # Arrange
        patient_code = "P999"
        
        # Create async mock for the complete chain
        mock_execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.data = []
        mock_execute.return_value = mock_result
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute = mock_execute
        
        # Act
        result = await service._resolve_patient_code_to_id(patient_code)
        
        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_resolve_patient_code_to_id_database_error(self, service, mock_supabase):
        """Test patient_code to UUID conversion with database error."""
        # Arrange
        patient_code = "P001"
        
        # Create async mock that raises exception
        mock_execute = AsyncMock()
        mock_execute.side_effect = Exception("DB Error")
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute = mock_execute
        
        # Act & Assert
        with pytest.raises(RepositoryError, match="Database error resolving patient"):
            await service._resolve_patient_code_to_id(patient_code)

    @pytest.mark.asyncio
    async def test_resolve_patient_id_to_code_success(self, service, mock_supabase, sample_uuids):
        """Test successful UUID to patient_code conversion."""
        # Arrange
        patient_id = sample_uuids['patient_id']
        expected_code = "P001"
        
        # Create async mock for the complete chain
        mock_execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.data = [{'patient_code': expected_code}]
        mock_execute.return_value = mock_result
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute = mock_execute
        
        # Act
        result = await service._resolve_patient_id_to_code(patient_id)
        
        # Assert
        assert result == expected_code

    @pytest.mark.asyncio
    async def test_resolve_patient_id_to_code_not_found(self, service, mock_supabase, sample_uuids):
        """Test UUID to patient_code conversion when patient not found."""
        # Arrange
        patient_id = sample_uuids['patient_id']
        
        # Create async mock for the complete chain
        mock_execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.data = []
        mock_execute.return_value = mock_result
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute = mock_execute
        
        # Act
        result = await service._resolve_patient_id_to_code(patient_id)
        
        # Assert
        assert result is None


class TestFileNoteOperations:
    """Test file note CRUD operations."""

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
            'note_id': uuid4()
        }

    @pytest.mark.asyncio
    async def test_create_file_note_success(self, service, mock_supabase, sample_uuids):
        """Test successful file note creation."""
        # Arrange
        file_path = "patients/P001/session_001/recording.c3d"
        content = "Good signal quality, patient cooperative."
        author_id = sample_uuids['author_id']
        
        mock_response_data = {
            'id': sample_uuids['note_id'],
            'author_id': str(author_id),
            'file_path': file_path,
            'patient_id': None,
            'content': content,
            'note_type': 'file',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        # Create async mock for the complete chain
        mock_execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.data = [mock_response_data]
        mock_execute.return_value = mock_result
        
        mock_supabase.table.return_value.insert.return_value.execute = mock_execute
        
        # Act
        result = await service.create_file_note(file_path, content, author_id)
        
        # Assert
        assert isinstance(result, ClinicalNote)
        assert result.file_path == file_path
        assert result.content == content
        assert result.note_type == 'file'
        assert result.patient_id is None

    @pytest.mark.asyncio
    async def test_create_file_note_empty_content(self, service, sample_uuids):
        """Test file note creation with empty content."""
        # Arrange
        file_path = "patients/P001/session_001/recording.c3d"
        content = ""
        author_id = sample_uuids['author_id']
        
        # Act & Assert
        with pytest.raises(ValueError, match="Note content cannot be empty"):
            await service.create_file_note(file_path, content, author_id)

    @pytest.mark.asyncio
    async def test_create_file_note_content_too_long(self, service, sample_uuids):
        """Test file note creation with content exceeding maximum length."""
        # Arrange
        file_path = "patients/P001/session_001/recording.c3d"
        content = "x" * 10001  # Exceed 10,000 character limit
        author_id = sample_uuids['author_id']
        
        # Act & Assert
        with pytest.raises(ValueError, match="Note content exceeds maximum length"):
            await service.create_file_note(file_path, content, author_id)


class TestPatientNoteOperations:
    """Test patient note CRUD operations with hybrid identification."""

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
            'patient_id': uuid4(),
            'note_id': uuid4()
        }

    @pytest.mark.asyncio
    async def test_create_patient_note_success(self, service, mock_supabase, sample_uuids):
        """Test successful patient note creation with patient_code conversion."""
        # Arrange
        patient_code = "P001"
        content = "Patient shows consistent improvement."
        author_id = sample_uuids['author_id']
        patient_id = sample_uuids['patient_id']
        
        # Mock patient code resolution
        mock_execute_select = AsyncMock()
        mock_result_select = MagicMock()
        mock_result_select.data = [{'id': str(patient_id)}]
        mock_execute_select.return_value = mock_result_select
        
        # Mock note creation
        mock_response_data = {
            'id': sample_uuids['note_id'],
            'author_id': str(author_id),
            'file_path': None,
            'patient_id': str(patient_id),
            'content': content,
            'note_type': 'patient',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        mock_execute_insert = AsyncMock()
        mock_result_insert = MagicMock()
        mock_result_insert.data = [mock_response_data]
        mock_execute_insert.return_value = mock_result_insert
        
        # Configure mock to return different results for different calls
        mock_table = mock_supabase.table.return_value
        mock_table.select.return_value.eq.return_value.execute = mock_execute_select
        mock_table.insert.return_value.execute = mock_execute_insert
        
        # Act
        result = await service.create_patient_note(patient_code, content, author_id)
        
        # Assert
        assert isinstance(result, ClinicalNote)
        assert result.patient_id == patient_id
        assert result.content == content
        assert result.note_type == 'patient'
        assert result.file_path is None

    @pytest.mark.asyncio
    async def test_create_patient_note_patient_not_found(self, service, mock_supabase, sample_uuids):
        """Test patient note creation when patient_code not found."""
        # Arrange
        patient_code = "P999"
        content = "Test note content."
        author_id = sample_uuids['author_id']
        
        # Mock patient not found
        mock_execute = AsyncMock()
        mock_result = MagicMock()
        mock_result.data = []
        mock_execute.return_value = mock_result
        
        mock_supabase.table.return_value.select.return_value.eq.return_value.execute = mock_execute
        
        # Act & Assert
        with pytest.raises(ValueError, match="Patient not found: P999"):
            await service.create_patient_note(patient_code, content, author_id)


class TestNotesIndicators:
    """Test batch loading of note count indicators for UI performance."""

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
            'patient_id_1': uuid4(),
            'patient_id_2': uuid4()
        }

    @pytest.mark.asyncio
    async def test_get_notes_indicators_success(self, service, mock_supabase, sample_uuids):
        """Test successful batch loading of note indicators."""
        # Arrange
        author_id = sample_uuids['author_id']
        file_paths = ["patients/P001/session_001/recording.c3d", "patients/P001/session_002/recording.c3d"]
        patient_codes = ["P001", "P002"]
        
        # Mock file notes query result
        mock_file_data = [
            {'file_path': file_paths[0]},
            {'file_path': file_paths[0]},  # 2 notes for first file
            {'file_path': file_paths[1]}   # 1 note for second file
        ]
        
        mock_file_result = MagicMock()
        mock_file_result.data = mock_file_data
        
        # Mock patient code resolution query result
        mock_patient_data = [
            {'id': str(sample_uuids['patient_id_1']), 'patient_code': 'P001'},
            {'id': str(sample_uuids['patient_id_2']), 'patient_code': 'P002'}
        ]
        
        mock_patient_resolve_result = MagicMock()
        mock_patient_resolve_result.data = mock_patient_data
        
        # Mock patient notes query result
        mock_patient_notes_data = [
            {'patient_id': str(sample_uuids['patient_id_1'])},
            {'patient_id': str(sample_uuids['patient_id_1'])},  # 2 notes for P001
            {'patient_id': str(sample_uuids['patient_id_2'])}   # 1 note for P002
        ]
        
        mock_patient_notes_result = MagicMock()
        mock_patient_notes_result.data = mock_patient_notes_data
        
        # Set up different mocks for different table() calls
        def mock_table_call(table_name):
            table_mock = MagicMock()
            if table_name == 'clinical_notes':
                # Create different chains for file vs patient queries
                def select_mock(fields):
                    select_chain = MagicMock()
                    if fields == 'file_path':  # File notes query
                        select_chain.eq.return_value.eq.return_value.in_.return_value.execute.return_value = mock_file_result
                    else:  # Patient notes query (fields == 'patient_id')
                        select_chain.eq.return_value.eq.return_value.in_.return_value.execute.return_value = mock_patient_notes_result
                    return select_chain
                table_mock.select.side_effect = select_mock
            else:  # patients table
                table_mock.select.return_value.in_.return_value.execute.return_value = mock_patient_resolve_result
            return table_mock
        
        mock_supabase.table.side_effect = mock_table_call
        
        # Act
        result = await service.get_notes_indicators(author_id, file_paths, patient_codes)
        
        # Assert
        assert isinstance(result, NotesIndicators)
        assert result.file_notes[file_paths[0]] == 2
        assert result.file_notes[file_paths[1]] == 1
        assert result.patient_notes['P001'] == 2
        assert result.patient_notes['P002'] == 1


class TestPatientCodeExtraction:
    """Test patient code extraction from file paths."""

    @pytest.fixture
    def mock_supabase(self):
        """Mock Supabase client for testing."""
        return MagicMock()

    @pytest.fixture
    def service(self, mock_supabase):
        """Clinical Notes Service instance with mocked Supabase."""
        return ClinicalNotesService(mock_supabase)

    @pytest.mark.asyncio
    async def test_extract_patient_code_success(self, service):
        """Test successful patient code extraction from file path."""
        # Arrange
        file_path = "patients/P001/session_20250905_143022/recording.c3d"
        
        # Act
        result = await service.extract_patient_code_from_file_path(file_path)
        
        # Assert
        assert result == "P001"

    @pytest.mark.asyncio
    async def test_extract_patient_code_different_positions(self, service):
        """Test patient code extraction from various file path formats."""
        test_cases = [
            ("P001/session_001/recording.c3d", "P001"),
            ("data/patients/P123/files/test.c3d", "P123"),
            ("storage/P999/recording.c3d", "P999"),
            ("no_patient_code/session/file.c3d", None),
            ("patients/invalid_code/session.c3d", None),
        ]
        
        for file_path, expected in test_cases:
            # Act
            result = await service.extract_patient_code_from_file_path(file_path)
            
            # Assert
            assert result == expected, f"Failed for path: {file_path}"

    @pytest.mark.asyncio
    async def test_extract_patient_code_error_handling(self, service):
        """Test patient code extraction with invalid input."""
        # Arrange
        invalid_path = None
        
        # Act
        result = await service.extract_patient_code_from_file_path(invalid_path)
        
        # Assert
        assert result is None