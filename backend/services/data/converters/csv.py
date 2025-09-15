"""CSV conversion utility for EMG export data.

Following MVP plan: Simple JSON-to-CSV flattening for research-ready format.
Architecture follows backend CLAUDE.md: KISS principle, no over-engineering.
"""

import pandas as pd
from typing import Any, Dict
import logging

logger = logging.getLogger(__name__)


def convert_export_to_csv(export_data: Dict[str, Any]) -> str:
    """Flatten nested JSON to single CSV row - research-ready format.
    
    ENHANCED for single source of truth architecture (v2):
    - Supports new session_configuration fields (MVC, RPE, durations)
    - Handles enhanced performance_analysis (weights, data completeness)
    - Maintains backward compatibility with legacy export format
    
    Following MVP approach: Simple flattening for immediate researcher use.
    One row per session with all metrics as columns.
    
    Args:
        export_data: Export data dictionary from enhanced export service
        
    Returns:
        CSV string ready for pandas import
    """
    try:
        # Handle None or invalid input gracefully
        if not export_data or not isinstance(export_data, dict):
            return "export_timestamp,error\n,Invalid or missing export data\n"
            
        flattened = {}
        
        # Session metadata as columns
        session_metadata = export_data.get('session_metadata', {})
        if session_metadata:
            flattened['export_timestamp'] = session_metadata.get('export_timestamp')
            
            # Flatten nested analysis result if present
            analysis_result = session_metadata.get('analysis_result')
            if hasattr(analysis_result, '__dict__'):
                flattened['session_source_filename'] = getattr(analysis_result, 'source_filename', '')
                
        # Performance scores as columns (the key requirement)
        performance = export_data.get('performance_scores', {})
        if performance and isinstance(performance, dict):
            for key, value in performance.items():
                if key != 'note' and key != 'error':  # Skip informational fields
                    flattened[f'performance_{key}'] = value
                    
        # Scoring configuration as columns (for reproducibility)
        config = export_data.get('scoring_configuration', {})
        if config and isinstance(config, dict):
            for key, value in config.items():
                if key not in ['note', 'error', 'rpe_mapping']:  # Skip complex nested data for now
                    flattened[f'config_{key}'] = value
                elif key == 'rpe_mapping' and isinstance(value, dict):
                    # Include key RPE scores for research
                    flattened['config_rpe_optimal_score'] = value.get('5', {}).get('score', 100)
                    flattened['config_rpe_maximum_score'] = value.get('10', {}).get('score', 10)
        
        # EMG analytics summary (if available)
        session_meta = export_data.get('session_metadata', {})
        analytics = session_meta.get('analytics', {})
        if analytics and isinstance(analytics, dict):
            # Add channel count and MVC values
            flattened['emg_channels_count'] = len(analytics)
            for channel_name, channel_data in analytics.items():
                if isinstance(channel_data, dict):
                    mvc_value = channel_data.get('mvc_value')
                    if mvc_value is not None:
                        flattened[f'emg_{channel_name.lower()}_mvc'] = mvc_value
        
        # Enhanced session configuration (NEW - from v2 architecture)
        session_config = export_data.get('session_configuration', {})
        if session_config and isinstance(session_config, dict):
            for key, value in session_config.items():
                if key != 'note' and key != 'error' and value is not None:
                    flattened[f'session_{key}'] = value
                    
        # Enhanced performance analysis (NEW - from v2 architecture)
        performance_analysis = export_data.get('performance_analysis', {})
        if performance_analysis and isinstance(performance_analysis, dict):
            # Core performance scores
            for key, value in performance_analysis.items():
                if key not in ['note', 'error', 'weights', 'data_completeness'] and value is not None:
                    flattened[f'enhanced_{key}'] = value
            
            # Include scoring weights for transparency
            weights = performance_analysis.get('weights', {})
            if weights and isinstance(weights, dict):
                for weight_key, weight_value in weights.items():
                    if weight_value is not None:
                        flattened[f'weight_{weight_key}'] = weight_value
                        
            # Include data completeness indicators
            data_completeness = performance_analysis.get('data_completeness', {})
            if data_completeness and isinstance(data_completeness, dict):
                for completeness_key, completeness_value in data_completeness.items():
                    if completeness_value is not None:
                        flattened[f'data_{completeness_key}'] = completeness_value
        
        # Convert to CSV (one row = one session)
        if flattened:
            df = pd.DataFrame([flattened])
            return df.to_csv(index=False)
        else:
            # Empty case - return headers only
            return "export_timestamp,note\n,No data available for CSV export\n"
            
    except Exception as e:
        logger.error(f"Failed to convert export data to CSV: {e}")
        # Return error CSV for debugging
        timestamp = ''
        try:
            if export_data and isinstance(export_data, dict):
                timestamp = export_data.get('session_metadata', {}).get('export_timestamp', '')
        except Exception as timestamp_error:
            logger.debug(f"Could not extract timestamp from export data: {timestamp_error}")
            
        error_df = pd.DataFrame([{
            'export_timestamp': timestamp,
            'error': f"CSV conversion failed: {str(e)}"
        }])
        return error_df.to_csv(index=False)


