# GHOSTLY+ Dashboard

A rehabilitation technology platform for analyzing Electromyography (EMG) data from C3D motion capture files, developed as part of the GHOSTLY+ serious game project for elderly rehabilitation.

<details open>
<summary>⚠️ <strong>Research Software Notice</strong></summary>

The Ghostly+ Dashboard is developed as part of the GHOSTLY+ rehabilitation research project. It is intended for **research and educational purposes only** and is **not validated for medical diagnosis or production clinical use**.

</details>


## Video Demo

<div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
  <iframe 
    src="https://player.vimeo.com/video/1119476263" 
    style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
    frameBorder="0" 
    allow="autoplay; fullscreen; picture-in-picture" 
    allowFullScreen
    title="Ghostly+ Dashboard Demo">
  </iframe>
</div>

## What It Does

The Ghostly+ Dashboard processes electromyography (EMG) data from rehabilitation game sessions.  
It analyzes C3D motion capture files to provide therapists with muscle activity measurements, compliance scores, and session performance metrics for elderly participants (65+) undergoing Blood Flow Restriction therapy.

### Key Features
- **EMG Signal Processing** – Contraction detection, RMS, MAV, frequency analysis, fatigue indices  
- **GHOSTLY+ Integration** – Seamless processing of C3D files from the serious game  
- **Clinical Metrics** – Compliance, symmetry, effort, and rehabilitation performance analysis  
- **Research Tools** – Data export capabilities and detailed analytics  
- **Healthcare-Oriented Design** – Role-based access, audit logging, HIPAA considerations (research-level, not production-certified)  

---

## Quick Start

> ℹ️ The repository address still uses the historical name `emg-c3d-analyzer`.

```bash
# Clone the repository
git clone https://github.com/ggustin93/emg-c3d-analyzer.git
cd emg-c3d-analyzer

# Choose your development method:

# Option A: Native Development
./start_dev_simple.sh    # Runs backend + frontend locally

# Option B: Docker Development
./start_dev_docker.sh    # Runs in isolated containers with cross-platform support

Your app will be running at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Docs**: http://localhost:8080/docs

For detailed setup instructions, see [Getting Started Guide](docusaurus/docs/getting-started.md).

## Documentation Overview

| Section | Description |
|---------|-------------|
| **[🚀 Getting Started](docusaurus/docs/getting-started.md)** | Set up and run the system in 5 minutes |
| **[🏗️ Architecture](docusaurus/docs/architecture.md)** | System design and technical architecture |
| **[🏥 Clinical](docusaurus/docs/clinical/metrics-definitions.md)** | Clinical metrics and scoring algorithms |
| **[📊 Signal Processing](docusaurus/docs/signal-processing/overview.md)** | EMG signal analysis pipeline |
| **[⚙️ Backend](docusaurus/docs/backend.md)** | FastAPI server and processing engine |
| **[🎨 Frontend](docusaurus/docs/frontend/overview.md)** | React application and user interface |
| **[🧪 Testing](docusaurus/docs/testing.md)** | Test suites and quality assurance |
| **[🚀 DevOps](docusaurus/docs/devops/devops.md)** | Deployment and CI/CD pipelines |
| **[🛠️ Development](docusaurus/docs/development.md)** | Development workflow and Claude Code integration |
| **[📍 Roadmap](docusaurus/docs/roadmap/work-in-progress.md)** | Upcoming features and improvements |


---
