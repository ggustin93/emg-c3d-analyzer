# GHOSTLY+ EMG C3D Analyzer - Backend (KISS Architecture)

This directory contains the backend server for the GHOSTLY+ EMG C3D Analyzer application. It's a FastAPI-based API responsible for processing C3D files, performing EMG analysis, and serving the results in a stateless architecture optimized for cloud deployment.

## Architecture

The backend follows **KISS principles** with a clean, minimal structure. All data processing happens in-memory and results are bundled in the API response. This design eliminates the need for persistent file storage and makes the system ideal for deployment on platforms like Render's free tier.

### Directory Structure

```
backend/
├── api/api.py                    # FastAPI endpoints
├── models/models.py              # Pydantic models
├── services/
│   ├── c3d_processor.py         # High-level C3D processing workflow
│   ├── export_service.py        # Data export functionality
│   └── mvc_service.py           # MVC estimation service
├── emg/
│   ├── emg_analysis.py          # EMG metrics calculation
│   └── signal_processing.py    # Low-level signal operations
├── config.py                    # Unified configuration
└── main.py                      # Application entry point
```

### Component Roles

- **api.py**: 🌐 FastAPI endpoints for C3D upload, processing, and MVC estimation
- **c3d_processor.py**: 🏗️ High-level business logic service orchestrating the complete C3D workflow
- **signal_processing.py**: ⚡ Low-level EMG signal operations (filtering, smoothing, envelope calculation)
- **emg_analysis.py**: 📊 EMG metrics calculation and contraction detection algorithms
- **models.py**: 📋 Pydantic models for data validation and serialization
- **config.py**: ⚙️ Unified configuration management

## Stateless Data Flow

The backend implements a **bundled response pattern** that eliminates the need for multiple API calls:

1. A C3D file is uploaded via the `/upload` endpoint
2. `c3d_processor.py` orchestrates the complete workflow:
   - Loads C3D file and extracts EMG signals
   - Applies signal processing pipeline via `signal_processing.py`
   - Calculates clinical metrics via `emg_analysis.py`
   - Detects contractions with quality assessment
3. All results are structured using Pydantic models and returned in a single response
4. No files are persisted - the system is completely stateless for optimal cloud deployment

## Import Patterns
- **API**: `from backend.api.api import app`
- **Processing**: `from backend.services.c3d_processor import GHOSTLYC3DProcessor`
- **Analysis**: `from backend.emg.emg_analysis import analyze_contractions`
- **Signal Processing**: `from backend.emg.signal_processing import preprocess_emg_signal`
- **Models**: `from backend.models.models import EMGAnalysisResult, GameSessionParameters`

## Resilient Channel Handling

The backend implements **flexible C3D channel processing** to handle various naming conventions:

- **Raw Channel Names**: Preserves original C3D channel names as data keys
- **Activated Signal Detection**: Automatically detects and processes both "Raw" and "activated" signal variants *Note: Research ongoing to understand GHOSTLY's "Activated" channel processing for optimal analysis implementation*
- **Muscle Mapping Support**: Supports user-defined channel-to-muscle name mappings for display purposes
- **Fallback Mechanisms**: Gracefully handles missing or differently named channels

## Advanced EMG Analysis

The system includes **clinically validated EMG metrics**:

- **Amplitude Analysis**: RMS, MAV with temporal windowing and statistical analysis
- **Frequency Analysis**: Mean Power Frequency (MPF), Median Frequency (MDF)
- **Fatigue Assessment**: Dimitrov's Fatigue Index with sliding window analysis
- **Temporal Statistics**: Mean, standard deviation, coefficient of variation for all metrics
- **Contraction Detection**: Adaptive thresholding with MVC-based validation 