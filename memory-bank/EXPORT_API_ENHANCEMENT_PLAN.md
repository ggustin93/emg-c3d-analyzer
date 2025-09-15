# Export API Enhancement Implementation Guide

## Executive Summary
Enhance the backend export API to include all fields currently only available in frontend CSV generation, creating a unified Single Source of Truth for all export formats.

## Risk Assessment

### Overall Risk Level: **LOW-MEDIUM** ⚠️

#### Risk Factors
- **Low Risk** ✅
  - Changes are mostly additive (new fields)
  - Existing functionality preserved
  - Can be implemented incrementally
  - Easy rollback strategy

- **Medium Risk** ⚠️
  - CSV converter currently unused (dead code)
  - Frontend/backend synchronization needed
  - Database queries for new fields need optimization

- **Mitigations** 🛡️
  - Implement in phases with testing between each
  - Keep frontend CSV as fallback initially
  - Add feature flag for new export system
  - Comprehensive logging for debugging

## Pre-Implementation Checklist

### Prerequisites
- [ ] Create feature branch: `feature/unified-export-api`
- [ ] Backup current export functionality
- [ ] Document current export field mappings
- [ ] Set up test environment with sample data
- [ ] Review database indexes for performance

### Safety Checks
- [ ] Verify all tests pass on main branch
- [ ] Confirm CSV export tests exist (backend/tests/integration/test_csv_export.py)
- [ ] Check frontend export tests (frontend/src/components/tabs/ExportTab/__tests__)
- [ ] Ensure database backup available
- [ ] Review with team if needed

## Phase 1: Backend Data Collection Enhancement

### 1.1 Add Missing Data Methods to Export Service
**File:** `backend/services/data/export_service.py`

#### Add Compliance Breakdown Method
```python
def _get_compliance_breakdown(self, session_id: str) -> dict[str, Any]:
    """Get detailed per-muscle compliance metrics."""
    try:
        # Query performance_scores for detailed compliance
        result = self.supabase.table('performance_scores').select(
            'left_muscle_compliance, right_muscle_compliance, '
            'completion_rate_left, completion_rate_right, '
            'intensity_rate_left, intensity_rate_right, '
            'duration_rate_left, duration_rate_right'
        ).eq('session_id', session_id).limit(1).execute()
        
        if result.data:
            return {
                'left_muscle': {
                    'overall_compliance': result.data[0].get('left_muscle_compliance'),
                    'completion_rate': result.data[0].get('completion_rate_left'),
                    'intensity_rate': result.data[0].get('intensity_rate_left'),
                    'duration_rate': result.data[0].get('duration_rate_left')
                },
                'right_muscle': {
                    'overall_compliance': result.data[0].get('right_muscle_compliance'),
                    'completion_rate': result.data[0].get('completion_rate_right'),
                    'intensity_rate': result.data[0].get('intensity_rate_right'),
                    'duration_rate': result.data[0].get('duration_rate_right')
                }
            }
        return {}
    except Exception as e:
        logger.error(f"Failed to get compliance breakdown: {e}")
        return {}
```

- [ ] Implement `_get_compliance_breakdown()` method
- [ ] Add error handling and logging
- [ ] Test with sample session ID

#### Add Processing Parameters Method
```python
def _get_processing_parameters(self, session_id: str) -> dict[str, Any]:
    """Get signal processing configuration used."""
    try:
        # Query therapy_sessions for processing metadata
        result = self.supabase.table('therapy_sessions').select(
            'processing_version, sampling_rate_hz, '
            'filter_low_cutoff_hz, filter_high_cutoff_hz, filter_order, '
            'rms_window_ms, rms_overlap_percent, '
            'threshold_factor, min_duration_ms'
        ).eq('id', session_id).limit(1).execute()
        
        if result.data:
            return result.data[0]
        
        # Fallback to defaults if not stored
        return {
            'processing_version': '2.0.0',
            'sampling_rate_hz': 2000,
            'filter_low_cutoff_hz': 20,
            'filter_high_cutoff_hz': 500,
            'filter_order': 4,
            'rms_window_ms': 200,
            'rms_overlap_percent': 50,
            'threshold_factor': 0.2,
            'min_duration_ms': 500
        }
    except Exception as e:
        logger.error(f"Failed to get processing parameters: {e}")
        return {}
```

