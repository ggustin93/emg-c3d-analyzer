# GHOSTLY+ EMG C3D Analyzer - Backend (DDD Layout)

This directory contains the backend server for the GHOSTLY+ EMG C3D Analyzer application. It's a FastAPI-based API responsible for processing C3D files, performing EMG analysis, and serving the results in a stateless architecture optimized for cloud deployment.

## Architecture

The backend follows a **stateless architecture** where all data processing happens in-memory and results are bundled in the API response. This design eliminates the need for persistent file storage and makes the system ideal for deployment on platforms like Render's free tier.

### Primary Components (import surfaces)

-   `domain/analysis.py`: EMG analysis functions and registry (use this instead of `emg_analysis.py`).
-   `domain/processing.py`: Standardized signal processing API (use this instead of `signal_processing.py`).
-   `domain/models.py`: Pydantic models import surface (wraps `models.py`).
-   `application/processor_service.py`: Orchestrates processing (compat alias to legacy `processor.py`).
-   `application/mvc_service.py`: MVC estimation service import surface.
-   `interfaces/api.py`: FastAPI app import surface (wraps legacy `api.py`).
-   `infrastructure/exporting.py`: Export utilities import surface.
-   Legacy modules (`emg_analysis.py`, `signal_processing.py`, `processor.py`, `api.py`, `export_utils.py`) remain for compatibility. Prefer the surfaces above for new code.

## Stateless Data Flow

The backend implements a **bundled response pattern** that eliminates the need for multiple API calls:

1.  A C3D file is uploaded via the `/upload` endpoint in `api.py`.
2.  `api.py` creates an instance of `GHOSTLYC3DProcessor` from `processor.py`.
3.  The processor loads the file, extracts EMG signals, and runs the comprehensive analysis pipeline:
    - Detects muscle contractions using adaptive thresholding
    - Calculates temporal analysis metrics with statistical validation
    - Computes frequency domain features and fatigue indicators
    - Generates RMS envelopes for visualization
4.  All results, including metadata, analytics, and complete signal data, are structured using models from `models.py` and returned in a single response.
5.  No files are persisted to disk - the system is completely stateless for optimal cloud deployment.

## Recommended Imports
- Domain logic: `from backend.domain.analysis import analyze_contractions`
- Processing: `from backend.domain.processing import preprocess_emg_signal, ProcessingParameters`
- Models: `from backend.domain.models import GameSessionParameters, EMGAnalysisResult`
- Application: `from backend.application import ProcessorService, mvc_service`
- HTTP: `from backend.interfaces.api import app`

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