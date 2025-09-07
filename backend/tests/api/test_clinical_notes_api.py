"""
API Integration Tests for Clinical Notes Endpoints
=================================================

Tests the Clinical Notes API endpoints with hybrid patient identification.
Validates request/response handling, authentication, and error scenarios.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4, UUID
from datetime import datetime

from api.main import create_app
from api.dependencies.validation import get_current_user_id
from api.dependencies.services import get_clinical_notes_service
from models.clinical.clinical_notes import (
    ClinicalNote,
    ClinicalNoteWithPatientCode,
    NotesIndicators
)


class TestClinicalNotesAPI:
    """Integration tests for Clinical Notes API endpoints."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        app = create_app()
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers."""
        return {"Authorization": "Bearer mock-jwt-token"}

    @pytest.fixture
    def sample_uuids(self):
        """Sample UUIDs for testing."""
        return {
            'author_id': uuid4(),
            'patient_id': uuid4(),
            'note_id': uuid4()
        }

    @pytest.fixture
    def sample_note_response(self, sample_uuids):
        """Sample API response for note creation."""
        return {
            'id': str(sample_uuids['note_id']),
            'author_id': str(sample_uuids['author_id']),
            'patient_id': str(sample_uuids['patient_id']),
            'file_path': None,
            'content': 'Patient shows improvement.',
            'note_type': 'patient',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }

    @pytest.fixture
    def mock_auth_user_id(self):
        """Mock current user ID for authentication."""
        return uuid4()


class TestFileNoteEndpoints:
    """Test file note API endpoints."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        app = create_app()
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers."""
        return {"Authorization": "Bearer mock-jwt-token"}

    @pytest.fixture
    def mock_auth_user_id(self):
        """Mock current user ID for authentication."""
        return uuid4()

    def test_create_file_note_success(self, client, auth_headers, mock_auth_user_id):
        """Test successful file note creation via API."""
        # Arrange
        file_path = "patients/P001/session_001/recording.c3d"
        request_data = {
            "content": "Good signal quality, patient cooperative.",
            "note_type": "file"
        }
        
        # Mock service response
        expected_note = ClinicalNote(
            id=uuid4(),
            author_id=mock_auth_user_id,
            file_path=file_path,
            patient_id=None,
            content=request_data['content'],
            note_type='file',
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Mock service instance and method
        mock_service = AsyncMock()
        mock_service.create_file_note = AsyncMock(return_value=expected_note)
        
        # Override both authentication and service dependencies
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        def mock_get_clinical_notes_service():
            return mock_service
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        client.app.dependency_overrides[get_clinical_notes_service] = mock_get_clinical_notes_service
        
        try:
            # Act
            response = client.post(
                f"/clinical-notes/file?file_path={file_path}",
                json=request_data,
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data['file_path'] == file_path
            assert data['content'] == request_data['content']
            assert data['note_type'] == 'file'
            assert data['patient_id'] is None
            
            # Verify service was called correctly
            mock_service.create_file_note.assert_called_once_with(
                file_path=file_path,
                content=request_data['content'],
                author_id=mock_auth_user_id
            )
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()

    def test_create_file_note_invalid_note_type(self, client, auth_headers, mock_auth_user_id):
        """Test file note creation with invalid note type."""
        # Arrange
        file_path = "patients/P001/session_001/recording.c3d"
        request_data = {
            "content": "Test content.",
            "note_type": "patient"  # Invalid for file endpoint
        }
        
        # Mock service
        mock_service = AsyncMock()
        
        # Override authentication and service dependencies
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        def mock_get_clinical_notes_service():
            return mock_service
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        client.app.dependency_overrides[get_clinical_notes_service] = mock_get_clinical_notes_service
        
        try:
            # Act
            response = client.post(
                f"/clinical-notes/file?file_path={file_path}",
                json=request_data,
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 400
            assert "Note type must be 'file'" in response.json()['detail']
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()

    def test_create_file_note_missing_auth(self, client):
        """Test file note creation without authentication."""
        # Arrange
        file_path = "patients/P001/session_001/recording.c3d"
        request_data = {
            "content": "Test content.",
            "note_type": "file"
        }
        
        # Act (no auth override, no headers)
        response = client.post(
            f"/clinical-notes/file?file_path={file_path}",
            json=request_data
        )
        
        # Assert
        assert response.status_code == 403  # FastAPI returns 403 for missing auth


class TestPatientNoteEndpoints:
    """Test patient note API endpoints with hybrid identification."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        app = create_app()
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers."""
        return {"Authorization": "Bearer mock-jwt-token"}

    @pytest.fixture
    def mock_auth_user_id(self):
        """Mock current user ID for authentication."""
        return uuid4()

    @patch('api.dependencies.services.get_clinical_notes_service')
    def test_create_patient_note_success(self, mock_get_service, client, auth_headers, mock_auth_user_id):
        """Test successful patient note creation with patient_code conversion."""
        # Arrange
        patient_code = "P001"
        patient_id = uuid4()
        request_data = {
            "content": "Patient shows consistent improvement.",
            "note_type": "patient"
        }
        
        # Mock service response
        expected_note = ClinicalNote(
            id=uuid4(),
            author_id=mock_auth_user_id,
            file_path=None,
            patient_id=patient_id,
            content=request_data['content'],
            note_type='patient',
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Mock service instance and method
        mock_service = AsyncMock()
        mock_service.create_patient_note.return_value = expected_note
        mock_get_service.return_value = mock_service
        
        # Override authentication dependency
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        
        try:
            # Act
            response = client.post(
                f"/clinical-notes/patient/{patient_code}",
                json=request_data,
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data['patient_id'] == str(patient_id)
            assert data['content'] == request_data['content']
            assert data['note_type'] == 'patient'
            assert data['file_path'] is None
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()

    @patch('api.dependencies.services.get_clinical_notes_service')
    def test_create_patient_note_patient_not_found(self, mock_get_service, client, auth_headers, mock_auth_user_id):
        """Test patient note creation when patient_code not found."""
        # Arrange
        patient_code = "P999"
        request_data = {
            "content": "Test note content.",
            "note_type": "patient"
        }
        
        # Mock service to raise ValueError for patient not found
        mock_service = AsyncMock()
        mock_service.create_patient_note.side_effect = ValueError(f"Patient not found: {patient_code}")
        mock_get_service.return_value = mock_service
        
        # Override authentication dependency
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        
        try:
            # Act
            response = client.post(
                f"/clinical-notes/patient/{patient_code}",
                json=request_data,
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 404
            assert f"Patient not found: {patient_code}" in response.json()['detail']
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()

    def test_create_patient_note_invalid_note_type(self, client, auth_headers, mock_auth_user_id):
        """Test patient note creation with invalid note type."""
        # Arrange
        patient_code = "P001"
        request_data = {
            "content": "Test content.",
            "note_type": "file"  # Invalid for patient endpoint
        }
        
        # Override authentication dependency
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        
        try:
            # Act
            response = client.post(
                f"/clinical-notes/patient/{patient_code}",
                json=request_data,
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 400
            assert "Note type must be 'patient'" in response.json()['detail']
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()


class TestNotesRetrievalEndpoints:
    """Test note retrieval API endpoints."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        app = create_app()
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers."""
        return {"Authorization": "Bearer mock-jwt-token"}

    @pytest.fixture
    def mock_auth_user_id(self):
        """Mock current user ID for authentication."""
        return uuid4()

    @patch('api.dependencies.services.get_clinical_notes_service')
    def test_get_file_notes_success(self, mock_get_service, client, auth_headers, mock_auth_user_id):
        """Test successful file notes retrieval."""
        # Arrange
        file_path = "patients/P001/session_001/recording.c3d"
        
        # Mock service response
        mock_notes = [
            ClinicalNoteWithPatientCode(
                id=uuid4(),
                author_id=mock_auth_user_id,
                file_path=file_path,
                patient_id=None,
                patient_code=None,
                content='First note content.',
                note_type='file',
                created_at=datetime.now(),
                updated_at=datetime.now()
            ),
            ClinicalNoteWithPatientCode(
                id=uuid4(),
                author_id=mock_auth_user_id,
                file_path=file_path,
                patient_id=None,
                patient_code=None,
                content='Second note content.',
                note_type='file',
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
        ]
        
        # Mock service instance and method
        mock_service = AsyncMock()
        mock_service.get_file_notes.return_value = mock_notes
        mock_get_service.return_value = mock_service
        
        # Override authentication dependency
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        
        try:
            # Act
            response = client.get(
                f"/clinical-notes/file?file_path={file_path}",
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data['total_count'] == 2
            assert len(data['notes']) == 2
            assert all(note['file_path'] == file_path for note in data['notes'])
            assert all(note['note_type'] == 'file' for note in data['notes'])
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()


class TestNotesIndicatorsEndpoint:
    """Test batch note indicators endpoint for UI performance."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        app = create_app()
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers."""
        return {"Authorization": "Bearer mock-jwt-token"}

    @pytest.fixture
    def mock_auth_user_id(self):
        """Mock current user ID for authentication."""
        return uuid4()

    @patch('api.dependencies.services.get_clinical_notes_service')
    def test_get_notes_indicators_success(self, mock_get_service, client, auth_headers, mock_auth_user_id):
        """Test successful batch note indicators retrieval."""
        # Arrange
        request_data = {
            "file_paths": ["patients/P001/session_001/recording.c3d", "patients/P001/session_002/recording.c3d"],
            "patient_codes": ["P001", "P002"]
        }
        
        # Mock service response
        expected_indicators = NotesIndicators(
            file_notes={
                'patients/P001/session_001/recording.c3d': 2,
                'patients/P001/session_002/recording.c3d': 1
            },
            patient_notes={
                'P001': 3,
                'P002': 1
            }
        )
        
        # Mock service instance and method
        mock_service = AsyncMock()
        mock_service.get_notes_indicators.return_value = expected_indicators
        mock_get_service.return_value = mock_service
        
        # Override authentication dependency
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        
        try:
            # Act
            response = client.post(
                "/clinical-notes/indicators",
                json=request_data,
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data['file_notes'] == expected_indicators.file_notes
            assert data['patient_notes'] == expected_indicators.patient_notes
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()


class TestPatientCodeExtractionEndpoint:
    """Test patient code extraction from file paths endpoint."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        app = create_app()
        return TestClient(app)

    def test_extract_patient_code_success(self, client):
        """Test successful patient code extraction from file path."""
        # Arrange
        file_path = "patients/P001/session_20250905_143022/recording.c3d"
        
        # Act (No auth required for this endpoint)
        response = client.get(f"/clinical-notes/patient-code/{file_path}")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data['patient_code'] == 'P001'
        assert data['file_path'] == file_path

    def test_extract_patient_code_not_found(self, client):
        """Test patient code extraction when no code found in path."""
        # Arrange
        file_path = "sessions/no_patient/recording.c3d"
        
        # Act (No auth required for this endpoint)
        response = client.get(f"/clinical-notes/patient-code/{file_path}")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data['patient_code'] is None
        assert data['file_path'] == file_path