- [ ] Implement `_get_processing_parameters()` method
- [ ] Define default values based on system defaults
- [ ] Add to therapy_sessions table if missing columns

#### Add Session Parameters Method
```python
def _get_session_parameters(self, session_id: str) -> dict[str, Any]:
    """Get session configuration parameters."""
    try:
        result = self.supabase.table('therapy_sessions').select(
            'rpe_pre_session, rpe_post_session, '
            'mvc_threshold_ch1, mvc_threshold_ch2, '
            'contraction_duration_threshold, '
            'target_duration_ch1_ms, target_duration_ch2_ms, '
            'session_duration_seconds, rest_duration_seconds'
        ).eq('id', session_id).limit(1).execute()
        
        if result.data:
            return result.data[0]
        return {}
    except Exception as e:
        logger.error(f"Failed to get session parameters: {e}")
        return {}
```

- [ ] Implement `_get_session_parameters()` method
- [ ] Verify all columns exist in database
- [ ] Handle null values appropriately

#### Add Data Completeness Method
```python
def _get_data_completeness(self, session_id: str) -> dict[str, Any]:
    """Assess data completeness for the session."""
    try:
        # Check what data types are available
        session = self.supabase.table('therapy_sessions').select(
            'has_emg_data, rpe_post_session, game_score'
        ).eq('id', session_id).limit(1).execute()
        
        if session.data:
            return {
                'has_emg_data': session.data[0].get('has_emg_data', False),
                'has_rpe': session.data[0].get('rpe_post_session') is not None,
                'has_game_data': session.data[0].get('game_score') is not None,
                'has_bfr_data': False,  # Add BFR check if applicable
                'rpe_source': 'c3d_metadata' if session.data[0].get('rpe_post_session') else None
            }
        return {}
    except Exception as e:
        logger.error(f"Failed to get data completeness: {e}")
        return {}
```

- [ ] Implement `_get_data_completeness()` method
- [ ] Add additional completeness checks as needed
- [ ] Test with various data scenarios

### 1.2 Enhance Main Export Method
**File:** `backend/services/data/export_service.py` (line ~68-100)

```python
def get_comprehensive_export_data(self, session_id: str) -> dict[str, Any]:
    """Get comprehensive export data including all missing fields.
    
    This is the Single Source of Truth for all export formats.
    """
    try:
        # Start with base export data
        export_data = self._get_base_export_data()
        
        # Add performance scores (existing)
        export_data['performance_scores'] = self._get_performance_scores(session_id)
        
        # Add scoring configuration (enhance existing)
        scoring_config = self._get_scoring_configuration(session_id)
        if scoring_config and 'rpe_mapping' in scoring_config:
            # Ensure RPE mapping is properly formatted
            scoring_config['rpe_mapping_formatted'] = self._format_rpe_mapping(
                scoring_config.get('rpe_mapping', {})
            )
        export_data['scoring_configuration'] = scoring_config
        
        # NEW: Add compliance breakdown
        export_data['compliance_breakdown'] = self._get_compliance_breakdown(session_id)
        
        # NEW: Add processing parameters
        export_data['processing_parameters'] = self._get_processing_parameters(session_id)
        
        # NEW: Add session parameters
        export_data['session_parameters'] = self._get_session_parameters(session_id)
        
        # NEW: Add data completeness
        export_data['data_completeness'] = self._get_data_completeness(session_id)
        
        # Add timestamp
        export_data['export_metadata'] = {
            'export_timestamp': datetime.now().isoformat(),
            'export_version': '2.0.0',
            'session_id': session_id
        }
        
        return export_data
        
    except Exception as e:
        logger.error(f"Failed to get comprehensive export data: {e}")
        # Return base export with error indication
        base = self._get_base_export_data()
        base['error'] = f"Failed to compile complete export: {str(e)}"
        return base
```

- [ ] Update `get_comprehensive_export_data()` method
- [ ] Add all new field methods
- [ ] Implement error recovery strategy
- [ ] Add export versioning

### 1.3 Add Helper Methods

