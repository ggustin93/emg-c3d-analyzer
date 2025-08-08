# GHOSTLY+ EMG Analysis API

FastAPI backend for C3D file processing and EMG analysis.

**Base URL**: `http://localhost:8000`

## Authentication

Supabase Auth with JWT tokens.

```http
Authorization: Bearer <jwt_token>
```

## Endpoints

### `GET /`

Returns API information.

**Response**:
```json
{
  "name": "GHOSTLY+ EMG Analysis API",
  "version": "1.0.0",
  "description": "API for processing C3D files containing EMG data from the GHOSTLY rehabilitation game",
  "endpoints": {
    "upload": "POST /upload - Upload and process a C3D file",
    "export": "POST /export - Export comprehensive analysis data as JSON"
  }
}
```

### `POST /upload`

Upload and process C3D file.

**Content-Type**: `multipart/form-data`

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file` | File | ✅ | - | C3D file |
| `user_id` | string | ❌ | null | User identifier |
| `patient_id` | string | ❌ | null | Patient identifier |
| `session_id` | string | ❌ | null | Session identifier |
| `threshold_factor` | float | ❌ | 0.2 | Contraction detection threshold |
| `min_duration_ms` | int | ❌ | 100 | Minimum contraction duration |
| `smoothing_window` | int | ❌ | 50 | Signal smoothing window |
| `session_mvc_value` | float | ❌ | null | MVC value for session |
| `session_mvc_threshold_percentage` | float | ❌ | 30.0 | MVC threshold percentage |
| `session_expected_contractions` | int | ❌ | null | Expected contractions |
| `session_expected_contractions_ch1` | int | ❌ | null | Expected contractions CH1 |
| `session_expected_contractions_ch2` | int | ❌ | null | Expected contractions CH2 |
| `contraction_duration_threshold` | int | ❌ | 2000 | Global duration threshold (ms) |

**Response**: `EMGAnalysisResult`
```json
{
  "file_id": "uuid",
  "timestamp": "20250729_143022",
  "source_filename": "file.c3d",
  "metadata": {
    "game_name": "GHOSTLY",
    "level": "Level 1",
    "duration": 120.5,
    "score": 850.0,
    "session_parameters_used": {
      "contraction_duration_threshold": 2000,
      "session_mvc_threshold_percentage": 75
    }
  },
  "analytics": {
    "CH1": {
      "contraction_count": 18,
      "avg_duration_ms": 1250.0,
      "avg_amplitude": 85.2,
      "rms": 72.4,
      "mav": 68.1,
      "mpf": 125.3,
      "fatigue_index_fi_nsm5": -0.25
    }
  },
  "available_channels": ["CH1", "CH2"],
  "emg_signals": {
    "CH1": {
      "sampling_rate": 2000.0,
      "time_axis": [0.0, 0.0005, 0.001],
      "data": [0.12, 0.15, 0.18],
      "rms_envelope": [12.5, 15.2, 18.1]
    }
  }
}
```

### `POST /export`

Export comprehensive analysis data.

**Parameters**: Same as `/upload` plus:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_raw_signals` | bool | true | Include raw signal data |
| `include_debug_info` | bool | true | Include debug information |

**Response**: Comprehensive export JSON with analysis results, metadata, and debug info.

## Models

### `EMGAnalysisResult`
```python
{
  "file_id": str,
  "timestamp": str,
  "source_filename": str,
  "metadata": GameMetadata,
  "analytics": Dict[str, ChannelAnalytics],
  "available_channels": List[str],
  "emg_signals": Dict[str, EMGChannelSignalData],
  "user_id": Optional[str],
  "patient_id": Optional[str],
  "session_id": Optional[str]
}
```

### `ChannelAnalytics`
```python
{
  "contraction_count": int,
  "avg_duration_ms": float,
  "avg_amplitude": float,
  "max_amplitude": float,
  "rms": float,
  "mav": float,
  "mpf": Optional[float],
  "mdf": Optional[float],
  "fatigue_index_fi_nsm5": Optional[float],
  "contractions": Optional[List[Contraction]]
}
```

### `Contraction`
```python
{
  "start_time_ms": float,
  "end_time_ms": float,
  "duration_ms": float,
  "mean_amplitude": float,
  "max_amplitude": float,
  "is_good": Optional[bool]
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Invalid file format or parameters |
| 401 | Unauthorized | Missing/invalid JWT token |
| 413 | Payload Too Large | File exceeds 10MB limit |
| 422 | Unprocessable Entity | Invalid parameter values |
| 500 | Internal Server Error | Processing error |