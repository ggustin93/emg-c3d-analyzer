---
sidebar_position: 4
title: First Analysis
---

# Your First EMG Analysis

Learn how to process and understand your first C3D file analysis.

## Before You Begin

Ensure you have:
- ✅ Application running (frontend and backend)
- ✅ Supabase configured
- ✅ A C3D file ready (or use our test file)

## Step 1: Upload a C3D File

### Using the Web Interface

1. **Navigate to Upload Tab**
   - Open http://localhost:3000
   - Click on the "Upload" tab

2. **Select Your File**
   - Click "Choose File"
   - Select a C3D file (max 10MB)
   - Or use our test file: `Ghostly_Emg_20230321_17-50-17-0881.c3d`

3. **Process the File**
   - Click "Upload and Process"
   - Wait for processing (typically 2-5 seconds)

### Using the API

```bash
# Upload via curl
curl -X POST http://localhost:8080/upload/c3d \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/your/file.c3d"
```

## Step 2: Understanding the Results

### Overview Tab

The overview displays key metrics:

```json
{
  "duration": 175.1,        // Total recording duration (seconds)
  "sampling_rate": 990,     // Hz
  "channels": {
    "CH1": {
      "contractions": 20,   // Number of contractions detected
      "avg_duration": 2.3,  // Average contraction duration (s)
      "total_work": 45.6    // Total work time (s)
    },
    "CH2": {
      "contractions": 9,
      "avg_duration": 1.8,
      "total_work": 16.2
    }
  }
}
```

### Signal Visualization

#### EMG Plot Features

- **Blue Line**: Raw EMG signal
- **Orange Line**: Filtered signal envelope
- **Green Highlights**: Detected contractions
- **Red Line**: MVC threshold (20%)

#### Interactive Controls

- **Zoom**: Scroll or pinch to zoom
- **Pan**: Click and drag to navigate
- **Reset**: Double-click to reset view

### Contraction Analysis

#### Contraction Table

| # | Channel | Start (s) | End (s) | Duration (s) | Peak (μV) | RMS (μV) |
|---|---------|-----------|---------|--------------|-----------|----------|
| 1 | CH1     | 12.5      | 14.8    | 2.3          | 850       | 425      |
| 2 | CH1     | 18.2      | 20.1    | 1.9          | 920       | 460      |

#### Key Metrics Explained

- **Duration**: Time from onset to offset
- **Peak Amplitude**: Maximum signal value during contraction
- **RMS**: Root Mean Square - average power
- **Work-Rest Ratio**: Active time vs rest time

### Performance Metrics

#### Statistical Analysis

```typescript
{
  // Time Domain Metrics
  rms: 245.6,              // Root Mean Square (μV)
  mav: 198.3,              // Mean Absolute Value (μV)
  peak_amplitude: 1250.8,  // Maximum amplitude (μV)
  
  // Frequency Domain Metrics
  mpf: 125.4,              // Mean Power Frequency (Hz)
  mdf: 118.7,              // Median Frequency (Hz)
  
  // Fatigue Analysis
  fatigue_index: 0.23,     // Fatigue progression (0-1)
  endurance_time: 45.2     // Time to fatigue (s)
}
```

## Step 3: Export Your Results

### Available Export Formats

#### CSV Export
```csv
Time,CH1_Raw,CH1_Filtered,CH2_Raw,CH2_Filtered
0.001,125.3,118.2,98.5,95.3
0.002,128.7,120.1,101.2,97.8
...
```

#### JSON Export
```json
{
  "metadata": {
    "file": "example.c3d",
    "date": "2024-01-15",
    "duration": 175.1
  },
  "data": {
    "signals": [...],
    "contractions": [...],
    "metrics": {...}
  }
}
```

#### PDF Report
- Summary statistics
- EMG plots
- Contraction analysis
- Clinical interpretation

## Step 4: Clinical Interpretation

### Performance Scoring

The system provides automated performance scores:

```typescript
{
  overall_score: 82,       // 0-100 scale
  components: {
    strength: 85,          // Peak force capability
    endurance: 78,         // Sustained performance
    coordination: 80,      // Bilateral symmetry
    fatigue_resistance: 84 // Fatigue progression
  }
}
```

### Interpretation Guidelines

#### Excellent (90-100)
- High peak amplitudes
- Consistent contractions
- Minimal fatigue
- Good bilateral symmetry

#### Good (70-89)
- Moderate amplitudes
- Some variability
- Normal fatigue progression
- Acceptable symmetry

#### Fair (50-69)
- Below-average amplitudes
- Inconsistent patterns
- Early fatigue onset
- Asymmetry present

#### Poor (Below 50)
- Low amplitudes
- Very inconsistent
- Rapid fatigue
- Significant asymmetry

## Common Issues

### No Contractions Detected

**Possible Causes:**
- MVC threshold too high
- Signal quality issues
- Incorrect channel selection

**Solution:**
```python
# Adjust threshold in configuration
MVC_THRESHOLD=0.15  # Lower from 0.20 to 0.15
```

### Noisy Signal

**Symptoms:**
- Irregular baseline
- Many false positives
- Erratic envelope

**Solution:**
- Check electrode placement
- Verify filter settings
- Review signal quality metrics

### Processing Errors

**Error: "File too large"**
```bash
# Increase limit in .env
MAX_FILE_SIZE=20971520  # 20MB
```

**Error: "Invalid C3D format"**
- Ensure file is properly formatted
- Check C3D version compatibility
- Verify file isn't corrupted

## Next Steps

Now that you've completed your first analysis:

1. **Explore Advanced Features**
   - [Custom MVC Calibration](/docs/api/endpoints/mvc)
   - [Batch Processing](/docs/examples/batch-processing)
   - [Real-time Streaming](/docs/supabase/realtime-subscriptions)

2. **Customize Processing**
   - [Modify Filter Parameters](/docs/signal-processing/butterworth-filtering)
   - [Adjust Detection Thresholds](/docs/signal-processing/contraction-detection)
   - [Add Custom Metrics](/docs/examples/add-emg-metric)

3. **Integrate with Your Workflow**
   - [API Integration](/docs/api/endpoints/upload)
   - [Webhook Setup](/docs/backend/webhook-processing)
   - [Database Storage](/docs/supabase/database-schema)

## Questions?

- Check [Troubleshooting Guide](/docs/cookbook/common-issues)
- Review [API Documentation](/docs/api/endpoints/upload)
- Explore [Signal Processing Details](/docs/signal-processing/overview)