```python
def _format_rpe_mapping(self, rpe_mapping: dict) -> dict:
    """Format RPE mapping for clear export display."""
    formatted = {
        'scale': 'Borg CR-10',
        'ranges': {
            'optimal': {'values': '4-6', 'score': 100, 'description': 'Optimal effort'},
            'acceptable': {'values': '3, 7', 'score': 80, 'description': 'Acceptable effort'},
            'suboptimal': {'values': '2, 8', 'score': 60, 'description': 'Suboptimal effort'},
            'poor': {'values': '0-1, 9-10', 'score': 20, 'description': 'Poor effort'}
        },
        'raw_mapping': rpe_mapping
    }
    return formatted
```

- [ ] Implement `_format_rpe_mapping()` helper
- [ ] Add other formatting helpers as needed
- [ ] Ensure backward compatibility

## Phase 2: Fix Backend Export Route

### 2.1 Enable CSV Converter Usage
**File:** `backend/api/routes/export.py` (line ~119-177)

```python
@router.get("/session/{session_id}")
async def export_session_data(
    session_id: str,
    format: Literal["json", "csv"] = Query("json", description="Export format: json or csv"),
):
    """Export existing session data with format selection.
    
    Single Source of Truth: Both formats use the same comprehensive data.
    """
    try:
        # Get Supabase client
        supabase = get_supabase_client()
        
        # Create export service (no mock processor needed for session export)
        export_service = EnhancedEMGDataExporter(None, supabase)
        
        # Get comprehensive export data (Single Source of Truth)
        export_data = export_service.get_comprehensive_export_data(session_id)
        
        if format == "csv":
            # Convert to CSV format using existing converter
            from services.data.converters.csv import convert_export_to_csv
            csv_content = convert_export_to_csv(export_data)
            
            # Return CSV with appropriate headers
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=session_{session_id}_export.csv"
                }
            )
        else:
            # Return JSON (default)
            return JSONResponse(content=export_data)
            
    except Exception as e:
        logger.error(f"Session export error: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error exporting session data: {e!s}")
```

- [ ] Update export route to use converter
- [ ] Remove mock processor code
- [ ] Test both JSON and CSV formats
- [ ] Add format validation

### 2.2 Add Upload Export Enhancement
**File:** `backend/api/routes/export.py` (line ~33-118)

```python
@router.post("/")
async def export_analysis_data(
    file: UploadFile = File(...),
    processing_opts: ProcessingOptions = Depends(get_processing_options),
    session_params: GameSessionParameters = Depends(get_session_parameters),
    file_metadata: dict = Depends(get_file_metadata),
    export_format: Literal["json", "csv"] = Form("json"),
    include_raw_signals: bool = Form(True),
    include_debug_info: bool = Form(True),
):
    """Export comprehensive C3D analysis data in selected format."""
    # ... existing file processing ...
    
    # Create comprehensive export
    comprehensive_export = {
        "analysis_results": result,
        "file_info": {
            "filename": file.filename,
            "processing_options": processing_opts.dict(),
            "session_parameters": session_params.dict(),
        },
        "processing_parameters": {
            # Add from processing_opts
            "sampling_rate_hz": 2000,
            "filter_low_cutoff_hz": processing_opts.filter_low_cutoff,
            "filter_high_cutoff_hz": processing_opts.filter_high_cutoff,
            # ... etc
        },
        "request_metadata": {
            "user_id": file_metadata["user_id"],
            "patient_id": file_metadata["patient_id"],
            "session_id": file_metadata["session_id"],
            "filename": file.filename,
            "export_timestamp": datetime.now().isoformat(),
        }
    }
    
    if export_format == "csv":
        from services.data.converters.csv import convert_export_to_csv
        csv_content = convert_export_to_csv(comprehensive_export)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={file.filename.replace('.c3d', '')}_export.csv"
            }
        )
    else:
        return JSONResponse(content=comprehensive_export)
```

- [ ] Add format parameter to upload export
- [ ] Implement CSV conversion path
- [ ] Test with uploaded files
- [ ] Ensure consistent data structure

## Phase 3: Update CSV Converter

### 3.1 Enhance CSV Converter for New Fields
**File:** `backend/services/data/converters/csv.py`

