#!/usr/bin/env python3
"""
Data Migration Script: Legacy to Statistics-First Schema
Purpose: Migrate existing data from c3d_metadata and analysis_results to new optimized schema
Date: August 12, 2025

CRITICAL MIGRATION: This script transforms existing monolithic data into the new
Statistics-First architecture for 10x performance improvement.

Business Impact:
- Preserves all historical clinical data
- Enables instant Performance Dashboard loading  
- Maintains data integrity during architecture transition
- Supports clinical trial continuity

Technical Strategy:
- Read from legacy tables (c3d_metadata, analysis_results)
- Parse JSONB structures and extract clinical metrics
- Insert structured data into 7 new specialized tables
- Maintain referential integrity with existing patients/therapists
- Provide detailed logging and validation
"""

import os
import sys
import json
import logging
import hashlib
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

# Add backend to Python path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database.supabase_client import SupabaseClient
from services.emg_analysis import EMGAnalysisService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/data_migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class MigrationStats:
    """Track migration statistics and progress"""
    total_sessions: int = 0
    migrated_sessions: int = 0
    skipped_sessions: int = 0
    failed_sessions: int = 0
    emg_statistics_created: int = 0
    performance_scores_created: int = 0
    bfr_monitoring_created: int = 0
    session_settings_created: int = 0
    errors: List[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []

class StatisticsFirstMigrator:
    """
    Migrates data from legacy monolithic schema to optimized Statistics-First architecture
    """
    
    def __init__(self, supabase_client: SupabaseClient, dry_run: bool = False):
        self.client = supabase_client
        self.dry_run = dry_run
        self.stats = MigrationStats()
        self.emg_service = EMGAnalysisService()
        
        logger.info(f"Initialized Statistics-First Migrator (dry_run={dry_run})")
    
    def run_migration(self) -> MigrationStats:
        """
        Execute the complete data migration from legacy to Statistics-First schema
        """
        logger.info("🚀 Starting Statistics-First Schema Migration")
        
        try:
            # Step 1: Validate new schema exists
            self._validate_new_schema()
            
            # Step 2: Get all legacy sessions to migrate
            legacy_sessions = self._get_legacy_sessions()
            self.stats.total_sessions = len(legacy_sessions)
            
            logger.info(f"📊 Found {self.stats.total_sessions} sessions to migrate")
            
            # Step 3: Migrate each session
            for session_data in legacy_sessions:
                try:
                    self._migrate_session(session_data)
                    self.stats.migrated_sessions += 1
                    
                    # Progress logging every 10 sessions
                    if self.stats.migrated_sessions % 10 == 0:
                        logger.info(f"✅ Migrated {self.stats.migrated_sessions}/{self.stats.total_sessions} sessions")
                        
                except Exception as e:
                    self.stats.failed_sessions += 1
                    error_msg = f"Failed to migrate session {session_data.get('id', 'unknown')}: {str(e)}"
                    self.stats.errors.append(error_msg)
                    logger.error(error_msg)
            
            # Step 4: Final validation and reporting
            self._validate_migration_results()
            self._generate_migration_report()
            
            logger.info("🎉 Statistics-First Schema Migration Complete!")
            return self.stats
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {str(e)}")
            raise
    
    def _validate_new_schema(self) -> None:
        """Validate that the new Statistics-First schema tables exist"""
        logger.info("🔍 Validating new schema tables exist...")
        
        required_tables = [
            'therapy_sessions', 'emg_statistics', 'performance_scores',
            'bfr_monitoring', 'session_settings', 'export_history',
            'signal_processing_cache'
        ]
        
        for table in required_tables:
            result = self.client.execute_sql(
                f"SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '{table}'"
            )
            
            if not result.data or result.data[0]['count'] == 0:
                raise Exception(f"Required table '{table}' does not exist. Please apply migration 006 first.")
        
        logger.info("✅ All new schema tables validated")
    
    def _get_legacy_sessions(self) -> List[Dict]:
        """Get all legacy sessions that need migration"""
        logger.info("📋 Retrieving legacy sessions from c3d_metadata...")
        
        # Get all c3d_metadata records with their analysis_results
        query = """
        SELECT 
            cm.*,
            ar.analysis_data,
            ar.status as analysis_status,
            ar.analyzed_at,
            ar.version as analysis_version
        FROM c3d_metadata cm
        LEFT JOIN analysis_results ar ON cm.id = ar.session_id
        ORDER BY cm.created_at ASC
        """
        
        result = self.client.execute_sql(query)
        
        if not result.data:
            logger.warning("⚠️  No legacy sessions found to migrate")
            return []
        
        logger.info(f"📊 Found {len(result.data)} legacy sessions")
        return result.data
    
    def _migrate_session(self, legacy_session: Dict) -> None:
        """Migrate a single session from legacy to Statistics-First schema"""
        session_id = legacy_session['id']
        
        logger.debug(f"🔄 Migrating session {session_id}")
        
        # Check if already migrated (idempotency)
        if self._session_already_migrated(session_id, legacy_session['file_hash']):
            self.stats.skipped_sessions += 1
            logger.debug(f"⏭️  Session {session_id} already migrated, skipping")
            return
        
        # Extract and transform data for new schema
        therapy_session_data = self._extract_therapy_session_data(legacy_session)
        emg_stats_data = self._extract_emg_statistics_data(legacy_session)
        performance_data = self._extract_performance_scores_data(legacy_session)
        bfr_data = self._extract_bfr_monitoring_data(legacy_session)
        settings_data = self._extract_session_settings_data(legacy_session)
        
        if not self.dry_run:
            # Insert into new schema with transaction safety
            with self.client.transaction():
                # 1. Insert therapy_session (parent record)
                new_session_id = self._insert_therapy_session(therapy_session_data)
                
                # 2. Insert EMG statistics (per channel)
                self._insert_emg_statistics(new_session_id, emg_stats_data)
                
                # 3. Insert performance scores
                if performance_data:
                    self._insert_performance_scores(new_session_id, performance_data)
                    self.stats.performance_scores_created += 1
                
                # 4. Insert BFR monitoring data
                if bfr_data:
                    self._insert_bfr_monitoring(new_session_id, bfr_data)
                    self.stats.bfr_monitoring_created += 1
                
                # 5. Insert session settings
                if settings_data:
                    self._insert_session_settings(new_session_id, settings_data)
                    self.stats.session_settings_created += 1
        
        else:
            logger.info(f"🔍 [DRY RUN] Would migrate session {session_id}")
    
    def _session_already_migrated(self, legacy_id: str, file_hash: str) -> bool:
        """Check if session already exists in new schema (idempotency check)"""
        result = self.client.execute_sql(
            "SELECT id FROM therapy_sessions WHERE file_hash = %s",
            (file_hash,)
        )
        return bool(result.data)
    
    def _extract_therapy_session_data(self, legacy: Dict) -> Dict:
        """Extract therapy_sessions table data from legacy c3d_metadata"""
        return {
            'file_path': legacy['file_path'],
            'file_hash': legacy.get('file_hash') or self._generate_file_hash(legacy['file_path']),
            'file_size_bytes': legacy.get('file_size_bytes', 0),
            'patient_id': legacy.get('patient_id'),
            'therapist_id': legacy.get('therapist_id'),
            'session_id': legacy.get('session_id'),
            'session_date': legacy.get('session_date'),
            'session_type': legacy.get('session_type', 'training'),
            'protocol_day': legacy.get('protocol_day'),
            'original_sampling_rate': legacy.get('original_sampling_rate', 2000.0),
            'original_duration_seconds': legacy.get('original_duration_seconds', 0.0),
            'original_sample_count': legacy.get('original_sample_count', 0),
            'channel_names': legacy.get('channel_names', []),
            'channel_count': legacy.get('channel_count', 0),
            'processing_version': legacy.get('version', '1.0.0'),
            'processing_status': self._map_processing_status(legacy.get('analysis_status', 'pending')),
            'processing_time_ms': legacy.get('processing_time_ms'),
            'processing_error_message': legacy.get('error_message'),
            'created_at': legacy.get('created_at'),
            'processed_at': legacy.get('analyzed_at'),
            'updated_at': legacy.get('updated_at')
        }
    
    def _extract_emg_statistics_data(self, legacy: Dict) -> List[Dict]:
        """Extract emg_statistics table data from legacy analysis_results JSONB"""
        emg_stats = []
        
        analysis_data = legacy.get('analysis_data', {})
        if not analysis_data or not isinstance(analysis_data, dict):
            return emg_stats
        
        channels_data = analysis_data.get('channels', [])
        if not isinstance(channels_data, list):
            return emg_stats
        
        for channel_data in channels_data:
            if not isinstance(channel_data, dict):
                continue
                
            # Extract clinical metrics from legacy JSONB structure
            contractions = channel_data.get('contractions', {})
            compliance = channel_data.get('compliance', {})
            quality = channel_data.get('quality', {})
            temporal_stats = channel_data.get('temporal_stats', {})
            processing = channel_data.get('processing', {})
            
            stat_record = {
                'channel_name': channel_data.get('name', 'Unknown'),
                'mvc_peak_value': channel_data.get('mvc_peak', 0.0),
                'mvc_rms_value': channel_data.get('mvc_rms', 0.0),
                'mvc_confidence_score': channel_data.get('mvc_confidence', 0.0),
                'mvc_calculation_method': channel_data.get('mvc_method', 'backend_95percentile'),
                
                # Contraction analysis
                'total_contractions': contractions.get('total', 0),
                'good_contractions_intensity': contractions.get('good_intensity', 0),
                'good_contractions_duration': contractions.get('good_duration', 0),
                'good_contractions_both': contractions.get('good_both', 0),
                
                # Compliance rates
                'completion_rate': compliance.get('completion_rate', 0.0),
                'intensity_rate': compliance.get('intensity_rate', 0.0),
                'duration_rate': compliance.get('duration_rate', 0.0),
                'muscle_compliance_score': compliance.get('overall_score', 0.0),
                
                # Signal quality
                'signal_quality_score': quality.get('signal_quality', 0.0),
                'noise_level_db': quality.get('noise_level_db'),
                'artifacts_detected': quality.get('artifacts_count', 0),
                'processing_confidence': quality.get('processing_confidence', 0.0),
                
                # Temporal statistics (extract from nested structure)
                'rms_mean': self._safe_get_nested(temporal_stats, ['rms', 'mean']),
                'rms_std': self._safe_get_nested(temporal_stats, ['rms', 'std']),
                'rms_min': self._safe_get_nested(temporal_stats, ['rms', 'min']),
                'rms_max': self._safe_get_nested(temporal_stats, ['rms', 'max']),
                'mav_mean': self._safe_get_nested(temporal_stats, ['mav', 'mean']),
                'mav_std': self._safe_get_nested(temporal_stats, ['mav', 'std']),
                'mpf_mean': self._safe_get_nested(temporal_stats, ['mpf', 'mean']),
                'mpf_std': self._safe_get_nested(temporal_stats, ['mpf', 'std']),
                'mdf_mean': self._safe_get_nested(temporal_stats, ['mdf', 'mean']),
                'mdf_std': self._safe_get_nested(temporal_stats, ['mdf', 'std']),
                'fatigue_index': temporal_stats.get('fatigue_index'),
                
                # Processing metadata
                'processing_pipeline': processing.get('pipeline', '20Hz->Rectify->10Hz->RMS'),
                'processing_version': processing.get('version', '1.0.0'),
                'processing_time_ms': processing.get('time_ms'),
                
                # Thresholds used
                'mvc_threshold_percentage': self._safe_get_nested(processing, ['thresholds', 'mvc_threshold'], 0.75),
                'duration_threshold_seconds': self._safe_get_nested(processing, ['thresholds', 'duration_threshold'], 2.0),
                
                'processed_at': legacy.get('analyzed_at') or datetime.now(timezone.utc)
            }
            
            emg_stats.append(stat_record)
        
        return emg_stats
    
    def _extract_performance_scores_data(self, legacy: Dict) -> Optional[Dict]:
        """Extract performance_scores table data from legacy analysis_results"""
        analysis_data = legacy.get('analysis_data', {})
        if not analysis_data:
            return None
        
        performance = analysis_data.get('performance', {})
        if not performance:
            return None
        
        components = performance.get('components', {})
        weights = performance.get('weights', {})
        bfr = performance.get('bfr', {})
        game_data = performance.get('game_data', {})
        muscle_breakdown = performance.get('muscle_breakdown', {})
        
        return {
            'overall_performance_score': performance.get('overall_score', 0.0),
            'compliance_score': components.get('compliance', 0.0),
            'symmetry_score': components.get('symmetry', 0.0),
            'effort_score': components.get('effort', 0.0),
            'game_score': components.get('game', 0.0),
            'performance_weights': weights or {"compliance": 0.40, "symmetry": 0.25, "effort": 0.20, "game": 0.15},
            'bfr_pressure_aop': bfr.get('pressure_aop'),
            'bfr_compliance_gate': bfr.get('compliance_gate', 1.0),
            'rpe_post_session': performance.get('rpe'),
            'game_points_achieved': game_data.get('points_achieved', 0),
            'game_points_maximum': game_data.get('points_maximum', 1000),
            'session_duration_minutes': performance.get('session_duration_minutes'),
            
            # Muscle breakdown
            'left_muscle_completion_rate': self._safe_get_nested(muscle_breakdown, ['left', 'completion']),
            'left_muscle_intensity_rate': self._safe_get_nested(muscle_breakdown, ['left', 'intensity']),
            'left_muscle_duration_rate': self._safe_get_nested(muscle_breakdown, ['left', 'duration']),
            'right_muscle_completion_rate': self._safe_get_nested(muscle_breakdown, ['right', 'completion']),
            'right_muscle_intensity_rate': self._safe_get_nested(muscle_breakdown, ['right', 'intensity']),
            'right_muscle_duration_rate': self._safe_get_nested(muscle_breakdown, ['right', 'duration']),
            
            'calculated_at': legacy.get('analyzed_at') or datetime.now(timezone.utc)
        }
    
    def _extract_bfr_monitoring_data(self, legacy: Dict) -> Optional[Dict]:
        """Extract bfr_monitoring table data from legacy analysis_results"""
        analysis_data = legacy.get('analysis_data', {})
        if not analysis_data:
            return None
        
        bfr = analysis_data.get('bfr', {})
        if not bfr:
            return None
        
        safety = bfr.get('safety', {})
        clinical_baseline = bfr.get('clinical_baseline', {})
        equipment = bfr.get('equipment', {})
        session_data = bfr.get('session_data', {})
        
        return {
            'target_pressure_aop': bfr.get('target_pressure', 50.0),
            'actual_pressure_aop': bfr.get('actual_pressure', 50.0),
            'pressure_stability_coefficient': bfr.get('stability'),
            'safety_gate_status': safety.get('gate_status', True),
            'safety_violations_count': safety.get('violations_count', 0),
            'safety_violations_duration_seconds': safety.get('violations_duration'),
            'max_pressure_deviation_aop': safety.get('max_deviation'),
            'patient_aop_baseline_mmhg': clinical_baseline.get('aop_baseline_mmhg'),
            'patient_limb_circumference_cm': clinical_baseline.get('limb_circumference_cm'),
            'cuff_size': clinical_baseline.get('cuff_size'),
            'cuff_position': clinical_baseline.get('cuff_position'),
            'monitoring_device': equipment.get('device'),
            'device_calibration_date': equipment.get('calibration_date'),
            'device_serial_number': equipment.get('serial_number'),
            'bfr_session_duration_minutes': session_data.get('duration_minutes'),
            'monitoring_frequency_hz': session_data.get('monitoring_frequency_hz', 1.0),
            'created_at': legacy.get('analyzed_at') or datetime.now(timezone.utc)
        }
    
    def _extract_session_settings_data(self, legacy: Dict) -> Optional[Dict]:
        """Extract session_settings table data from legacy analysis_results"""
        analysis_data = legacy.get('analysis_data', {})
        if not analysis_data:
            return None
        
        settings = analysis_data.get('settings', {})
        if not settings:
            return None
        
        mvc = settings.get('mvc', {})
        thresholds = settings.get('thresholds', {})
        protocol = settings.get('protocol', {})
        bfr = settings.get('bfr', {})
        ui = settings.get('ui', {})
        weights = settings.get('weights', {})
        
        return {
            'mvc_calculation_method': mvc.get('method', 'backend_calculated'),
            'mvc_threshold_percentage': mvc.get('threshold', 0.75),
            'mvc_user_left_quad': mvc.get('user_left_quad'),
            'mvc_user_right_quad': mvc.get('user_right_quad'),
            'performance_weights': weights or {"compliance": 0.40, "symmetry": 0.25, "effort": 0.20, "game": 0.15},
            'duration_threshold_seconds': thresholds.get('duration_seconds', 2.0),
            'duration_threshold_left_quad': thresholds.get('duration_left_quad'),
            'duration_threshold_right_quad': thresholds.get('duration_right_quad'),
            'target_contractions_per_muscle': protocol.get('target_contractions', 12),
            'rest_period_between_contractions_seconds': protocol.get('rest_contractions', 5),
            'rest_period_between_sets_seconds': protocol.get('rest_sets', 120),
            'bfr_enabled': bfr.get('enabled', True),
            'bfr_target_pressure_aop': bfr.get('target_pressure', 50.0),
            'game_difficulty_level': ui.get('game_difficulty', 1),
            'visual_feedback_enabled': ui.get('visual_feedback', True),
            'audio_feedback_enabled': ui.get('audio_feedback', True),
            'real_time_mvc_display': ui.get('realtime_mvc', True),
            'created_at': legacy.get('analyzed_at') or datetime.now(timezone.utc)
        }
    
    def _insert_therapy_session(self, data: Dict) -> str:
        """Insert therapy_session record and return new UUID"""
        result = self.client.table('therapy_sessions').insert(data).execute()
        
        if not result.data:
            raise Exception("Failed to insert therapy_session")
        
        return result.data[0]['id']
    
    def _insert_emg_statistics(self, session_id: str, emg_stats_list: List[Dict]) -> None:
        """Insert EMG statistics records for all channels"""
        for stat_data in emg_stats_list:
            stat_data['session_id'] = session_id
            
            result = self.client.table('emg_statistics').insert(stat_data).execute()
            if result.data:
                self.stats.emg_statistics_created += 1
    
    def _insert_performance_scores(self, session_id: str, data: Dict) -> None:
        """Insert performance_scores record"""
        data['session_id'] = session_id
        self.client.table('performance_scores').insert(data).execute()
    
    def _insert_bfr_monitoring(self, session_id: str, data: Dict) -> None:
        """Insert bfr_monitoring record"""
        data['session_id'] = session_id
        self.client.table('bfr_monitoring').insert(data).execute()
    
    def _insert_session_settings(self, session_id: str, data: Dict) -> None:
        """Insert session_settings record"""
        data['session_id'] = session_id
        self.client.table('session_settings').insert(data).execute()
    
    # Utility methods
    def _map_processing_status(self, legacy_status: str) -> str:
        """Map legacy analysis status to new processing status"""
        status_map = {
            'completed': 'completed',
            'analyzed': 'completed',
            'processing': 'processing',
            'failed': 'failed',
            'error': 'failed'
        }
        return status_map.get(legacy_status, 'pending')
    
    def _generate_file_hash(self, file_path: str) -> str:
        """Generate SHA-256 hash for file path if not provided"""
        return hashlib.sha256(file_path.encode()).hexdigest()
    
    def _safe_get_nested(self, data: Dict, keys: List[str], default=None):
        """Safely get nested dictionary values"""
        for key in keys:
            if isinstance(data, dict) and key in data:
                data = data[key]
            else:
                return default
        return data
    
    def _validate_migration_results(self) -> None:
        """Validate migration results and data integrity"""
        logger.info("🔍 Validating migration results...")
        
        # Count records in new tables
        tables = ['therapy_sessions', 'emg_statistics', 'performance_scores', 
                 'bfr_monitoring', 'session_settings']
        
        for table in tables:
            result = self.client.execute_sql(f"SELECT COUNT(*) FROM {table}")
            count = result.data[0]['count'] if result.data else 0
            logger.info(f"📊 {table}: {count} records")
    
    def _generate_migration_report(self) -> None:
        """Generate comprehensive migration report"""
        logger.info("📋 Generating Migration Report...")
        logger.info("=" * 60)
        logger.info("STATISTICS-FIRST SCHEMA MIGRATION REPORT")
        logger.info("=" * 60)
        logger.info(f"Total Sessions: {self.stats.total_sessions}")
        logger.info(f"Migrated Successfully: {self.stats.migrated_sessions}")
        logger.info(f"Skipped (Already Migrated): {self.stats.skipped_sessions}")
        logger.info(f"Failed: {self.stats.failed_sessions}")
        logger.info("-" * 60)
        logger.info(f"EMG Statistics Created: {self.stats.emg_statistics_created}")
        logger.info(f"Performance Scores Created: {self.stats.performance_scores_created}")
        logger.info(f"BFR Monitoring Created: {self.stats.bfr_monitoring_created}")
        logger.info(f"Session Settings Created: {self.stats.session_settings_created}")
        logger.info("=" * 60)
        
        if self.stats.errors:
            logger.error("❌ ERRORS ENCOUNTERED:")
            for error in self.stats.errors:
                logger.error(f"  - {error}")

def main():
    """Main migration execution"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate data to Statistics-First schema')
    parser.add_argument('--dry-run', action='store_true', help='Run migration without making changes')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize Supabase client
    supabase_client = SupabaseClient()
    
    # Run migration
    migrator = StatisticsFirstMigrator(supabase_client, dry_run=args.dry_run)
    stats = migrator.run_migration()
    
    # Exit with appropriate code
    if stats.failed_sessions > 0:
        logger.error("❌ Migration completed with errors")
        sys.exit(1)
    else:
        logger.info("✅ Migration completed successfully")
        sys.exit(0)

if __name__ == '__main__':
    main()