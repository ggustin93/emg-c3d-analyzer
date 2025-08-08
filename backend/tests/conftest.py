"""
Pytest configuration and shared fixtures for EMG C3D Analyzer tests.

Provides common test fixtures and configuration for all test modules.
"""

import pytest
import numpy as np
import tempfile
import os
from pathlib import Path
from typing import Dict, Any

from ..domain.models import GameSessionParameters
from ..application.services.emg_service import EMGAnalysisService
from ..infrastructure.file_io import FileSystemManager
from ..infrastructure.storage import CacheManager, DataStore


@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir


@pytest.fixture
def sample_emg_data():
    """Generate sample EMG data for testing."""
    sampling_rate = 1000.0  # Hz
    duration = 5.0  # seconds
    num_samples = int(sampling_rate * duration)
    
    # Generate realistic EMG-like signal
    time_axis = np.linspace(0, duration, num_samples)
    
    # Base signal with some contractions
    signal = np.random.normal(0, 0.0001, num_samples)  # Baseline noise
    
    # Add some contraction-like events
    for start_time in [1.0, 2.5, 4.0]:
        start_idx = int(start_time * sampling_rate)
        end_idx = start_idx + int(0.5 * sampling_rate)  # 500ms contractions
        
        if end_idx < num_samples:
            # Add elevated signal during contraction
            signal[start_idx:end_idx] += np.random.normal(0.0005, 0.0001, end_idx - start_idx)
    
    return {
        'CH1': signal,
        'CH2': signal * 0.8 + np.random.normal(0, 0.00005, num_samples),  # Slightly different
        'sampling_rate': sampling_rate,
        'time_axis': time_axis
    }


@pytest.fixture
def sample_session_parameters():
    """Create sample session parameters for testing."""
    return GameSessionParameters(
        mvc_threshold_percentage=75.0,
        contraction_duration_threshold=250.0,
        session_mvc_values={'CH1': 0.001, 'CH2': 0.0008},
        channel_muscle_mapping={'CH1': 'Left Quadriceps', 'CH2': 'Right Quadriceps'},
        muscle_color_mapping={'Left Quadriceps': '#3b82f6', 'Right Quadriceps': '#ef4444'}
    )


@pytest.fixture
def emg_service():
    """Create EMG analysis service instance."""
    return EMGAnalysisService()


@pytest.fixture
def file_system_manager(temp_dir):
    """Create file system manager with temporary directory."""
    return FileSystemManager(temp_dir)


@pytest.fixture
def cache_manager():
    """Create cache manager instance."""
    return CacheManager(max_size=10, timeout=60)


@pytest.fixture
def data_store(temp_dir):
    """Create data store instance with temporary directory."""
    return DataStore(temp_dir)


@pytest.fixture
def mock_c3d_file_content():
    """Mock C3D file content for testing."""
    return {
        'header': {
            'points': {'first_frame': [1], 'last_frame': [5000]},
            'analogs': {'size': [2]}
        },
        'parameters': {
            'ANALOG': {
                'RATE': {'value': [1000.0]},
                'LABELS': {'value': ['CH1', 'CH2']}
            },
            'POINT': {
                'RATE': {'value': [100.0]}
            }
        }
    }


# Test configuration
pytest_plugins = []

# Custom markers
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "unit: mark test as a unit test"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as an integration test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )