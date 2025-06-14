# GHOSTLY+ EMG C3D Analyzer - Backend

This directory contains the backend server for the GHOSTLY+ EMG C3D Analyzer application. It's a FastAPI-based API responsible for processing C3D files, performing EMG analysis, and serving the results.

## Architecture

The backend is structured as a standard Python package. The primary components are:

-   `api.py`: Defines all the FastAPI endpoints. This is the main interface for the frontend to interact with the server. It handles file uploads, requests for data, and serves analysis results.
-   `processor.py`: The core processing engine. The `GHOSTLYC3DProcessor` class handles loading C3D files, extracting metadata and EMG data, detecting muscle contractions, and calculating analytics.
-   `models.py`: Contains all Pydantic data models used for API request and response validation, ensuring data consistency.
-   `emg_analysis.py`: A module with standalone functions for specific EMG metric calculations (e.g., RMS, MAV).
-   `plotting.py`: Contains functions to generate plots and reports from the processed data using Matplotlib.
-   `main.py`: The main entry point for the application, responsible for launching the Uvicorn server.
-   `tests/`: Contains integration tests for the API endpoints.

## How it Works

1.  A C3D file is uploaded via the `/upload` endpoint in `api.py`.
2.  `api.py` creates an instance of `GHOSTLYC3DProcessor` from `processor.py`.
3.  The processor loads the file, extracts EMG signals, and runs the analysis pipeline (detecting contractions, calculating metrics via functions from `emg_analysis.py`).
4.  The results, including metadata and calculated analytics, are structured using models from `models.py` and saved as a JSON file in the `data/results` directory.
5.  Other endpoints in `api.py` allow the frontend to retrieve the list of results, specific result details, raw data, or generated plots. 