def validate_csv_for_research(csv_content: str) -> Dict[str, Any]:
    """Validate that CSV is ready for research analysis.
    
    Args:
        csv_content: CSV string content
        
    Returns:
        Validation result with pandas import test
    """
    try:
        # Test pandas import
        from io import StringIO
        df = pd.read_csv(StringIO(csv_content))
        
        # Check for required performance metrics
        performance_columns = [col for col in df.columns if col.startswith('performance_')]
        config_columns = [col for col in df.columns if col.startswith('config_')]
        
        return {
            'valid': True,
            'row_count': len(df),
            'column_count': len(df.columns),
            'performance_metrics_count': len(performance_columns),
            'config_fields_count': len(config_columns),
            'pandas_import_success': True,
            'sample_columns': list(df.columns[:10])  # First 10 columns for review
        }
        
    except Exception as e:
        return {
            'valid': False,
            'error': str(e),
            'pandas_import_success': False
        }


# Research-friendly column name mapping
RESEARCH_COLUMN_MAPPING = {
    # Legacy performance scores (v1 architecture)
    'performance_overall_score': 'P_overall',
    'performance_compliance_score': 'S_compliance', 
    'performance_symmetry_score': 'S_symmetry',
    'performance_effort_score': 'S_effort',
    'performance_game_score': 'S_game',
    'performance_left_muscle_compliance': 'L_compliance',
    'performance_right_muscle_compliance': 'R_compliance',
    
    # Enhanced performance scores (v2 architecture - from enhanced upload route)
    'enhanced_overall_score': 'E_overall',
    'enhanced_compliance_score': 'E_compliance',
    'enhanced_symmetry_score': 'E_symmetry', 
    'enhanced_effort_score': 'E_effort',
    'enhanced_game_score': 'E_game',
    'enhanced_left_muscle_compliance': 'E_left_compliance',
    'enhanced_right_muscle_compliance': 'E_right_compliance',
    
    # Session configuration fields
    'session_rpe_pre_session': 'RPE_pre',
    'session_rpe_post_session': 'RPE_post',
    'session_session_mvc_value': 'MVC_value',
    'session_session_mvc_threshold_percentage': 'MVC_threshold_pct',
    'session_contraction_duration_threshold': 'Duration_threshold_ms',
    'session_session_expected_contractions': 'Expected_contractions',
    
    # Scoring weights
    'weight_w_compliance': 'W_compliance',
    'weight_w_symmetry': 'W_symmetry',
    'weight_w_effort': 'W_effort',
    'weight_w_completion': 'W_completion',
    'weight_w_intensity': 'W_intensity',
    'weight_w_duration': 'W_duration',
    
    # Data completeness indicators
    'data_has_emg_data': 'Has_EMG',
    'data_has_rpe': 'Has_RPE',
    'data_has_game_data': 'Has_Game',
    'data_has_bfr_data': 'Has_BFR'
}


def apply_research_friendly_names(csv_content: str) -> str:
    """Apply research-friendly column names for easier analysis.
    
    Args:
        csv_content: Original CSV content
        
    Returns:
        CSV with research-friendly column names
    """
    try:
        from io import StringIO
        df = pd.read_csv(StringIO(csv_content))
        
        # Rename columns for research convenience
        df = df.rename(columns=RESEARCH_COLUMN_MAPPING)
        
        return df.to_csv(index=False)
        
    except Exception as e:
        logger.error(f"Failed to apply research-friendly names: {e}")
        return csv_content  # Return original on error