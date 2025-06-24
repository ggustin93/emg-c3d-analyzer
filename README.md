# EMG C3D Analyzer (GHOSTLY+)

A web-based tool for the analysis and visualization of Electromyography (EMG) data from C3D files, tailored for the GHOSTLY rehabilitation game platform.

![EMG C3D Analyzer Screenshot](assets/screenshot-v2.png)

## Core Features

*   **Intelligent C3D Processing:** Ingests C3D files and automatically distinguishes between "Raw" and "Activated" EMG signals for scientifically valid analysis.
*   **Comprehensive EMG Analytics:** Calculates key metrics for muscle fatigue and activity, including RMS, MAV, MPF, MDF, and Dimitrov's Fatigue Index.
*   **Interactive Visualization:** Generates plots of EMG signals and provides a clean UI for reviewing analytics.
*   **Decoupled & Modern Stack:** Built with a FastAPI backend and a React/TypeScript frontend.

## Technology Stack

*   **Backend:** Python 3.10+, FastAPI, Poetry
*   **Frontend:** React, TypeScript, Tailwind CSS, shadcn/ui
*   **Analysis:** `ezc3d`, `pandas`, `numpy`, `scipy`

---

## Getting Started

### Prerequisites

*   Git
*   Python 3.10+
*   Poetry
*   Node.js (LTS) & npm

### 1. Clone & Setup

First, clone the repository:
```bash
git clone https://github.com/ggustin93/emg-c3d-analyzer.git
cd emg-c3d-analyzer
```
### 2. Configure Virtual Environment (Recommended)

To ensure the `start_dev.sh` script works seamlessly, configure Poetry to create the virtual environment inside the project folder:
```bash
poetry config virtualenvs.in-project true
```

### 3. Run the Development Environment

The `start_dev.sh` script is the recommended way to launch the entire application. It handles all dependencies and starts both the backend and frontend servers concurrently.

**First, make the script executable:**
```bash
chmod +x start_dev.sh
```

**To run the development server:**
```bash
./start_dev.sh
```
*   **Backend API:** `http://localhost:8080`
*   **Frontend App:** `http://localhost:3000`

**For a clean dependency reinstall (if you encounter module errors):**
```bash
./start_dev.sh --clean
```
This will delete `node_modules` and `package-lock.json` before installing, which can resolve caching issues.

---

## Configuration

### Frontend API Endpoint

The frontend defaults to connecting to the backend at `http://localhost:8080`. To override this (for example, in a production deployment), you can either:

1.  Create a `frontend/.env` file with `REACT_APP_API_URL=your_backend_url`.
2.  Set the `REACT_APP_API_URL` as an environment variable in your deployment platform (e.g., Vercel, Netlify).

---

## Project Structure

```
emg-c3d-analyzer/
├── backend/            # FastAPI application source
├── frontend/           # React application source
├── data/               # (Git-ignored) For C3D uploads and results
├── logs/               # (Git-ignored) For development server logs
├── memory-bank/        # Agent-maintained project documentation
├── assets/             # Static assets like images
├── start_dev.sh        # Main development script
└── README.md
```

## Contributing

Contributions are welcome. Please feel free to submit a pull request or open an issue for bugs, feature requests, or suggestions.

## License

This project is licensed under the MIT License. See the `LICENSE.md` file for details.
