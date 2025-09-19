---
sidebar_position: 1
title: API Overview
---

# API Reference

FastAPI-based REST API for EMG processing and analysis.

## Base URL
```
Development: http://localhost:8080
Production: https://api.your-domain.com
```

## Authentication
```http
Authorization: Bearer <JWT_TOKEN>
```

## Core Endpoints

### 📤 Processing Endpoints

#### POST /upload
**Stateless C3D Processing**
```http
POST /upload
Content-Type: multipart/form-data

Body: 
  file: <C3D file>
  parameters: {
    "mvc_percentage": 20,
    "min_contraction_time": 500,
    "sampling_rate": 1000
  }
```
Returns complete EMG analysis results immediately.

#### POST /webhooks/storage/c3d-upload  
**Supabase Storage Webhook**
```http
POST /webhooks/storage/c3d-upload
X-Supabase-Event-Signature: <HMAC signature>

Body: Supabase webhook payload
```
Processes files uploaded to Supabase Storage, saves results to database.

### 📊 Analysis Endpoints

#### GET /analysis/\{session_id\}/contractions
**Retrieve detected contractions**
```json
{
  "contractions": {
    "channel_1": [
      {
        "start": 5.2,
        "end": 6.8,
        "duration": 1.6,
        "peak_amplitude": 0.85
      }
    ]
  }
}
```

#### GET /analysis/\{session_id\}/statistics
**EMG statistical metrics**
```json
{
  "statistics": {
    "rms": 0.42,
    "mav": 0.38,
    "mpf": 82.5,
    "mdf": 78.3,
    "fatigue_index": 0.15
  }
}
```

### 💪 MVC Calibration

#### POST /mvc/calibrate
**Run MVC calibration protocol**
```json
{
  "session_id": "uuid",
  "calibration_type": "standard",
  "trials": 3
}
```

### 📁 Export Endpoints

#### GET /export/csv/\{session_id\}
**Export session data as CSV**
- Returns CSV file with EMG data, contractions, and metrics

#### GET /export/report/\{session_id\}
**Generate clinical report**  
- Returns PDF with visualizations and clinical summary

### ⚙️ Configuration

#### GET /scoring/configurations/active
**Get active scoring configuration**
```json
{
  "mvc_threshold": 20,
  "min_contraction_duration": 500,
  "fatigue_threshold": 0.2,
  "compliance_target": 80
}
```

## Response Format

### Success Response
```json
{
  "status": "success",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "status": "error",
  "detail": "Error message",
  "code": "ERROR_CODE"
}
```

## Rate Limiting
- 100 requests per minute per IP
- 1000 requests per hour per user

## OpenAPI Documentation
Available at `/docs` (Swagger UI) and `/redoc` (ReDoc)