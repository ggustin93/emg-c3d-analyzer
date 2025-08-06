"""
EMG C3D Data Export Utilities
=============================

Utilities for exporting comprehensive C3D analysis results to structured JSON format.
Designed for debugging, data archival, and external analysis workflows.

Features:
- Complete metadata extraction
- Full EMG signal data export
- Comprehensive analysis results
- Processing parameters tracking
- Debug information inclusion
"""

import json
from datetime import datetime
from typing import Dict, Any, Optional
from .models import GameSessionParameters


class EMGDataExporter:
    """Comprehensive EMG data export utility."""
    
    def __init__(self, processor_instance):
        """
        Initialize exporter with processor instance.
        
        Args:
            processor_instance: GHOSTLYC3DProcessor instance with processed data
        """
        self.processor = processor_instance
    
    def create_comprehensive_export(self, 
                                   session_params: GameSessionParameters,
                                   processing_opts: Any,
                                   include_raw_signals: bool = True,
                                   include_debug_info: bool = True) -> Dict[str, Any]:
        """
        Create comprehensive JSON export of all C3D data and analysis results.
        
        Args:
            session_params: Session parameters used for processing
            processing_opts: Processing options used
            include_raw_signals: Whether to include full signal data arrays
            include_debug_info: Whether to include debug and processing metadata
            
        Returns:
            Comprehensive data structure suitable for JSON export
        """
        export_data = {
            "export_metadata": self._create_export_metadata(),
            "file_info": self._create_file_info(),
            "game_metadata": self.processor.game_metadata,
            "processing_parameters": self._create_processing_parameters(session_params, processing_opts),
            "channels": self._create_channels_export(include_raw_signals),
            "analytics": self._create_analytics_export(),
            "summary_statistics": self._create_summary_statistics()
        }
        
        if include_debug_info:
            export_data["debug_info"] = self._create_debug_info()
            
        return export_data
    
    def _create_export_metadata(self) -> Dict[str, Any]:
        """Create export-specific metadata."""
        return {
            "export_timestamp": datetime.now().isoformat(),
            "export_version": "1.0.0",
            "exporter": "EMG C3D Analyzer v0.1.0",
            "format_description": "Comprehensive EMG C3D analysis export including raw data, processed signals, and clinical metrics"
        }
    
    def _create_file_info(self) -> Dict[str, Any]:
        """Create file-specific information."""
        import os
        file_stats = os.stat(self.processor.file_path) if os.path.exists(self.processor.file_path) else None
        
        return {
            "source_file": os.path.basename(self.processor.file_path),
            "full_path": self.processor.file_path,
            "file_size_bytes": file_stats.st_size if file_stats else None,
            "file_modified": datetime.fromtimestamp(file_stats.st_mtime).isoformat() if file_stats else None,
            "c3d_parameters": self._extract_c3d_parameters()
        }
    
    def _convert_numpy_to_python(self, obj):
        """Convert numpy arrays and other non-serializable types to Python types."""
        import numpy as np
        
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (np.integer, np.floating)):
            return obj.item()
        elif isinstance(obj, dict):
            return {key: self._convert_numpy_to_python(value) for key, value in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [self._convert_numpy_to_python(item) for item in obj]
        else:
            return obj
    
    def _extract_c3d_parameters(self) -> Dict[str, Any]:
        """Extract C3D file parameters for debugging."""
        if not self.processor.c3d:
            return {}
            
        try:
            params = {}
            
            # Extract key parameter groups
            if 'parameters' in self.processor.c3d:
                c3d_params = self.processor.c3d['parameters']
                
                # Analog parameters
                if 'ANALOG' in c3d_params:
                    analog_params = c3d_params['ANALOG']
                    params['analog'] = {
                        'labels': self._convert_numpy_to_python(analog_params.get('LABELS', {}).get('value', [])),
                        'rate': self._convert_numpy_to_python(analog_params.get('RATE', {}).get('value', [])),
                        'gen_scale': self._convert_numpy_to_python(analog_params.get('GEN_SCALE', {}).get('value', [])),
                        'scale': self._convert_numpy_to_python(analog_params.get('SCALE', {}).get('value', [])),
                        'offset': self._convert_numpy_to_python(analog_params.get('OFFSET', {}).get('value', [])),
                        'units': self._convert_numpy_to_python(analog_params.get('UNITS', {}).get('value', []))
                    }
                
                # Info parameters
                if 'INFO' in c3d_params:
                    params['info'] = {k: self._convert_numpy_to_python(v.get('value', [])) for k, v in c3d_params['INFO'].items()}
                
                # Subject parameters
                if 'SUBJECTS' in c3d_params:
                    params['subjects'] = {k: self._convert_numpy_to_python(v.get('value', [])) for k, v in c3d_params['SUBJECTS'].items()}
                    
            return params
            
        except Exception as e:
            return {"error": f"Failed to extract C3D parameters: {str(e)}"}
    
    def _create_processing_parameters(self, 
                                    session_params: GameSessionParameters, 
                                    processing_opts: Any) -> Dict[str, Any]:
        """Create comprehensive processing parameters record."""
        return {
            "session_parameters": session_params.model_dump() if session_params else None,
            "processing_options": {
                "threshold_factor": getattr(processing_opts, 'threshold_factor', None),
                "min_duration_ms": getattr(processing_opts, 'min_duration_ms', None),
                "smoothing_window": getattr(processing_opts, 'smoothing_window', None)
            },
            "analysis_functions_used": list(self.processor.analysis_functions.keys()) if self.processor.analysis_functions else []
        }
    
    def _create_channels_export(self, include_raw_signals: bool = True) -> Dict[str, Any]:
        """Create comprehensive channels data export."""
        if not self.processor.emg_data:
            return {}
            
        channels_export = {}
        
        for channel_name, channel_data in self.processor.emg_data.items():
            channel_export = {
                "metadata": {
                    "sampling_rate": channel_data.get('sampling_rate'),
                    "data_points": len(channel_data.get('data', [])),
                    "duration_seconds": len(channel_data.get('data', [])) / channel_data.get('sampling_rate', 1),
                    "signal_type": self._classify_signal_type(channel_name)
                }
            }
            
            if include_raw_signals:
                channel_export["signals"] = {
                    "raw_data": channel_data.get('data', []),
                    "time_axis": channel_data.get('time_axis', []),
                    "rms_envelope": channel_data.get('rms_envelope', []),
                    "activated_data": channel_data.get('activated_data')
                }
            else:
                # Include summary statistics only
                data = channel_data.get('data', [])
                if data:
                    channel_export["signal_summary"] = {
                        "min_value": min(data),
                        "max_value": max(data),
                        "mean_value": sum(data) / len(data),
                        "data_points": len(data)
                    }
            
            channels_export[channel_name] = channel_export
            
        return channels_export
    
    def _classify_signal_type(self, channel_name: str) -> str:
        """Classify signal type based on channel name."""
        name_lower = channel_name.lower()
        if 'raw' in name_lower:
            return 'raw_emg'
        elif 'activated' in name_lower:
            return 'processed_emg'
        elif 'ch' in name_lower:
            return 'emg_channel'
        else:
            return 'unknown'
    
    def _create_analytics_export(self) -> Dict[str, Any]:
        """Create comprehensive analytics export."""
        if not self.processor.analytics:
            return {}
            
        analytics_export = {}
        
        for channel_name, analytics in self.processor.analytics.items():
            channel_analytics = {
                "basic_metrics": self._extract_basic_metrics(analytics),
                "contraction_analysis": self._extract_contraction_analysis(analytics),
                "frequency_analysis": self._extract_frequency_analysis(analytics),
                "fatigue_analysis": self._extract_fatigue_analysis(analytics),
                "clinical_metrics": self._extract_clinical_metrics(analytics),
                "quality_metrics": self._extract_quality_metrics(analytics)
            }
            
            # Include any errors encountered
            if 'errors' in analytics:
                channel_analytics["processing_errors"] = analytics['errors']
                
            analytics_export[channel_name] = channel_analytics
            
        return analytics_export
    
    def _extract_basic_metrics(self, analytics: Dict) -> Dict[str, Any]:
        """Extract basic EMG metrics."""
        return {
            "max_amplitude": analytics.get('max_amplitude'),
            "avg_amplitude": analytics.get('avg_amplitude'),
            "rms_value": analytics.get('rms'),
            "mean_absolute_value": analytics.get('mav'),
            "variance": analytics.get('variance'),
            "standard_deviation": analytics.get('std_dev')
        }
    
    def _extract_contraction_analysis(self, analytics: Dict) -> Dict[str, Any]:
        """Extract contraction analysis results."""
        return {
            "contraction_count": analytics.get('contraction_count'),
            "expected_contractions": analytics.get('expected_contractions'),
            "good_contraction_count": analytics.get('good_contraction_count'),
            "mvc_threshold_actual_value": analytics.get('mvc_threshold_actual_value'),
            "duration_statistics": {
                "avg_duration_ms": analytics.get('avg_duration_ms'),
                "min_duration_ms": analytics.get('min_duration_ms'),
                "max_duration_ms": analytics.get('max_duration_ms'),
                "total_time_under_tension_ms": analytics.get('total_time_under_tension_ms')
            },
            "contractions_detailed": analytics.get('contractions', [])
        }
    
    def _extract_frequency_analysis(self, analytics: Dict) -> Dict[str, Any]:
        """Extract frequency domain analysis."""
        return {
            "mean_power_frequency": analytics.get('mpf'),
            "median_frequency": analytics.get('mdf'),
            "spectral_centroid": analytics.get('spectral_centroid'),
            "bandwidth_95": analytics.get('bandwidth_95'),
            "power_spectrum": analytics.get('power_spectrum')
        }
    
    def _extract_fatigue_analysis(self, analytics: Dict) -> Dict[str, Any]:
        """Extract fatigue analysis metrics."""
        return {
            "dimitrov_fatigue_index": analytics.get('dimitrov_fi'),
            "mpf_slope": analytics.get('mpf_slope'),
            "mdf_slope": analytics.get('mdf_slope'),
            "amplitude_fatigue_slope": analytics.get('amplitude_fatigue_slope')
        }
    
    def _extract_clinical_metrics(self, analytics: Dict) -> Dict[str, Any]:
        """Extract clinical relevance metrics."""
        return {
            "zero_crossings": analytics.get('zero_crossings'),
            "turns_analysis": analytics.get('turns'),
            "waveform_length": analytics.get('wl'),
            "willison_amplitude": analytics.get('willison_amplitude')
        }
    
    def _extract_quality_metrics(self, analytics: Dict) -> Dict[str, Any]:
        """Extract signal quality metrics."""
        return {
            "signal_to_noise_ratio": analytics.get('snr'),
            "signal_quality_index": analytics.get('signal_quality_index'),
            "artifacts_detected": analytics.get('artifacts_detected'),
            "baseline_stability": analytics.get('baseline_stability')
        }
    
    def _create_summary_statistics(self) -> Dict[str, Any]:
        """Create overall summary statistics."""
        if not self.processor.analytics:
            return {}
            
        summary = {
            "total_channels": len(self.processor.analytics),
            "channels_processed": [],
            "overall_metrics": {},
            "quality_summary": {}
        }
        
        # Collect channel names and types
        for channel_name in self.processor.analytics.keys():
            summary["channels_processed"].append({
                "name": channel_name,
                "type": self._classify_signal_type(channel_name)
            })
        
        # Calculate cross-channel statistics
        all_max_amplitudes = []
        all_contraction_counts = []
        
        for analytics in self.processor.analytics.values():
            if analytics.get('max_amplitude') is not None:
                all_max_amplitudes.append(analytics['max_amplitude'])
            if analytics.get('contraction_count') is not None:
                all_contraction_counts.append(analytics['contraction_count'])
        
        if all_max_amplitudes:
            summary["overall_metrics"]["amplitude_range"] = {
                "min": min(all_max_amplitudes),
                "max": max(all_max_amplitudes),
                "mean": sum(all_max_amplitudes) / len(all_max_amplitudes)
            }
        
        if all_contraction_counts:
            summary["overall_metrics"]["contraction_summary"] = {
                "total_contractions": sum(all_contraction_counts),
                "avg_per_channel": sum(all_contraction_counts) / len(all_contraction_counts)
            }
        
        return summary
    
    def _create_debug_info(self) -> Dict[str, Any]:
        """Create debug information."""
        return {
            "processor_state": {
                "file_loaded": self.processor.c3d is not None,
                "metadata_extracted": bool(self.processor.game_metadata),
                "emg_data_extracted": bool(self.processor.emg_data),
                "analytics_calculated": bool(self.processor.analytics)
            },
            "data_dimensions": self._get_data_dimensions(),
            "processing_warnings": self._collect_processing_warnings(),
            "system_info": {
                "export_timestamp": datetime.now().isoformat(),
                "python_version": self._get_python_version()
            }
        }
    
    def _get_data_dimensions(self) -> Dict[str, Any]:
        """Get data dimensions for debugging."""
        dimensions = {}
        
        if self.processor.emg_data:
            for channel_name, data in self.processor.emg_data.items():
                dimensions[channel_name] = {
                    "signal_length": len(data.get('data', [])),
                    "time_axis_length": len(data.get('time_axis', [])),
                    "rms_envelope_length": len(data.get('rms_envelope', []))
                }
        
        return dimensions
    
    def _collect_processing_warnings(self) -> list:
        """Collect any processing warnings or errors."""
        warnings = []
        
        if self.processor.analytics:
            for channel_name, analytics in self.processor.analytics.items():
                if 'errors' in analytics:
                    for error_type, error_msg in analytics['errors'].items():
                        warnings.append({
                            "channel": channel_name,
                            "type": error_type,
                            "message": error_msg
                        })
        
        return warnings
    
    def _get_python_version(self) -> str:
        """Get Python version for debugging."""
        import sys
        return f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    
    def export_to_json(self, 
                      output_path: str,
                      session_params: GameSessionParameters,
                      processing_opts: Any,
                      include_raw_signals: bool = True,
                      include_debug_info: bool = True,
                      indent: int = 2) -> bool:
        """
        Export data to JSON file.
        
        Args:
            output_path: Path for output JSON file
            session_params: Session parameters used
            processing_opts: Processing options used
            include_raw_signals: Include full signal arrays
            include_debug_info: Include debug information
            indent: JSON indentation level
            
        Returns:
            True if successful, False otherwise
        """
        try:
            export_data = self.create_comprehensive_export(
                session_params=session_params,
                processing_opts=processing_opts,
                include_raw_signals=include_raw_signals,
                include_debug_info=include_debug_info
            )
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=indent, ensure_ascii=False)
            
            return True
            
        except Exception as e:
            print(f"Export failed: {str(e)}")
            return False


def create_quick_export(processor_instance, 
                       session_params: GameSessionParameters,
                       processing_opts: Any) -> Dict[str, Any]:
    """
    Quick export function for basic use cases.
    
    Args:
        processor_instance: GHOSTLYC3DProcessor instance
        session_params: Session parameters
        processing_opts: Processing options
        
    Returns:
        Comprehensive export dictionary
    """
    exporter = EMGDataExporter(processor_instance)
    return exporter.create_comprehensive_export(
        session_params=session_params,
        processing_opts=processing_opts,
        include_raw_signals=True,
        include_debug_info=True
    )