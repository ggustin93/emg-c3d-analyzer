"""Upload Routes - STATELESS EMG Processing.
================================================

PURPOSE: Direct C3D file upload for immediate EMG analysis WITHOUT database storage.

KEY BEHAVIORS:
- ✅ RETURNS: Full EMG signals and analysis results
- ❌ DOES NOT: Store data in Supabase database
- ❌ DOES NOT: Create therapy_sessions records

USE CASE: Testing, preview, or temporary analysis where persistence is not needed.

DIFFERENCE FROM WEBHOOK:
- Upload Route: Stateless processing → Returns signals → No DB storage
- Webhook Route: Stateful processing → No signal return → Full DB storage

SINGLE RESPONSIBILITY: Stateless file processing with EMG signal extraction.
"""

import logging
import os
import shutil
import tempfile
import uuid
from datetime import datetime

from config import MAX_FILE_SIZE
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from api.dependencies.validation import (
    get_file_metadata,
    get_processing_options,
    get_session_parameters,
)
from models import (
    ChannelAnalytics,
    EMGAnalysisResult,
    GameMetadata,
    GameSessionParameters,
    ProcessingOptions,
)
# Direct C3D processing for stateless upload endpoint
from services.c3d.processor import GHOSTLYC3DProcessor
from config import PROCESSING_VERSION

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])


# Export Enhancement Helper Functions
def get_rpe_description(rpe: int | None) -> str:
    """Get Borg CR-10 scale description."""
    if rpe is None:
        return "Not recorded"
    descriptions = {
        1: 'Very Easy',
        2: 'Easy', 
        3: 'Moderate',
        4: 'Somewhat Hard',
        5: 'Hard',
        6: 'Very Hard',
        7: 'Very Hard+',
        8: 'Extremely Hard',
        9: 'Extremely Hard+',
        10: 'Maximum Effort'
    }
    return descriptions.get(rpe, 'Unknown')


def format_session_configuration(session_params: GameSessionParameters) -> dict:
    """Format session parameters with units and descriptions."""
    config = {}
    
    # RPE with descriptions (may come from metadata/game parameters)
    if hasattr(session_params, 'rpe_pre_session') and session_params.rpe_pre_session:
        config['rpe_pre_session'] = session_params.rpe_pre_session
        config['rpe_pre_description'] = get_rpe_description(session_params.rpe_pre_session)
    
    if hasattr(session_params, 'rpe_post_session') and session_params.rpe_post_session:
        config['rpe_post_session'] = session_params.rpe_post_session
        config['rpe_post_description'] = get_rpe_description(session_params.rpe_post_session)
    
    # MVC thresholds with percentages (use existing session parameters)
    if hasattr(session_params, 'session_mvc_value') and session_params.session_mvc_value:
        config['session_mvc_value'] = session_params.session_mvc_value
    
    if hasattr(session_params, 'session_mvc_threshold_percentage') and session_params.session_mvc_threshold_percentage:
        config['session_mvc_threshold_percentage'] = session_params.session_mvc_threshold_percentage
        config['session_mvc_threshold_decimal'] = session_params.session_mvc_threshold_percentage / 100
    
    # Duration thresholds and expected contractions
    if hasattr(session_params, 'contraction_duration_threshold') and session_params.contraction_duration_threshold:
        config['contraction_duration_threshold'] = session_params.contraction_duration_threshold
        config['contraction_duration_threshold_seconds'] = session_params.contraction_duration_threshold / 1000
    
    if hasattr(session_params, 'session_expected_contractions') and session_params.session_expected_contractions:
        config['session_expected_contractions'] = session_params.session_expected_contractions
    
    if hasattr(session_params, 'session_expected_contractions_ch1') and session_params.session_expected_contractions_ch1:
        config['session_expected_contractions_ch1'] = session_params.session_expected_contractions_ch1
    
    if hasattr(session_params, 'session_expected_contractions_ch2') and session_params.session_expected_contractions_ch2:
        config['session_expected_contractions_ch2'] = session_params.session_expected_contractions_ch2
    
    # Session duration thresholds per muscle (if available)
    if hasattr(session_params, 'session_duration_thresholds_per_muscle') and session_params.session_duration_thresholds_per_muscle:
        config['session_duration_thresholds_per_muscle'] = session_params.session_duration_thresholds_per_muscle
    
    return config


