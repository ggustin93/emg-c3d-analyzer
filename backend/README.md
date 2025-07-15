# GHOSTLY+ EMG C3D Analyzer - Backend

This directory contains the backend server for the GHOSTLY+ EMG C3D Analyzer application. It's a FastAPI-based API responsible for processing C3D files, performing EMG analysis, and serving the results in a stateless architecture optimized for cloud deployment.

## Architecture

The backend follows a **stateless architecture** where all data processing happens in-memory and results are bundled in the API response. This design eliminates the need for persistent file storage and makes the system ideal for deployment on platforms like Render's free tier.

### Primary Components

-   `api.py`: Defines all the FastAPI endpoints. The main `/upload` endpoint processes C3D files and returns comprehensive analysis results including all signal data needed for client-side visualization.
-   `processor.py`: The core processing engine. The `GHOSTLYC3DProcessor` class handles loading C3D files, extracting metadata and EMG data, detecting muscle contractions, and calculating analytics using advanced biomedical algorithms.
-   `models.py`: Contains all Pydantic data models used for API request and response validation, ensuring data consistency. Imports configuration constants from `config.py`.
-   `emg_analysis.py`: Advanced EMG analysis module with clinically validated functions for RMS, MAV, frequency domain analysis (MPF, MDF), and Dimitrov's fatigue index calculations.
-   `config.py`: Centralized configuration management for processing parameters, API settings, and system constants.
-   `main.py`: The main entry point for the application, responsible for launching the Uvicorn server.
-   `tests/`: Contains integration tests for the API endpoints.

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

## Resilient Channel Handling

The backend implements **flexible C3D channel processing** to handle various naming conventions:

- **Raw Channel Names**: Preserves original C3D channel names as data keys
- **Activated Signal Detection**: Automatically detects and processes both "Raw" and "activated" signal variants
- **Muscle Mapping Support**: Supports user-defined channel-to-muscle name mappings for display purposes
- **Fallback Mechanisms**: Gracefully handles missing or differently named channels

## Advanced EMG Analysis

The system includes **clinically validated EMG metrics**:

- **Amplitude Analysis**: RMS, MAV with temporal windowing and statistical analysis
- **Frequency Analysis**: Mean Power Frequency (MPF), Median Frequency (MDF)
- **Fatigue Assessment**: Dimitrov's Fatigue Index with sliding window analysis
- **Temporal Statistics**: Mean, standard deviation, coefficient of variation for all metrics
- **Contraction Detection**: Adaptive thresholding with MVC-based validation 