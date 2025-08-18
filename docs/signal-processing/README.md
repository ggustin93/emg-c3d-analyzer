# GHOSTLY+ EMG Signal Processing Documentation

## Overview

This directory contains comprehensive technical documentation for EMG signal processing in the GHOSTLY+ C3D Analyzer rehabilitation platform.

## Documentation Structure

### Core Processing Documents

#### 📊 **[Signal Types & Architecture](./signal-types-architecture.md)**
- Three signal types: Raw, Activated, RMS Envelope
- Signal comparison analysis
- Processing pipelines with LaTeX formulas
- Research evidence and clinical validation

#### 🎯 **[Contraction Detection](./contraction-detection.md)** 
- Threshold-based detection algorithm
- Boundary detection and merging logic
- Duration filtering and quality assessment
- Current RMS-only vs. recommended hybrid approach

#### 📈 **[MVC Calibration](./mvc-calibration.md)**
- MVC estimation hierarchy and algorithms
- 95th percentile clinical estimation
- Confidence scoring and validation
- Database integration patterns

#### 🔬 **[Spectral Analysis](./spectral-analysis.md)**
- Frequency domain analysis (MPF, MDF, Fatigue Index)
- Temporal statistical analysis
- Welch's method implementation
- Clinical applications and interpretation

## Quick Navigation

**Getting Started:**
1. [Signal Types & Architecture](./signal-types-architecture.md) - Understanding the three-signal system
2. [Contraction Detection](./contraction-detection.md) - Core detection algorithm

**Advanced Topics:**
- [Spectral Analysis](./spectral-analysis.md) - Frequency domain processing  
- [MVC Calibration](./mvc-calibration.md) - Clinical threshold management

## Implementation Status

- ✅ **Signal Processing**: Comprehensive time and frequency domain analysis
- ✅ **MVC System**: Clinical-grade estimation and management  
- ✅ **Threshold Optimization**: Updated to 10% based on 2024-2025 clinical research
- ⚠️ **Hybrid Approach**: Recommended Activated/RMS strategy requires implementation