def get_scoring_configuration() -> dict:
    """Get default GHOSTLY+ scoring configuration."""
    # Import here to avoid circular imports
    from services.clinical.performance_scoring_service import ScoringWeights
    
    # Use the default weights from the ScoringWeights dataclass
    default_weights = ScoringWeights()
    
    return {
        # Main weights
        'weight_compliance': default_weights.w_compliance,  # 0.50
        'weight_symmetry': default_weights.w_symmetry,      # 0.25
        'weight_effort': default_weights.w_effort,          # 0.25
        'weight_game': default_weights.w_game,              # 0.00
        # Sub-weights for compliance
        'weight_completion': default_weights.w_completion,  # 0.333
        'weight_intensity': default_weights.w_intensity,    # 0.333
        'weight_duration': default_weights.w_duration,      # 0.334
    }


def enhance_performance_analysis(clinical_scores: dict, session_params: GameSessionParameters) -> dict:
    """Enhance clinical scores with additional fields for CSV export."""
    enhanced = {**clinical_scores}  # Keep all existing scores
    
    # Add RPE data if available (may come from metadata or session params)
    if hasattr(session_params, 'rpe_post_session') and session_params.rpe_post_session:
        enhanced['rpe_value'] = session_params.rpe_post_session
        enhanced['rpe_description'] = get_rpe_description(session_params.rpe_post_session)
    
    # Add scoring weights for transparency
    enhanced['weights'] = get_scoring_configuration()
    
    # Add data completeness indicators
    enhanced['data_completeness'] = {
        'has_emg_data': bool(clinical_scores.get('compliance_score')),
        'has_rpe': bool(getattr(session_params, 'rpe_post_session', None)),
        'has_game_data': bool(clinical_scores.get('game_score')),
        'has_bfr_data': False,  # Not yet implemented
        'rpe_source': 'session_parameters' if hasattr(session_params, 'rpe_post_session') else None
    }
    
    return enhanced




