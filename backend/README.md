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
│   ├── webhook_service.py       # Webhook processing logic
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
- **webhooks.py**: 🔗 Webhook endpoints for automated Supabase Storage processing
- **c3d_processor.py**: 🏗️ High-level business logic service orchestrating the complete C3D workflow
- **webhook_service.py**: ⚙️ Background processing logic for webhook-triggered analysis
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
- **Webhook Service**: `from backend.services.webhook_service import process_c3d_webhook`
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