class TestNoteCRUDOperations:
    """Test note update and delete operations."""

    @pytest.fixture
    def client(self):
        """FastAPI test client."""
        app = create_app()
        return TestClient(app)

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers."""
        return {"Authorization": "Bearer mock-jwt-token"}

    @pytest.fixture
    def mock_auth_user_id(self):
        """Mock current user ID for authentication."""
        return uuid4()

    @patch('api.dependencies.services.get_clinical_notes_service')
    def test_update_note_success(self, mock_get_service, client, auth_headers, mock_auth_user_id):
        """Test successful note update."""
        # Arrange
        note_id = uuid4()
        request_data = {"content": "Updated note content."}
        
        # Mock service response
        updated_note = ClinicalNote(
            id=note_id,
            author_id=mock_auth_user_id,
            file_path='patients/P001/session_001/recording.c3d',
            patient_id=None,
            content=request_data['content'],
            note_type='file',
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        # Mock service instance and method
        mock_service = AsyncMock()
        mock_service.update_note.return_value = updated_note
        mock_get_service.return_value = mock_service
        
        # Override authentication dependency
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        
        try:
            # Act
            response = client.put(
                f"/clinical-notes/{note_id}",
                json=request_data,
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data['content'] == request_data['content']
            assert data['id'] == str(note_id)
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()

    @patch('api.dependencies.services.get_clinical_notes_service')
    def test_delete_note_success(self, mock_get_service, client, auth_headers, mock_auth_user_id):
        """Test successful note deletion."""
        # Arrange
        note_id = uuid4()
        
        # Mock service instance and method
        mock_service = AsyncMock()
        mock_service.delete_note.return_value = True
        mock_get_service.return_value = mock_service
        
        # Override authentication dependency
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        
        try:
            # Act
            response = client.delete(
                f"/clinical-notes/{note_id}",
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data['message'] == 'Note deleted successfully'
            assert data['note_id'] == str(note_id)
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()

    @patch('api.dependencies.services.get_clinical_notes_service')
    def test_update_note_not_found(self, mock_get_service, client, auth_headers, mock_auth_user_id):
        """Test note update when note not found or unauthorized."""
        # Arrange
        note_id = uuid4()
        request_data = {"content": "Updated content."}
        
        # Mock service to return None (note not found)
        mock_service = AsyncMock()
        mock_service.update_note.return_value = None
        mock_get_service.return_value = mock_service
        
        # Override authentication dependency
        def mock_get_current_user_id() -> UUID:
            return mock_auth_user_id
        
        client.app.dependency_overrides[get_current_user_id] = mock_get_current_user_id
        
        try:
            # Act
            response = client.put(
                f"/clinical-notes/{note_id}",
                json=request_data,
                headers=auth_headers
            )
            
            # Assert
            assert response.status_code == 404
            assert "Note not found or unauthorized" in response.json()['detail']
        finally:
            # Clean up dependency override
            client.app.dependency_overrides.clear()