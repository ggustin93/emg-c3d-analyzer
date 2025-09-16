"""Enhanced export service for EMG data with single source of truth architecture.

ARCHITECTURE EVOLUTION: Leverages enhanced upload route as single source of truth.
- v1: Database-dependent export (legacy)  
- v2: Upload route single source of truth (NEW) - Uses enhanced EMGAnalysisResult
- v2.1: Patient code integration (T013) - Enhanced with patient identification
Following backend CLAUDE.md: KISS principle, DRY, stateless where possible.
"""

import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


class EnhancedEMGDataExporter:
    """Enhanced EMG data export service with single source of truth architecture.
    
    ARCHITECTURE EVOLUTION:
    - v1 (Legacy): Database-dependent, requires populated therapy_sessions table
    - v2 (NEW): Single source of truth from enhanced upload route - stateless
    
    🔄 MIGRATION GUIDE:
    - DEPRECATED: export_data(), get_comprehensive_export_data(), _get_base_export_data()
    - DEPRECATED: _get_performance_scores(), _get_scoring_configuration() 
    - ✅ USE: get_export_data_from_analysis_result(analysis_result) for v2 architecture
    - ✅ BENEFIT: No database queries, richer data, better performance
    
    Following backend CLAUDE.md: KISS principle, DRY, Repository pattern where needed.
    """

    def __init__(self, processor: Any = None, supabase_client=None):
        self.processor = processor
        self.supabase = supabase_client  # Synchronous client (CLAUDE.md #14)
        
        # T013: Initialize patient code service for export enhancement
        if supabase_client:
            from services.patient.patient_code_service import PatientCodeService
            self.patient_code_service = PatientCodeService(supabase_client)
        else:
            self.patient_code_service = None

    def export_data(
        self, channels_to_export: list[str], file_name: str, export_options: dict[str, Any]
    ) -> dict[str, Any]:
        """Export EMG data in requested format with enhanced performance data.
        
        ⚠️ DEPRECATED (v1 Legacy): This method uses processor-based logic and will be removed.
        🔄 MIGRATE TO: get_export_data_from_analysis_result() for v2 single source of truth architecture.
        """
        try:
            # Get the processed data from processor  
            if not hasattr(self.processor, "latest_analysis_result"):
                raise ValueError("No analysis data available for export")

            analysis_result = self.processor.latest_analysis_result

            # Build export data (keep existing structure - DRY principle)
            export_data = {
                "metadata": {
                    "export_timestamp": datetime.now().isoformat(),
                    "file_name": file_name,
                    "channels_exported": channels_to_export,
                    "export_options": export_options,
                },
                "data": {},
            }

            # Add requested channels (existing functionality)
            for channel in channels_to_export:
                if (
                    hasattr(analysis_result, "emg_signals")
                    and channel in analysis_result.emg_signals
                ):
                    export_data["data"][channel] = {
                        "signal_data": analysis_result.emg_signals[channel].data,
                        "time_axis": analysis_result.emg_signals[channel].time_axis,
                        "analytics": getattr(analysis_result, "analytics", {}).get(channel, {}),
                    }

            return {
                "success": True,
                "export_data": export_data,
                "message": f"Successfully exported {len(channels_to_export)} channels",
            }

        except Exception as e:
            return {"success": False, "error": str(e), "message": "Export failed"}

    def get_export_data_from_analysis_result(self, analysis_result: Any) -> dict[str, Any]:
        """Get comprehensive export data from enhanced EMGAnalysisResult (v2 - Single Source of Truth).
        
        NEW ARCHITECTURE: Uses enhanced upload route data as single source of truth.
        No database dependencies - all data comes from the enhanced upload response.
        
        Args:
            analysis_result: Enhanced EMGAnalysisResult from upload route
            
        Returns:
            Complete export data ready for CSV conversion
        """
        try:
            # Convert EMGAnalysisResult to export format
            export_data = {
                "session_metadata": {
                    "export_timestamp": datetime.now().isoformat(),
                    "export_method": "single_source_of_truth_v2",
                    "source": "enhanced_upload_route",
                    
                    # Basic file info
                    "file_id": getattr(analysis_result, 'file_id', ''),
                    "source_filename": getattr(analysis_result, 'source_filename', ''),
                    "timestamp": getattr(analysis_result, 'timestamp', ''),
                    "user_id": getattr(analysis_result, 'user_id', ''),
                    "patient_id": getattr(analysis_result, 'patient_id', ''), 
                    "session_id": getattr(analysis_result, 'session_id', ''),
                    
                    # EMG data
                    "available_channels": getattr(analysis_result, 'available_channels', []),
                    "analytics": getattr(analysis_result, 'analytics', {}),
                    "emg_signals": getattr(analysis_result, 'emg_signals', {}),
                    "c3d_parameters": getattr(analysis_result, 'c3d_parameters', {}),
                }
            }
            
            # Add session configuration (NEW - from enhancement)
            session_configuration = getattr(analysis_result, 'session_configuration', {})
            if session_configuration:
                export_data["session_configuration"] = session_configuration
                
            # Add scoring configuration (NEW - from enhancement)  
            scoring_configuration = getattr(analysis_result, 'scoring_configuration', {})
            if scoring_configuration:
                export_data["scoring_configuration"] = scoring_configuration
                
            # Add enhanced performance analysis (NEW - from enhancement)
            performance_analysis = getattr(analysis_result, 'performance_analysis', {})
            if performance_analysis:
                export_data["performance_analysis"] = performance_analysis
                
            # Add original session parameters for context
            if hasattr(analysis_result, 'metadata') and analysis_result.metadata:
                metadata = analysis_result.metadata
                if hasattr(metadata, 'session_parameters_used'):
                    export_data["session_parameters"] = metadata.session_parameters_used
            
            # T013: Enhance export data with patient code information
            if self.patient_code_service:
                try:
                    # Convert analysis_result to dictionary for patient code service
                    analysis_dict = {
                        'patient_id': getattr(analysis_result, 'patient_id', None),
                        'source_filename': getattr(analysis_result, 'source_filename', None),
                        'file_id': getattr(analysis_result, 'file_id', None),
                        'session_id': getattr(analysis_result, 'session_id', None),
                        'metadata': getattr(analysis_result, 'metadata', {})
                    }
                    
                    export_data = self.patient_code_service.enhance_export_data_with_patient_code(
                        export_data, analysis_dict
                    )
                    
                except Exception as e:
                    logger.warning(f"Failed to enhance export with patient code: {e}")
            
            logger.info(f"✅ Single source of truth export data created with {len(export_data)} top-level sections")
            return export_data
            
        except Exception as e:
            logger.error(f"Failed to create export data from analysis result: {e}")
            return {
                "session_metadata": {
                    "export_timestamp": datetime.now().isoformat(),
                    "export_method": "single_source_of_truth_v2",
                    "error": f"Export failed: {str(e)}"
                }
            }

    def get_comprehensive_export_data(self, session_id: str) -> dict[str, Any]:
        """Get comprehensive export data including performance scores and configuration.
        
        ⚠️ DEPRECATED (v1 Legacy): Database-dependent method, performance-limited.
        🔄 MIGRATE TO: get_export_data_from_analysis_result() for v2 single source of truth.
        
        MVP implementation: Add missing performance data to existing export.
        Following KISS principle - simple extension of existing functionality.
        
        Args:
            session_id: Session UUID to export data for
            
        Returns:
            Complete export data with performance scores and scoring configuration
        """
        try:
            # Get existing export data (DRY - reuse existing logic)
            base_export = self._get_base_export_data()
            
            # Add missing performance data (MVP requirement)
            if self.supabase:
                performance_scores = self._get_performance_scores(session_id)
                scoring_config = self._get_scoring_configuration(session_id)
                
                # Extend existing structure
                base_export.update({
                    'performance_scores': performance_scores,
                    'scoring_configuration': scoring_config
                })
                
            return base_export
            
        except Exception as e:
            # Fallback to base export if performance data unavailable
            logger.warning(f"Failed to get performance data: {e}, returning base export")
            return self._get_base_export_data()

    def _get_base_export_data(self) -> dict[str, Any]:
        """Get base export data from existing processor.
        
        ⚠️ DEPRECATED (v1 Legacy): Processor-dependent helper method.
        """
        if not hasattr(self.processor, "latest_analysis_result"):
            return {"session_metadata": {"export_timestamp": datetime.now().isoformat()}}
            
        analysis_result = self.processor.latest_analysis_result
        
        # Convert analysis_result to JSON-serializable format
        analysis_data = {}
        if hasattr(analysis_result, '__dict__'):
            for key, value in analysis_result.__dict__.items():
                # Only include JSON-serializable attributes
                try:
                    import json
                    json.dumps(value)  # Test if serializable
                    analysis_data[key] = value
                except (TypeError, ValueError):
                    # Skip non-serializable attributes
                    continue
        
        return {
            "session_metadata": {
                "export_timestamp": datetime.now().isoformat(),
                "analysis_data": analysis_data,
                "emg_signals": getattr(analysis_result, "emg_signals", {}),
                "analytics": getattr(analysis_result, "analytics", {})
            }
        }

    def _get_performance_scores(self, session_id: str) -> dict[str, Any]:
        """Get performance scores from database (Repository pattern).
        
        ⚠️ DEPRECATED (v1 Legacy): Database query method, replaced by enhanced upload route data.
        """
        try:
            # Query performance_scores table (17+ fields as per database schema)
            result = (
                self.supabase
                .table('performance_scores')
                .select('*')
                .eq('session_id', session_id)
                .limit(1)
                .execute()
            )
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            else:
                return {"note": "No performance scores found for this session"}
                
        except Exception as e:
            logger.error(f"Failed to fetch performance scores: {e}")
            return {"error": "Failed to fetch performance scores"}

    def _get_scoring_configuration(self, session_id: str) -> dict[str, Any]:
        """Get scoring configuration for reproducibility.
        
        ⚠️ DEPRECATED (v1 Legacy): Database query method, replaced by enhanced upload route data.
        """
        try:
            # Get session's scoring configuration
            session_result = (
                self.supabase
                .table('therapy_sessions')
                .select('scoring_config_id')
                .eq('id', session_id)
                .limit(1)
                .execute()
            )
            
            if not session_result.data or not session_result.data[0].get('scoring_config_id'):
                return {"note": "No scoring configuration found for this session"}
                
            config_id = session_result.data[0]['scoring_config_id']
            
            # Get scoring configuration details
            config_result = (
                self.supabase
                .table('scoring_configuration')
                .select('*')
                .eq('id', config_id)
                .limit(1)
                .execute()
            )
            
            if config_result.data and len(config_result.data) > 0:
                return config_result.data[0]
            else:
                return {"note": "Scoring configuration not found"}
                
        except Exception as e:
            logger.error(f"Failed to fetch scoring configuration: {e}")
            return {"error": "Failed to fetch scoring configuration"}


# Keep backward compatibility alias
EMGDataExporter = EnhancedEMGDataExporter