# Signal Processing Pipeline

## Overview

The EMG C3D Analyzer implements a standardized signal processing pipeline for clinical EMG analysis. This document describes the processing parameters and methodology used for contraction detection and muscle activation analysis.

## Processing Pipeline

The system applies the following processing chain to raw EMG signals:

```
Raw Signal → High-pass Filter → Rectification → Low-pass Filter → Moving Average → RMS Envelope
```

### Processing Parameters

| Parameter | Value | Clinical Rationale |
|-----------|-------|-------------------|
| **High-pass Filter** | 20 Hz, 4th order Butterworth | Remove DC offset and baseline drift |
| **Rectification** | Full-wave rectification | Convert to positive values for amplitude analysis |
| **Low-pass Filter** | 10 Hz, 4th order Butterworth | Create smooth envelope from rectified signal |
| **Moving Average** | 50 ms window | Additional envelope smoothing |

### Contraction Detection Parameters

| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| **Threshold Factor** | 30% of max amplitude | Minimum signal level for contraction detection |
| **Minimum Duration** | 250 ms | Minimum contraction duration for validity |
| **Smoothing Window** | 50 samples | Moving average window for signal smoothing |
| **Merge Threshold** | 200 ms | Maximum gap between contractions to merge them |

## Export Metadata

Processed signals in exported JSON include complete pipeline metadata:

- **Processing Parameters**: All filter specifications and thresholds used
- **Clinical Justifications**: Literature-based rationale for each parameter
- **Processing Steps**: Exact sequence of operations applied to each signal
- **Quality Metrics**: Signal validation and statistical measures

## Technical Implementation

- **Filter Type**: Butterworth filters for optimal frequency response
- **Processing Library**: SciPy for signal filtering and analysis
- **Data Format**: Float64 precision for numerical stability
- **Quality Validation**: Signal-to-noise ratio and variation checks

## Differences from C3D "Activated" Channels

This pipeline processes raw signals with documented, controlled parameters. Results may differ from pre-processed "activated" channels in C3D files due to:

1. Different filter specifications
2. Different threshold algorithms
3. Different smoothing parameters
4. Different contraction detection logic

For reproducible research, use the documented pipeline parameters rather than pre-processed channels.