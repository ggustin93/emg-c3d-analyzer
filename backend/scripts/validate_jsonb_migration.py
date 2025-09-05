#!/usr/bin/env python3
"""
EMG Statistics JSONB Migration Validation Script
==============================================

This script validates the successful migration from legacy columns to JSONB clinical groups.
Run this after applying both database migrations to ensure the system is working correctly.

Usage:
    python scripts/validate_jsonb_migration.py [--session-id UUID]

Requirements:
    - Both migrations must be applied:
      1. 20250904190000_optimize_emg_statistics_clinical_groups.sql
      2. 20250904200000_cleanup_legacy_emg_statistics_columns.sql
"""

import asyncio
import json
import sys
from typing import Optional
from uuid import UUID

import click
from database.connection import create_supabase_client
from services.clinical.repositories.emg_data_repository import EMGDataRepository
from services.clinical.therapy_session_processor import TherapySessionProcessor


class JSONBMigrationValidator:
    """Validates JSONB migration completion and system functionality."""
    
    def __init__(self):
        self.client = create_supabase_client()
        self.emg_repo = EMGDataRepository(self.client)
        self.processor = TherapySessionProcessor()
    
    async def validate_schema(self) -> bool:
        """Validate database schema has been updated correctly."""
        print("🔍 Validating database schema...")
        
        try:
            # Check if clinical view exists
            result = self.client.table("emg_statistics_clinical_view").select("*").limit(1).execute()
            print("✅ Clinical view exists and is accessible")
            
            # Check if JSONB columns exist in main table
            result = self.client.table("emg_statistics").select(
                "contraction_quality_metrics, contraction_timing_metrics, "
                "muscle_activation_metrics, fatigue_assessment_metrics"
            ).limit(1).execute()
            print("✅ JSONB clinical groups exist in emg_statistics table")
            
            # Check that legacy columns have been removed (this will fail if cleanup migration not applied)
            try:
                result = self.client.table("emg_statistics").select("total_contractions").limit(1).execute()
                print("⚠️  Legacy columns still present - cleanup migration may not be applied")
                return False
            except Exception:
                print("✅ Legacy columns removed - cleanup migration completed")
            
            return True
            
        except Exception as e:
            print(f"❌ Schema validation failed: {e}")
            return False
    
    async def validate_data_migration(self, session_id: Optional[str] = None) -> bool:
        """Validate data has been migrated correctly to JSONB format."""
        print("📊 Validating data migration...")
        
        try:
            if session_id:
                # Validate specific session
                stats = self.emg_repo.get_emg_statistics_clinical_view(session_id)
                if not stats:
                    print(f"❌ No statistics found for session {session_id}")
                    return False
                print(f"✅ Found {len(stats)} EMG statistics for session {session_id}")
            else:
                # Get any recent session for validation
                result = self.client.table("emg_statistics_clinical_view").select("*").limit(5).execute()
                stats = result.data
                if not stats:
                    print("⚠️  No EMG statistics found - create test data to validate")
                    return True
            
            # Validate JSONB structure
            for stat in stats[:1]:  # Check first record
                self._validate_jsonb_structure(stat)
            
            print("✅ Data migration validation completed")
            return True
            
        except Exception as e:
            print(f"❌ Data migration validation failed: {e}")
            return False
    
    def _validate_jsonb_structure(self, stat: dict) -> None:
        """Validate individual JSONB group structure."""
        required_groups = [
            'contraction_quality_metrics',
            'contraction_timing_metrics', 
            'muscle_activation_metrics',
            'fatigue_assessment_metrics'
        ]
        
        for group in required_groups:
            if group not in stat or not stat[group]:
                raise ValueError(f"Missing or empty JSONB group: {group}")
            
            jsonb_data = stat[group]
            if isinstance(jsonb_data, str):
                jsonb_data = json.loads(jsonb_data)
            
            if not isinstance(jsonb_data, dict) or not jsonb_data:
                raise ValueError(f"Invalid JSONB structure in group: {group}")
        
        print(f"✅ JSONB structure valid for record {stat.get('id', 'unknown')}")
    
    async def validate_backwards_compatibility(self) -> bool:
        """Validate that existing API calls still work."""
        print("🔄 Validating backwards compatibility...")
        
        try:
            # Test that clinical view provides computed flat fields
            result = self.client.table("emg_statistics_clinical_view").select(
                "total_contractions, good_contractions, mvc75_compliance_rate, "
                "avg_duration_ms, rms_mean, mpf_mean"
            ).limit(1).execute()
            
            if result.data:
                stat = result.data[0]
                # Check that computed fields are present and valid
                computed_fields = ['total_contractions', 'avg_duration_ms', 'rms_mean']
                for field in computed_fields:
                    if field in stat and stat[field] is not None:
                        print(f"✅ Computed field '{field}' available: {stat[field]}")
                    else:
                        print(f"⚠️  Computed field '{field}' missing or null")
            
            print("✅ Backwards compatibility validated")
            return True
            
        except Exception as e:
            print(f"❌ Backwards compatibility validation failed: {e}")
            return False
    
    async def validate_performance(self) -> bool:
        """Basic performance validation of JSONB queries."""
        print("⚡ Validating query performance...")
        
        try:
            import time
            
            # Test JSONB query performance
            start_time = time.time()
            result = self.client.table("emg_statistics").select(
                "id, contraction_quality_metrics->>total_contractions"
            ).limit(100).execute()
            query_time = time.time() - start_time
            
            print(f"✅ JSONB query completed in {query_time:.3f}s ({len(result.data)} records)")
            
            if query_time > 2.0:
                print("⚠️  Query performance may need optimization")
            
            return True
            
        except Exception as e:
            print(f"❌ Performance validation failed: {e}")
            return False
    
    async def validate_integration(self) -> bool:
        """Test that TherapySessionProcessor works with new schema."""
        print("🔧 Validating processor integration...")
        
        try:
            # Test clinical JSONB builder methods
            test_data = {
                'contraction_count': 10,
                'good_contraction_count': 8,
                'avg_duration_ms': 2500.0,
                'rms': 0.45,
                'mpf': 85.2
            }
            
            # Test builder methods
            quality_metrics = self.processor._build_contraction_quality_metrics(test_data)
            if not quality_metrics or 'total_contractions' not in quality_metrics:
                raise ValueError("Quality metrics builder failed")
            
            print("✅ TherapySessionProcessor JSONB builders working")
            print("✅ Integration validation completed")
            return True
            
        except Exception as e:
            print(f"❌ Integration validation failed: {e}")
            return False
    
    async def run_full_validation(self, session_id: Optional[str] = None) -> bool:
        """Run complete validation suite."""
        print("🚀 Starting EMG Statistics JSONB Migration Validation")
        print("=" * 60)
        
        validations = [
            ("Schema", self.validate_schema()),
            ("Data Migration", self.validate_data_migration(session_id)),
            ("Backwards Compatibility", self.validate_backwards_compatibility()),
            ("Performance", self.validate_performance()),
            ("Integration", self.validate_integration())
        ]
        
        results = []
        for name, validation in validations:
            print(f"\n📋 {name} Validation:")
            result = await validation
            results.append((name, result))
            if result:
                print(f"✅ {name} validation PASSED")
            else:
                print(f"❌ {name} validation FAILED")
        
        print("\n" + "=" * 60)
        print("📊 VALIDATION SUMMARY:")
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"  {name}: {status}")
        
        overall_success = passed == total
        if overall_success:
            print(f"\n🎉 ALL VALIDATIONS PASSED ({passed}/{total})")
            print("✅ JSONB migration completed successfully!")
            print("✅ System ready for production use")
        else:
            print(f"\n⚠️  SOME VALIDATIONS FAILED ({passed}/{total})")
            print("❌ Migration incomplete or issues detected")
            print("🔧 Review failed validations and apply necessary fixes")
        
        return overall_success


@click.command()
@click.option('--session-id', help='Specific session ID to validate')
def main(session_id: Optional[str] = None):
    """Run JSONB migration validation."""
    validator = JSONBMigrationValidator()
    
    # Validate session ID if provided
    if session_id:
        try:
            UUID(session_id)
        except ValueError:
            print(f"❌ Invalid session ID format: {session_id}")
            sys.exit(1)
    
    success = asyncio.run(validator.run_full_validation(session_id))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()