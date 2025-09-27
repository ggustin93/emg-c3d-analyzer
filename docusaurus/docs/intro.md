---
sidebar_position: 1
title: Introduction
---

# Ghostly+ Dashboard Documentation

The Ghostly+ Dashboard processes electromyography (EMG) data from rehabilitation game sessions. It analyzes C3D motion capture files to provide therapists with muscle activity measurements, compliance scores, and session performance metrics for elderly patients (65+ years) undergoing rehabilitation therapy in combination with BFR in the context of a clinical trial.

The system supports three distinct user roles: **Therapists** monitor patient progress with access restricted to assigned patients, **Researchers** request analysis data with pseudonymized access only, and **Administrators** manage users and system configuration.

## Video Demo

<div style={{position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden'}}>
  <iframe 
    src="https://player.vimeo.com/video/1119476263" 
    style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
    frameBorder="0" 
    allow="autoplay; fullscreen; picture-in-picture" 
    allowFullScreen
    title="EMG C3D Analyzer Demo">
  </iframe>
</div>

## Documentation Overview

| Section | Description |
|---------|-------------|
| **[🚀 Getting Started](./getting-started.md)** | Set up and run the system in 5 minutes |
| **[🏗️ Architecture](./architecture.md)** | System design and technical architecture |
| **[🏥 Clinical](./clinical/metrics-definitions.md)** | Clinical metrics and scoring algorithms |
| **[📊 Signal Processing](./signal-processing/overview.md)** | EMG signal analysis pipeline |
| **[⚙️ Backend](./backend.md)** | FastAPI server and processing engine |
| **[🎨 Frontend](./frontend/overview.md)** | React application and user interface |
| **[🧪 Testing](./testing.md)** | Test suites and quality assurance |
| **[🚀 DevOps](./devops/devops.md)** | Deployment and CI/CD pipelines |
| **[🛠️ Development](./development.md)** | Development workflow and Claude Code integration |
| **[📍 Roadmap](./roadmap/ghostly-dashboards-handover.md)** | Upcoming features and improvements |