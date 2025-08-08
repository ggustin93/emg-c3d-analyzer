"""
Integration tests for the GHOSTLYC3DProcessor class
==================================================

These tests verify that the processor can correctly extract data from C3D files
and calculate analytics.
"""

import unittest
import sys
import os
from pathlib import Path
import tempfile
import shutil

# Get the absolute path to the project root directory
PROJECT_ROOT = str(Path(__file__).resolve().parents[2])

# Add the project root to the Python path
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.application.processor import GHOSTLYC3DProcessor
from backend.domain.models import ProcessingOptions, GameSessionParameters

class TestGHOSTLYC3DProcessor(unittest.TestCase):
    """Test suite for the GHOSTLYC3DProcessor class."""
    
    def setUp(self):
        """Set up test data."""
        # Create temporary directories for testing
        self.test_dir = tempfile.mkdtemp()
        
        # Find a sample C3D file for testing
        # Look in multiple possible locations
        possible_sample_dirs = [
            os.path.join(PROJECT_ROOT, "frontend", "public", "samples"),
            os.path.join(PROJECT_ROOT, "samples"),
            os.path.join(PROJECT_ROOT, "backend", "tests", "samples"),
        ]
        
        self.sample_file = None
        for sample_dir in possible_sample_dirs:
            if os.path.exists(sample_dir):
                sample_files = [f for f in os.listdir(sample_dir) if f.endswith(".c3d")]
                if sample_files:
                    self.sample_file = os.path.join(sample_dir, sample_files[0])
                    break
        
        if not self.sample_file:
            self.skipTest("No sample C3D files found in any of the expected directories")
            return
            
        self.test_file = os.path.join(self.test_dir, os.path.basename(self.sample_file))
        shutil.copy(self.sample_file, self.test_file)
        
        # Create a processor instance with the test file path
        self.processor = GHOSTLYC3DProcessor(file_path=self.test_file)
    
    def tearDown(self):
        """Clean up after tests."""
        # Remove temporary directories
        if hasattr(self, 'test_dir') and os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def test_load_file(self):
        """Test loading a C3D file."""
        self.processor.load_file()
        self.assertIsNotNone(self.processor.c3d)
    
    def test_extract_metadata(self):
        """Test extracting metadata from a C3D file."""
        metadata = self.processor.extract_metadata()
        self.assertIsNotNone(metadata)
        # At minimum, these fields should be present
        self.assertIn('level', metadata)
        self.assertIn('time', metadata)
    
    def test_extract_emg_data(self):
        """Test extracting EMG data from a C3D file."""
        emg_data = self.processor.extract_emg_data()
        self.assertIsNotNone(emg_data)
        self.assertGreater(len(emg_data), 0)
        
        # Check structure of first channel
        first_channel = list(emg_data.keys())[0]
        self.assertIn('data', emg_data[first_channel])
        self.assertIn('time_axis', emg_data[first_channel])
        self.assertIn('sampling_rate', emg_data[first_channel])
    
    def test_process_file(self):
        """Test the process_file method."""
        # Create processing options
        processing_opts = ProcessingOptions(
            threshold_factor=0.3,
            min_duration_ms=50,
            smoothing_window=25
        )
        
        session_params = GameSessionParameters(
            session_mvc_value=1.0,
            session_mvc_threshold_percentage=75.0,
            session_expected_contractions=10
        )
        
        # Process the file
        result = self.processor.process_file(processing_opts, session_params)
        
        # Check the result structure from process_file
        self.assertIsNotNone(result)
        self.assertIn('metadata', result)
        self.assertIn('analytics', result)
        self.assertIn('available_channels', result)
        
        # Check that EMG data was extracted
        self.assertIsNotNone(self.processor.emg_data)
        self.assertGreater(len(self.processor.emg_data), 0)

if __name__ == '__main__':
    unittest.main() 