```python
def convert_export_to_csv(export_data: Dict[str, Any]) -> str:
    """Convert comprehensive export data to CSV format.
    
    Handles the enhanced data structure from get_comprehensive_export_data().
    """
    try:
        if not export_data or not isinstance(export_data, dict):
            return "export_timestamp,error\n,Invalid or missing export data\n"
            
        flattened = {}
        
        # Export metadata
        if 'export_metadata' in export_data:
            flattened['export_timestamp'] = export_data['export_metadata'].get('export_timestamp')
            flattened['export_version'] = export_data['export_metadata'].get('export_version')
            flattened['session_id'] = export_data['export_metadata'].get('session_id')
        
        # Performance scores (existing)
        performance = export_data.get('performance_scores', {})
        if performance and isinstance(performance, dict):
            for key, value in performance.items():
                if key not in ['note', 'error', 'id', 'created_at', 'updated_at']:
                    flattened[f'performance_{key}'] = value
        
        # Compliance breakdown (NEW)
        compliance = export_data.get('compliance_breakdown', {})
        if compliance:
            if 'left_muscle' in compliance:
                for key, value in compliance['left_muscle'].items():
                    flattened[f'left_muscle_{key}'] = value
            if 'right_muscle' in compliance:
                for key, value in compliance['right_muscle'].items():
                    flattened[f'right_muscle_{key}'] = value
        
        # Scoring configuration with weights (enhanced)
        config = export_data.get('scoring_configuration', {})
        if config and isinstance(config, dict):
            # Main weights
            for key in ['weight_compliance', 'weight_symmetry', 'weight_effort', 'weight_game']:
                if key in config:
                    flattened[f'config_{key}'] = config[key]
            
            # Sub-weights
            for key in ['weight_completion', 'weight_intensity', 'weight_duration']:
                if key in config:
                    flattened[f'config_sub_{key}'] = config[key]
            
            # RPE mapping
            if 'rpe_mapping_formatted' in config:
                rpe = config['rpe_mapping_formatted'].get('ranges', {})
                flattened['config_rpe_optimal_score'] = rpe.get('optimal', {}).get('score', 100)
                flattened['config_rpe_acceptable_score'] = rpe.get('acceptable', {}).get('score', 80)
                flattened['config_rpe_suboptimal_score'] = rpe.get('suboptimal', {}).get('score', 60)
                flattened['config_rpe_poor_score'] = rpe.get('poor', {}).get('score', 20)
        
        # Processing parameters (NEW)
        processing = export_data.get('processing_parameters', {})
        if processing:
            for key, value in processing.items():
                if key not in ['id', 'created_at', 'updated_at']:
                    flattened[f'processing_{key}'] = value
        
        # Session parameters (NEW)
        session = export_data.get('session_parameters', {})
        if session:
            for key, value in session.items():
                if key not in ['id', 'created_at', 'updated_at']:
                    flattened[f'session_{key}'] = value
        
        # Data completeness (NEW)
        completeness = export_data.get('data_completeness', {})
        if completeness:
            for key, value in completeness.items():
                flattened[f'data_{key}'] = value
        
        # EMG analytics summary (if present)
        if 'session_metadata' in export_data:
            analytics = export_data['session_metadata'].get('analytics', {})
            if analytics:
                flattened['emg_channels_count'] = len(analytics)
                for channel_name, channel_data in analytics.items():
                    if isinstance(channel_data, dict) and 'mvc_value' in channel_data:
                        flattened[f'emg_{channel_name.lower()}_mvc'] = channel_data['mvc_value']
        
        # Convert to CSV
        if flattened:
            df = pd.DataFrame([flattened])
            # Order columns logically
            column_order = [
                'export_timestamp', 'export_version', 'session_id',
                # Performance scores first
                *[c for c in df.columns if c.startswith('performance_')],
                # Compliance breakdown
                *[c for c in df.columns if c.startswith('left_muscle_') or c.startswith('right_muscle_')],
                # Configuration
                *[c for c in df.columns if c.startswith('config_')],
                # Processing
                *[c for c in df.columns if c.startswith('processing_')],
                # Session
                *[c for c in df.columns if c.startswith('session_')],
                # Data completeness
                *[c for c in df.columns if c.startswith('data_')],
                # EMG
                *[c for c in df.columns if c.startswith('emg_')],
                # Any remaining
                *[c for c in df.columns if c not in column_order]
            ]
            df = df[[c for c in column_order if c in df.columns]]
            return df.to_csv(index=False)
        else:
            return "export_timestamp,note\n,No data available for CSV export\n"
            
    except Exception as e:
        logger.error(f"Failed to convert export data to CSV: {e}")
        return f"export_timestamp,error\n,CSV conversion failed: {str(e)}\n"
```

