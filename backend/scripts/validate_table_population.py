#!/usr/bin/env python3
"""Manual Database Table Population Validation Script.

Use this script to manually verify that all 6 tables are correctly populated
after therapy session processing.

Usage:
    python scripts/validate_table_population.py [SESSION_ID]
    
If no SESSION_ID provided, validates the most recent session.
"""

import sys
from datetime import datetime, timezone

from database.supabase_client import get_supabase_client


def validate_session_tables(session_id: str = None) -> dict:
    """Validate that all required tables are populated for a session.
    
    Args:
        session_id: Session UUID to validate. If None, uses most recent session.
        
    Returns:
        dict: Validation results with table counts and status
    """
    supabase = get_supabase_client()
    
    # Get session ID if not provided
    if not session_id:
        sessions = supabase.table('therapy_sessions')\
            .select('id, file_path, created_at')\
            .order('created_at', desc=True)\
            .limit(1)\
            .execute()
        
        if not sessions.data:
            return {"error": "No sessions found in database"}
        
        session_id = sessions.data[0]['id']
        print(f"📋 Validating most recent session: {session_id}")
        print(f"   File: {sessions.data[0]['file_path']}")
        print(f"   Created: {sessions.data[0]['created_at']}")
    else:
        print(f"📋 Validating session: {session_id}")
    
    # Required tables with expected counts
    required_tables = {
        'c3d_technical_data': {'expected': 1, 'description': 'C3D file metadata'},
        'processing_parameters': {'expected': 1, 'description': 'EMG processing config'},
        'emg_statistics': {'expected': 2, 'description': 'Per-channel EMG statistics (CH1, CH2)'},  
        'performance_scores': {'expected': 1, 'description': 'GHOSTLY+ scores'},
        'session_settings': {'expected': 1, 'description': 'MVC/Duration/BFR settings'},
        'bfr_monitoring': {'expected': 2, 'description': 'Per-channel BFR monitoring (CH1, CH2)'}
    }
    
    results = {'session_id': session_id, 'tables': {}, 'status': 'PASS'}
    
    print(f"\n🔍 Validating {len(required_tables)} required tables...")
    print("=" * 80)
    
    for table_name, config in required_tables.items():
        try:
            # Count records for this session
            response = supabase.table(table_name)\
                .select('*', count='exact')\
                .eq('session_id', session_id)\
                .execute()
            
            actual_count = response.count
            expected_count = config['expected']
            
            # Store results
            results['tables'][table_name] = {
                'actual_count': actual_count,
                'expected_count': expected_count,
                'status': 'PASS' if actual_count == expected_count else 'FAIL',
                'description': config['description']
            }
            
            # Print status
            status_emoji = "✅" if actual_count == expected_count else "❌"
            print(f"{status_emoji} {table_name:<20} | {actual_count:>2}/{expected_count} records | {config['description']}")
            
            # Overall status
            if actual_count != expected_count:
                results['status'] = 'FAIL'
                
        except Exception as e:
            print(f"❌ {table_name:<20} | ERROR: {str(e)}")
            results['tables'][table_name] = {'error': str(e), 'status': 'ERROR'}
            results['status'] = 'FAIL'
    
    # Summary
    print("=" * 80)
    if results['status'] == 'PASS':
        print("🎉 ALL TABLES CORRECTLY POPULATED!")
    else:
        print("🔴 SOME TABLES MISSING OR INCORRECT COUNTS")
    
    return results


def show_detailed_data(session_id: str, table_name: str):
    """Show detailed data for a specific table and session."""
    supabase = get_supabase_client()
    
    try:
        response = supabase.table(table_name)\
            .select('*')\
            .eq('session_id', session_id)\
            .execute()
        
        print(f"\n📊 {table_name.upper()} DATA:")
        print("-" * 40)
        
        for record in response.data:
            for key, value in record.items():
                if key != 'session_id':  # Skip session_id for readability
                    print(f"  {key}: {value}")
            print("-" * 40)
            
    except Exception as e:
        print(f"❌ Error fetching {table_name}: {e}")


if __name__ == "__main__":
    # Get session ID from command line or use most recent
    session_id = sys.argv[1] if len(sys.argv) > 1 else None
    
    # Validate tables
    results = validate_session_tables(session_id)
    
    if 'error' in results:
        print(f"❌ Error: {results['error']}")
        sys.exit(1)
    
    # Show detailed data for failed tables
    if results['status'] == 'FAIL':
        print(f"\n🔍 DETAILED ANALYSIS:")
        session_id = results['session_id']
        
        for table_name, info in results['tables'].items():
            if info.get('status') == 'FAIL':
                show_detailed_data(session_id, table_name)
    
    # Exit code based on validation result
    sys.exit(0 if results['status'] == 'PASS' else 1)