@router.post("", response_model=EMGAnalysisResult)  # No slash = exact match on /upload
async def upload_file(
    file: UploadFile = File(...),
    processing_opts: ProcessingOptions = Depends(get_processing_options),
    session_params: GameSessionParameters = Depends(get_session_parameters),
    file_metadata: dict = Depends(get_file_metadata),
):
    """Upload and process a C3D file.

    Args:
        file: C3D file upload
        processing_opts: EMG processing configuration
        session_params: Game session parameters
        file_metadata: File metadata (user_id, patient_id, session_id)

    Returns:
        EMGAnalysisResult: Complete analysis results

    Raises:
        HTTPException: 400 for invalid files, 413 for too large, 500 for processing errors
    """
    # Validate file
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    if not file.filename:
        raise HTTPException(status_code=400, detail="File must have a filename")
    if not file.filename.lower().endswith(".c3d"):
        raise HTTPException(
            status_code=400, detail="File must be a C3D file (.c3d extension required)"
        )

    # Check file size (basic validation)
    if hasattr(file, "size") and file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.1f}MB",
        )

    logger.info(f"Processing upload request for file: {file.filename}")
    tmp_path = ""

    try:
        # Use a temporary file to handle the upload to be able to pass a path to the processor
        with tempfile.NamedTemporaryFile(delete=False, suffix=".c3d") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # STATELESS C3D Processing - NO database storage, returns signals directly
        # This is the correct architecture for upload endpoint (vs webhook which uses TherapySessionProcessor)
        logger.info(f"🔄 Starting stateless C3D processing: {tmp_path}")
        
        try:
            # Initialize C3D processor directly with the temporary file
            c3d_processor = GHOSTLYC3DProcessor(tmp_path)
            
            # Process the file stateless - returns all signals and analytics
            processing_result = await run_in_threadpool(
                c3d_processor.process_file,
                processing_opts=processing_opts if processing_opts else ProcessingOptions(),
                session_game_params=session_params,
                include_signals=True  # Always include signals for stateless upload
            )
            
            # Extract all C3D parameters from metadata (where C3DUtils puts them)
            metadata = processing_result.get("metadata", {})
            processing_result["c3d_parameters"] = {
                # Technical parameters from C3D file
                "sampling_rate": metadata.get("sampling_rate"),
                "duration": metadata.get("duration_seconds"),  # Note: field name is duration_seconds
                "frame_count": metadata.get("frame_count"), 
                "channel_count": metadata.get("channel_count", len(processing_result.get("analytics", {}))),
                # Game-related fields from C3D file
                "game_name": metadata.get("game_name"),
                "level": metadata.get("level"),
                "therapist_id": metadata.get("therapist_id"),
                "group_id": metadata.get("group_id"),
                "player_name": metadata.get("player_name"),
                "player_id": metadata.get("player_id"),  # If available
                "time": metadata.get("time"),
                # Processing metadata
                "processing_version": PROCESSING_VERSION,
                "processed_at": datetime.now().isoformat(),
                "stateless_mode": True
            }
            
            # Store EMG processing results with explicit naming
            raw_emg_analytics = processing_result
            logger.info(f"✅ EMG processing completed: {len(raw_emg_analytics.get('analytics', {}))} channels")
            
            # CLINICAL PROCESSING ORCHESTRATION: Convert EMG data to clinical format and calculate performance scores
            try:
                # Import clinical services (local import to avoid circular dependencies)
                from services.clinical.emg_analytics_adapter import convert_emg_analytics_to_clinical_session_metrics
                from services.clinical.performance_scoring_service import PerformanceScoringService
                
                # Step 1: Convert EMG analytics to clinical SessionMetrics format
                clinical_session_metrics = convert_emg_analytics_to_clinical_session_metrics(
                    raw_emg_analytics.get("analytics", {}), 
                    session_params
                )
                logger.info(f"🔌 Analytics converted to clinical format: session_id={clinical_session_metrics.session_id}")
                
                # Step 2: Calculate performance scores using existing clinical service  
                clinical_service = PerformanceScoringService()
                clinical_performance_scores = clinical_service.calculate_performance_scores(
                    session_id=clinical_session_metrics.session_id,
                    session_metrics=clinical_session_metrics
                )
                logger.info(f"📊 Clinical performance scores calculated: {list(clinical_performance_scores.keys())}")
                
                # Combine EMG processing results with clinical analysis
                result_data = raw_emg_analytics

                # Enhance performance analysis with all fields needed for CSV
                result_data["performance_analysis"] = enhance_performance_analysis(
                    clinical_performance_scores,
                    session_params
                )

                # Format session configuration for frontend
                result_data["session_configuration"] = format_session_configuration(session_params)

                # Add scoring configuration for transparency
                result_data["scoring_configuration"] = get_scoring_configuration()
                
            except Exception as clinical_error:
                logger.exception(f"⚠️ Clinical processing failed, continuing with EMG data only: {clinical_error}")
                # Fallback: Use EMG processing results without clinical scores
                result_data = raw_emg_analytics
                result_data["performance_analysis"] = {
                    "error": f"Clinical processing failed: {str(clinical_error)}",
                    "emg_data_available": True,
                    "fallback_mode": True
                }
            
        except Exception as e:
            logger.exception(f"❌ C3D processing failed: {e}")
            
            # Enhanced error handling: Extract C3D metadata even on processing failure
            try:
                # Try to extract C3D metadata for enhanced error response
                from services.c3d.processor import C3DUtils
                
                c3d_file = C3DUtils.load_c3d_file(tmp_path)
                c3d_metadata = {
                    'duration_seconds': c3d_file.header.frame_count / c3d_file.header.analog_sample_rate if c3d_file.header.analog_sample_rate > 0 else 0,
                    'sampling_rate': c3d_file.header.analog_sample_rate,
                    'frame_count': c3d_file.header.frame_count,
                    'channel_count': len(c3d_file.data.analogs) if hasattr(c3d_file.data, 'analogs') and c3d_file.data.analogs else 0,
                    'game_name': c3d_file.parameters.get('GAME_NAME', {}).get('data', ['Unknown'])[0] if 'GAME_NAME' in c3d_file.parameters else 'Unknown',
                    'player_name': c3d_file.parameters.get('PLAYER_NAME', {}).get('data', ['Unknown'])[0] if 'PLAYER_NAME' in c3d_file.parameters else 'Unknown',
                    'therapist_id': c3d_file.parameters.get('THERAPIST_ID', {}).get('data', ['Unknown'])[0] if 'THERAPIST_ID' in c3d_file.parameters else 'Unknown',
                    'level': c3d_file.parameters.get('LEVEL', {}).get('data', ['Unknown'])[0] if 'LEVEL' in c3d_file.parameters else 'Unknown',
                    'time': c3d_file.parameters.get('TIME', {}).get('data', ['Unknown'])[0] if 'TIME' in c3d_file.parameters else 'Unknown',
                }
                
                # Check if this is an EMG validation failure specifically
                error_str = str(e).lower()
                is_emg_validation_failure = any(keyword in error_str for keyword in [
                    'signal too short', 'insufficient', 'samples', 'clinical', 'duration', 'no emg data loaded'
                ])
                
                if is_emg_validation_failure:
                    # Create structured error response for EMG validation failures
                    from emg.signal_processing import ProcessingParameters
                    
                    structured_error = {
                        'error_type': 'emg_validation_failure',
                        'message': 'EMG analysis not possible',
                        'c3d_metadata': c3d_metadata,
                        'clinical_requirements': {
                            'min_duration_seconds': ProcessingParameters.MIN_CLINICAL_DURATION_SECONDS,
                            'max_duration_seconds': ProcessingParameters.MAX_CLINICAL_DURATION_SECONDS,
                            'min_samples_required': ProcessingParameters.MIN_SAMPLES_REQUIRED,
                            'actual_samples': c3d_metadata['frame_count'],
                            'reason': 'EMG analysis requires sufficient signal duration for therapeutic assessment'
                        },
                        'file_info': {
                            'filename': file.filename,
                            'contains_motion_data': c3d_metadata['frame_count'] > c3d_metadata['channel_count'] * 10,  # Heuristic
                            'emg_channels': c3d_metadata['channel_count'],
                            'file_type': 'c3d',
                            'processing_attempted': True,
                            'processing_successful': False,
                            'failure_stage': 'emg_validation'
                        },
                        'user_guidance': {
                            'primary_recommendation': f"Record longer EMG sessions ({ProcessingParameters.MIN_CLINICAL_DURATION_SECONDS} seconds to {ProcessingParameters.MAX_CLINICAL_DURATION_SECONDS // 60} minutes)",
                            'secondary_recommendations': [
                                f'Record longer EMG sessions ({ProcessingParameters.MIN_CLINICAL_DURATION_SECONDS} seconds to {ProcessingParameters.MAX_CLINICAL_DURATION_SECONDS // 60} minutes)',
                                'Check GHOSTLY game recording settings',
                                'Ensure proper EMG sensor connectivity',
                                'Verify EMG data is being captured during gameplay'
                            ],
                            'technical_note': 'File contains valid C3D data but insufficient EMG duration for analysis'
                        },
                        'processing_context': {
                            'stage_reached': 'emg_validation',
                            'c3d_load_successful': True,
                            'metadata_extraction_successful': True,
                            'emg_validation_successful': False,
                            'failure_reason': 'insufficient_signal_duration',
                            'processing_time_ms': 50  # Estimated time for metadata extraction
                        },
                        'file_analysis': {
                            'file_size_mb': round(file.size / (1024 * 1024), 2) if file.size else 0.0,
                            'emg_duration_seconds': c3d_metadata['duration_seconds'],
                            'size_duration_discrepancy': (file.size or 0) > 1024 * 1024 and c3d_metadata['duration_seconds'] < 1.0,  # Large file but short duration
                            'likely_contains_motion_data': c3d_metadata['frame_count'] > c3d_metadata['channel_count'] * 10,
                            'emg_portion_of_file': 'minimal' if c3d_metadata['duration_seconds'] < 1.0 else 'substantial'
                        }
                    }
                    
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=422,
                        content=structured_error
                    )
                else:
                    # For non-EMG validation failures, still provide enhanced error context
                    enhanced_error = {
                        'error_type': 'processing_failure',
                        'message': f'C3D processing failed: {str(e)}',
                        'c3d_metadata': c3d_metadata,
                        'file_info': {
                            'filename': file.filename,
                            'file_type': 'c3d',
                            'processing_attempted': True,
                            'processing_successful': False
                        },
                        'original_error': str(e)
                    }
                    
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=500,
                        content=enhanced_error
                    )
                    
            except HTTPException:
                # Re-raise HTTP exceptions (structured errors above)
                raise
            except Exception as metadata_error:
                logger.warning(f"Could not extract C3D metadata for error response: {metadata_error}")
                
                # Check if this is a corrupted/invalid C3D file
                error_str = str(e).lower()
                metadata_error_str = str(metadata_error).lower()
                is_corrupted_file = any(keyword in error_str or keyword in metadata_error_str for keyword in [
                    'invalid', 'corrupted', 'bad file', 'format', 'header', 'malformed', 'parse'
                ])
                
                if is_corrupted_file:
                    # Return structured error for corrupted files
                    structured_error = {
                        'error_type': 'file_corruption',
                        'message': 'Unable to read C3D file',
                        'file_info': {
                            'filename': file.filename,
                            'processing_successful': False,
                            'file_type': 'c3d',
                            'processing_attempted': True,
                            'failure_stage': 'c3d_loading'
                        },
                        'user_guidance': {
                            'primary_recommendation': 'Try re-downloading the file',
                            'secondary_recommendations': [
                                'Try re-downloading the file',
                                'Check if the file was corrupted during transfer',
                                'Verify the file was exported correctly from GHOSTLY',
                                'Contact technical support if the issue persists'
                            ],
                            'technical_note': 'File does not appear to be a valid C3D format'
                        }
                    }
                    
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=400,
                        content=structured_error
                    )
                
                # Fallback to original error handling for other cases
                raise HTTPException(
                    status_code=500,
                    detail=f"C3D processing failed: {str(e)}"
                )

        # Create result object
        game_metadata = GameMetadata(**result_data["metadata"])

        analytics = {k: ChannelAnalytics(**v) for k, v in result_data["analytics"].items()}

        # Extract C3D parameters from processing result
        try:
            c3d_params = result_data.get("c3d_parameters", {})
            if not c3d_params:
                # Fallback: extract parameters from metadata (where they actually are)
                metadata = result_data.get("metadata", {})
                c3d_params = {
                    "sampling_rate": metadata.get("sampling_rate"),
                    "duration": metadata.get("duration_seconds"),
                    "frame_count": metadata.get("frame_count"),
                    "channel_count": metadata.get("channel_count", len(result_data.get("analytics", {}))),
                    "player_name": metadata.get("player_name"),
                    "therapist_id": metadata.get("therapist_id"),
                    "level": metadata.get("level"),
                }
        except Exception as e:
            logger.warning(f"Failed to extract C3D parameters: {e!s}")
            c3d_params = {"error": f"Parameter extraction failed: {e!s}"}

        response_model = EMGAnalysisResult(
            file_id=str(uuid.uuid4()),  # Generate a new UUID for this stateless request
            timestamp=datetime.now().strftime("%Y%m%d_%H%M%S"),
            source_filename=file.filename,
            metadata=GameMetadata(
                **{**game_metadata.model_dump(), "session_parameters_used": session_params}
            ),
            analytics=analytics,
            available_channels=result_data["available_channels"],
            emg_signals=result_data.get(
                "emg_signals", {}
            ),  # EMG signal data (raw, activated, processed) from C3D processor
            c3d_parameters=c3d_params,  # Include comprehensive C3D parameters
            user_id=file_metadata["user_id"],
            patient_id=file_metadata["patient_id"],
            session_id=file_metadata["session_id"],
            # NEW: Include clinical data from enhanced processor
            session_parameters=result_data.get("session_parameters"),
            session_configuration=result_data.get("session_configuration"),  # NEW: Formatted session config
            processing_parameters=result_data.get("processing_parameters"),
            performance_analysis=result_data.get("performance_analysis"),
            scoring_configuration=result_data.get("scoring_configuration"),  # NEW: Scoring weights
        )
        return response_model

    except Exception as e:
        logger.error(f"Upload processing error: {e!s}", exc_info=True)
        # Provide more specific error messages based on error type
        if "C3D" in str(e):
            raise HTTPException(status_code=400, detail=f"C3D file processing error: {e!s}")
        elif "permission" in str(e).lower() or "access" in str(e).lower():
            raise HTTPException(status_code=403, detail=f"File access error: {e!s}")
        elif "size" in str(e).lower() or "memory" in str(e).lower():
            raise HTTPException(status_code=413, detail=f"File too large or memory error: {e!s}")
        else:
            raise HTTPException(status_code=500, detail=f"Server error processing file: {e!s}")
    finally:
        if file:
            await file.close()
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
