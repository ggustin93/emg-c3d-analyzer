# GHOSTLY+ EMG C3D Analyzer - Backend (KISS Architecture)

This directory contains the backend server for the GHOSTLY+ EMG C3D Analyzer application. It's a FastAPI-based API responsible for processing C3D files, performing EMG analysis, and serving the results in a stateless architecture optimized for cloud deployment.

## Architecture

The backend follows **KISS principles** with a clean, minimal structure supporting both real-time processing and automated workflows:

- **Real-time Processing**: Direct C3D upload via `/upload` endpoint with bundled response
- **Automated Processing**: Supabase Storage webhooks for background C3D analysis
- **Database Integration**: Analysis results cached with researcher authentication (RLS)
- **Stateless Design**: Maintains cloud deployment compatibility

### Directory Structure

```
backend/
├── api/
│   ├── api.py                   # FastAPI endpoints
│   └── webhooks.py              # Webhook endpoints for automated processing
├── models/models.py              # Pydantic models
├── services/
│   ├── c3d_processor.py         # High-level C3D processing workflow
│   ├── therapy_session_processor.py # Clean webhook business logic
│   ├── webhook_security.py     # Webhook security service
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
- **webhooks.py**: 🔗 Clean webhook endpoints following SOLID principles
- **c3d_processor.py**: 🏗️ High-level business logic service orchestrating the complete C3D workflow
- **therapy_session_processor.py**: ⚙️ Clean webhook business logic with actual database schema
- **webhook_security.py**: 🔒 Secure webhook signature verification service
- **signal_processing.py**: ⚡ Low-level EMG signal operations (filtering, smoothing, envelope calculation)
- **emg_analysis.py**: 📊 EMG metrics calculation and contraction detection algorithms
- **models.py**: 📋 Pydantic models for data validation and serialization
- **config.py**: ⚙️ Unified configuration management

## Data Processing Architecture

The backend supports two complementary processing modes:

### Real-time Processing (Stateless)
1. C3D file uploaded via `/upload` endpoint
2. Complete analysis performed in-memory and returned immediately
3. No persistent storage - optimal for cloud deployment

### Automated Processing (Database-Cached)
1. Supabase Storage webhook triggers on C3D upload
2. Background processing with results cached in database
3. Row Level Security ensures only authenticated researchers access data
4. Analysis format matches `/upload` endpoint for frontend compatibility

## Import Patterns
- **API**: `from backend.api.api import app`
- **Webhooks**: `from backend.api.webhooks import router as webhook_router`
- **Processing**: `from backend.services.c3d_processor import GHOSTLYC3DProcessor`
- **Therapy Session**: `from backend.services.therapy_session_processor import TherapySessionProcessor`
- **Webhook Security**: `from backend.services.webhook_security import WebhookSecurity`
- **Analysis**: `from backend.emg.emg_analysis import analyze_contractions`
- **Signal Processing**: `from backend.emg.signal_processing import preprocess_emg_signal`
- **Models**: `from backend.models.models import EMGAnalysisResult, GameSessionParameters`

## Resilient Channel Handling

The backend implements **flexible C3D channel processing** to handle various naming conventions:

- **Raw Channel Names**: Preserves original C3D channel names as data keys
- **Dual Signal Processing**: Implements hybrid approach using both "Raw" and "activated" signal variants for optimal contraction detection
- **Muscle Mapping Support**: Supports user-defined channel-to-muscle name mappings for display purposes
- **Fallback Mechanisms**: Gracefully handles missing or differently named channels

## Advanced EMG Analysis

The system includes **clinically validated EMG metrics**:

- **Amplitude Analysis**: RMS, MAV with temporal windowing and statistical analysis
- **Frequency Analysis**: Mean Power Frequency (MPF), Median Frequency (MDF)
- **Fatigue Assessment**: Dimitrov's Fatigue Index with sliding window analysis
- **Temporal Statistics**: Mean, standard deviation, coefficient of variation for all metrics
- **Dual Signal Contraction Detection**: Hybrid approach using activated signals for temporal detection and RMS envelope for amplitude assessment

## GHOSTLY+ Performance Scoring

The system implements **official GHOSTLY+ clinical trial metrics** following the multicenter RCT specification:

- **Overall Performance Score**: `P_overall = w_c × S_compliance + w_s × S_symmetry + w_e × S_effort + w_g × S_game`
- **Therapeutic Compliance**: Per-muscle compliance using completion, intensity, and duration rates with equal weighting (1/3 each)
- **Bilateral Symmetry**: CH1/CH2 analysis using `S_symmetry = (1 - |left - right| / (left + right))`
- **Clinical Effort Assessment**: RPE-based scoring with amplitude proxy when RPE unavailable
- **Game Performance Integration**: Game points achievement relative to maximum achievable points
- **GHOSTLY+ Weights**: Compliance (40%), Symmetry (25%), Effort (20%), Game (15%)
- **Clinical Validation**: Optimized for hospitalized older adults (≥65 years) with mobility restrictions

### Dual Signal Detection Algorithm

The system implements an advanced **dual signal detection approach** that addresses baseline noise issues:

- **Temporal Detection**: Uses cleaner "activated" signals (5% threshold) for precise contraction timing
- **Amplitude Assessment**: Uses RMS envelope (10% threshold) for accurate MVC compliance
- **Baseline Noise Reduction**: 2x cleaner signal-to-noise ratio compared to single signal detection
- **Physiological Parameters**: 150ms merge threshold, 50ms refractory period based on EMG research
- **Backward Compatibility**: Gracefully falls back to single signal detection when activated channels unavailable

## Webhook System

Automated C3D processing via Supabase Storage events:
- **Security**: HMAC-SHA256 signature verification with service key authentication
- **Database**: Analysis results cached with researcher authentication (RLS)
- **Compatibility**: Webhook data format matches `/upload` endpoint response
- **Testing**: ngrok tunnel required for local development webhook testing

### Webhook Testing Setup

For testing webhooks with Supabase Storage uploads:

```bash
# 1. Install and configure ngrok (one-time setup)
# Download from: https://ngrok.com/download
# Sign up: https://dashboard.ngrok.com/signup
# Get token: https://dashboard.ngrok.com/get-started/your-authtoken
./ngrok config add-authtoken YOUR_NGROK_TOKEN

# 2. Start development environment with integrated webhook testing
cd ../  # Go to project root
./start_dev.sh --webhook
# This automatically starts backend + frontend + ngrok tunnel
# and displays webhook configuration instructions

# 3. Configure webhook URL shown in startup output in Supabase Dashboard
# Example: https://abc123.ngrok-free.app/webhooks/storage/c3d-upload

# 4. Monitor webhook activity
tail -f logs/backend.error.log | grep -E "(🚀|📁|🔄|✅|❌|📊)"

# 5. Test by uploading C3D files via Supabase Dashboard
```

**Expected Flow**: Upload → Webhook Trigger → File Download → C3D Processing → Database Caching → Success Response

## Technical Implementation Details

### Signal Processing Pipeline

The backend implements a sophisticated EMG signal processing pipeline:

1. **Multi-Channel Detection**: Automatically identifies Raw and Activated signal variants
2. **Dual Signal Extraction**: Processes both signal types for optimal analysis
3. **Hybrid Detection Algorithm**: Uses activated signals for timing, RMS for amplitude
4. **Physiological Validation**: Applies research-based parameters for clinical accuracy

For detailed technical documentation, see [`docs/signal-processing/`](../docs/signal-processing/) 