- [ ] Update CSV converter for new data structure
- [ ] Implement logical column ordering
- [ ] Handle nested data appropriately
- [ ] Test with various data scenarios

## Phase 4: Frontend Simplification

### 4.1 Update Export Actions
**File:** `frontend/src/components/tabs/ExportTab/ExportActions.tsx`

```typescript
const handleDownloadExport = async () => {
  setDownloadStates(prev => ({ ...prev, export: 'downloading' }));
  try {
    if (sessionId) {
      // Use backend API for both formats (Single Source of Truth)
      const format = exportFormat;
      const response = await fetch(
        `/api/export/session/${sessionId}?format=${format}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${originalFilename.replace('.c3d', '')}_export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } else {
      // Fallback for client-side only (no session)
      if (exportFormat === 'csv') {
        // Simplified CSV generation for client-side only
        generateCsvFromExportData(exportData, originalFilename);
      } else {
        // Existing JSON download logic
        await onDownloadExport();
      }
    }
    setDownloadStates(prev => ({ ...prev, export: 'success' }));
  } catch (error) {
    console.error('Export download failed:', error);
    setDownloadStates(prev => ({ ...prev, export: 'error' }));
  }
};
```

- [ ] Update frontend to use backend API
- [ ] Keep client-side fallback for sessionless exports
- [ ] Update error handling
- [ ] Test both session and sessionless scenarios

### 4.2 Simplify CSV Generator
**File:** `frontend/src/components/tabs/ExportTab/csvGenerator.ts`

```typescript
/**
 * Simplified CSV Generator for Client-Side Only Export
 * 
 * This is now only used when no session ID is available.
 * For session-based exports, the backend API is used.
 */

export function generateCsvFromExportData(exportData: ExportData, originalFilename: string): void {
  // Keep existing implementation but add header noting it's for client-side only
  console.log('📊 Using client-side CSV generation (no session available)');
  
  // ... existing implementation ...
}

export function canGenerateCsv(exportData: ExportData | null): boolean {
  // Now primarily checks if we have a session ID
  return !!(exportData && (exportData.sessionId || exportData.analytics || exportData.metadata));
}
```

- [ ] Add comments explaining dual approach
- [ ] Keep client-side generation for sessionless
- [ ] Update capability checks
- [ ] Test fallback scenarios

## Phase 5: Testing & Validation

### 5.1 Backend Tests
**File:** `backend/tests/integration/test_export_enhancements.py`

```python
import pytest
import pandas as pd
from io import StringIO

class TestExportEnhancements:
    """Test enhanced export functionality."""
    
    def test_comprehensive_export_includes_all_fields(self, test_session_id):
        """Verify all new fields are included."""
        export_service = EnhancedEMGDataExporter(None, get_test_client())
        data = export_service.get_comprehensive_export_data(test_session_id)
        
        # Check all required sections exist
        assert 'performance_scores' in data
        assert 'scoring_configuration' in data
        assert 'compliance_breakdown' in data
        assert 'processing_parameters' in data
        assert 'session_parameters' in data
        assert 'data_completeness' in data
        assert 'export_metadata' in data
        
        # Verify compliance breakdown structure
        assert 'left_muscle' in data['compliance_breakdown']
        assert 'right_muscle' in data['compliance_breakdown']
        
        # Verify RPE mapping in scoring config
        if data['scoring_configuration']:
            assert 'rpe_mapping' in data['scoring_configuration']
    
    def test_csv_export_from_api(self, test_client, test_session_id):
        """Test CSV export through API endpoint."""
        response = test_client.get(f"/export/session/{test_session_id}?format=csv")
        assert response.status_code == 200
        assert response.headers['content-type'] == 'text/csv'
        
        # Verify CSV is valid and contains expected columns
        csv_content = response.content.decode('utf-8')
        df = pd.read_csv(StringIO(csv_content))
        
        # Check for new columns
        assert 'performance_overall_score' in df.columns
        assert 'left_muscle_overall_compliance' in df.columns
        assert 'config_weight_compliance' in df.columns
        assert 'processing_sampling_rate_hz' in df.columns
    
    def test_json_csv_parity(self, test_client, test_session_id):
        """Verify JSON and CSV contain same data."""
        # Get JSON
        json_response = test_client.get(f"/export/session/{test_session_id}?format=json")
        json_data = json_response.json()
        
        # Get CSV
        csv_response = test_client.get(f"/export/session/{test_session_id}?format=csv")
        csv_content = csv_response.content.decode('utf-8')
        df = pd.read_csv(StringIO(csv_content))
        
        # Verify key values match
        if 'performance_scores' in json_data and 'overall_score' in json_data['performance_scores']:
            assert df['performance_overall_score'].iloc[0] == json_data['performance_scores']['overall_score']
```

- [ ] Create new test file for enhancements
- [ ] Test all new methods
- [ ] Verify CSV/JSON parity
- [ ] Test error scenarios

### 5.2 Frontend Tests
**File:** `frontend/src/components/tabs/ExportTab/__tests__/export-enhancements.test.tsx`

```typescript
describe('Export API Enhancements', () => {
  it('should use backend API for session exports', async () => {
    const mockFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test csv'], { type: 'text/csv' }))
      })
    );
    global.fetch = mockFetch;
    
    // Trigger export with session ID
    // ... test implementation ...
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/export/session/'),
      expect.any(Object)
    );
  });
  
  it('should fallback to client-side for sessionless exports', () => {
    // Test client-side generation when no session
    // ... test implementation ...
  });
});
```

- [ ] Create frontend test file
- [ ] Test API integration
- [ ] Test fallback behavior
- [ ] Verify UI updates

## Phase 6: Deployment & Rollback

### 6.1 Feature Flag Implementation
```python
# backend/config.py
USE_ENHANCED_EXPORT = os.getenv('USE_ENHANCED_EXPORT', 'false').lower() == 'true'

# In export_service.py
def get_comprehensive_export_data(self, session_id: str) -> dict:
    if not config.USE_ENHANCED_EXPORT:
        # Return minimal data (existing behavior)
        return {
            'performance_scores': self._get_performance_scores(session_id),
            'scoring_configuration': self._get_scoring_configuration(session_id)
        }
    
    # Enhanced export with all fields
    # ... new implementation ...
```

- [ ] Add feature flag to configuration
- [ ] Implement flag checks in code
- [ ] Test with flag on/off
- [ ] Document flag usage

### 6.2 Deployment Steps
1. [ ] Deploy backend with flag OFF
2. [ ] Run integration tests
3. [ ] Enable flag for test environment
4. [ ] Validate with sample exports
5. [ ] Deploy frontend changes
6. [ ] Enable flag in production
7. [ ] Monitor for errors

### 6.3 Rollback Plan
```bash
# If issues arise:
1. Set USE_ENHANCED_EXPORT=false
2. Frontend automatically falls back to client-side CSV
3. No data loss, existing exports continue working
4. Debug issues with enhanced export offline
```

- [ ] Document rollback procedure
- [ ] Test rollback scenario
- [ ] Ensure no data loss
- [ ] Communicate plan to team

## Post-Implementation Checklist

### Validation
- [ ] All backend tests pass
- [ ] All frontend tests pass
- [ ] CSV exports are pandas-compatible
- [ ] JSON exports contain all fields
- [ ] Performance is acceptable (<2s for export)
- [ ] No errors in logs

### Documentation
- [ ] Update API documentation
- [ ] Document new export fields
- [ ] Update CSV format specification
- [ ] Add example exports

### Cleanup
- [ ] Remove redundant code
- [ ] Update comments
- [ ] Clean up debug logging
- [ ] Archive old export logic

## Success Metrics
- ✅ Single Source of Truth achieved
- ✅ CSV includes all metadata fields
- ✅ JSON and CSV data parity
- ✅ Backend controls all export logic
- ✅ Frontend simplified
- ✅ Tests provide confidence
- ✅ Rollback strategy ready

## Notes
- Keep frontend CSV generation as fallback initially
- Monitor performance with large datasets
- Consider caching for frequently exported sessions
- Plan for future format additions (Excel, PDF)