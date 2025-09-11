 📋 PLAN_EXPORT_CSV_MVP.md - Complete Implementation Plan

    🎯 MVP Export Enhancement: Performance Data + CSV Format

    Problem: Researchers need complete performance scores + CSV format for data analysisSolution: Extend existing export system with missing data + CSV format (KISS, DRY, 
    YAGNI)Timeline: 3 days implementation + critical testingArchitecture: Follow backend CLAUDE.md best practices (Repository pattern, RLS, synchronous Supabase)

    ---
    📊 Current State Analysis

    ✅ What Works (Keep These)

    - EMG signals export via ExportTab/hooks.tsx ✅
    - Session metadata and basic analytics ✅  
    - Channel selection and downsampling controls ✅
    - JSON download functionality ✅
    - Existing UI components (ExportOptionsPanel, ExportActions) ✅

    ❌ Critical Gaps (Fix These)

    - Performance scores missing (17+ fields from performance_scores table)
    - Scoring configuration missing (weights, RPE mapping for reproducibility)
    - CSV format unavailable (researchers forced to manually convert JSON)

    ---
    🛠️ Implementation Plan

    Day 1: Backend Data Enhancement

    Task 1.1: Extend Export Service (2 hours)

    - Create or extend services/data/export_service.py
    - Add dependency injection for PerformanceService (following CLAUDE.md #5)
    - Implement get_comprehensive_export_data() method
    - Keep existing export data structure (DRY principle)

    # services/data/export_service.py
    class EnhancedExportService:
        def __init__(self, supabase: Client, performance_service: PerformanceService):
            self.supabase = supabase  # Synchronous client (CLAUDE.md #14)
            self.performance_service = performance_service
        
        def get_comprehensive_export_data(self, session_id: UUID) -> dict:
            # Keep existing export (DRY)
            base_data = get_current_export_data(session_id)
            
            # Add missing performance data 
            performance_scores = self.performance_service.get_session_scores(session_id)
            scoring_config = self.performance_service.get_scoring_configuration(session_id)
            
            base_data.update({
                'performance_scores': performance_scores,
                'scoring_configuration': scoring_config
            })
            return base_data

    Task 1.2: Database Integration (2 hours)

    - Add queries for performance_scores table (17+ therapeutic metrics)
    - Add queries for scoring_configuration table (weights, RPE mapping)
    - Leverage existing RLS policies (no new security logic needed)
    - Use Repository pattern for data access (CLAUDE.md #3)

    Task 1.3: Critical Test - Data Completeness (2 hours)

    - Create tests/integration/test_enhanced_export.py
    - Test performance scores included in export
    - Test scoring configuration included in export  
    - Verify no regression in existing data
    - Use MagicMock for Supabase (synchronous, CLAUDE.md #16)

    def test_export_includes_critical_performance_data():
        """Critical test: Ensure export has performance scores for researchers"""
        mock_supabase = MagicMock()  # NOT AsyncMock
        mock_supabase.table().select().execute.return_value.data = [{
            'overall_score': 85.0, 'compliance_score': 90.0
        }]
        
        result = export_service.get_comprehensive_export_data(test_session_id)
        assert 'performance_scores' in result
        assert result['performance_scores']['overall_score'] == 85.0

    Task 1.4: Day 1 Validation (1 hour)

    - Run enhanced export test: python -m pytest tests/integration/test_enhanced_export.py -v
    - Verify export includes performance scores
    - Confirm no regression in existing functionality

    ---
    Day 2: CSV Export Implementation

    Task 2.1: CSV Conversion Utility (2 hours)

    - Create utils/csv_converter.py (simple utility, no complex service)
    - Implement convert_export_to_csv() function
    - Flatten nested JSON to single CSV row (research-ready format)
    - Handle performance scores, scoring config, session metadata

    # utils/csv_converter.py
    def convert_export_to_csv(export_data: dict) -> str:
        """Flatten nested JSON to single CSV row - research-ready format"""
        flattened = {}
        
        # Session metadata as columns
        flattened.update(export_data.get('session_metadata', {}))
        
        # Performance scores as columns
        performance = export_data.get('performance_scores', {})
        for key, value in performance.items():
            flattened[f'performance_{key}'] = value
        
        # Scoring config as columns  
        config = export_data.get('scoring_configuration', {})
        flattened.update({f'config_{k}': v for k, v in config.items()})
        
        return pandas.DataFrame([flattened]).to_csv(index=False)

    Task 2.2: API Enhancement (2 hours)

    - Modify existing export endpoint in api/routes/export.py
    - Add format query parameter (json | csv)
    - Keep thin controller pattern (CLAUDE.md #2)
    - Return appropriate content-type for CSV

    @router.get("/export/{session_id}")
    async def export_session_data(
        session_id: UUID,
        format: str = Query("json", enum=["json", "csv"]),
        export_service: ExportService = Depends(get_export_service)
    ):
        data = export_service.get_comprehensive_export_data(session_id)
        
        if format == "csv":
            csv_content = convert_export_to_csv(data)
            return Response(content=csv_content, media_type="text/csv")
        
        return data  # JSON (existing)

    Task 2.3: Critical Test - CSV Format (2 hours)

    - Create tests/integration/test_csv_export.py
    - Test CSV conversion produces valid format
    - Critical: Test pandas import works without preprocessing
    - Test research-friendly column names

    def test_csv_export_research_ready():
        """Critical test: CSV format works for pandas import"""
        csv_content = convert_export_to_csv(test_export_data)
        
        # Assert research usability
        assert 'performance_overall_score' in csv_content
        
        # Critical: Verify pandas import works
        import pandas as pd
        df = pd.read_csv(StringIO(csv_content))
        assert df['performance_overall_score'].iloc[0] == 85.0

    Task 2.4: API Integration Test (1 hour)

    - Create tests/api/test_export_api.py
    - Test API format parameter works for both JSON and CSV
    - Test appropriate content-types returned
    - Test end-to-end API workflow

    Task 2.5: Day 2 Validation (1 hour)

    - Run CSV tests: python -m pytest tests/integration/test_csv_export.py -v
    - Run API tests: python -m pytest tests/api/test_export_api.py -v
    - Manual test: CSV download from API works

    ---
    Day 3: Frontend Integration

    Task 3.1: Format Selection UI (3 hours)

    - Extend components/tabs/ExportTab/ExportOptionsPanel.tsx
    - Add format selection radio group (JSON/CSV)
    - Keep existing options (channel selection, downsampling)
    - Maintain clean UI layout

    // Add to ExportOptionsPanel
    <div className="space-y-2">
      <Label>Export Format</Label>
      <Select value={exportFormat} onValueChange={setExportFormat}>
        <SelectItem value="json">JSON (Complete)</SelectItem>
        <SelectItem value="csv">CSV (Analysis-Ready)</SelectItem>
      </Select>
    </div>

    Task 3.2: Download Logic Update (2 hours)

    - Modify components/tabs/ExportTab/ExportActions.tsx
    - Update download function to include format parameter
    - Handle CSV filename generation
    - Maintain existing download patterns

    const downloadExport = useCallback(async () => {
      const format = exportFormat === 'csv' ? 'csv' : 'json';
      const response = await fetch(`/api/export/${sessionId}?format=${format}`);
      
      const filename = format === 'csv' 
        ? `${originalFilename.replace('.c3d', '')}_export.csv`
        : `${originalFilename.replace('.c3d', '')}_export.json`;
    }, [exportFormat, sessionId]);

    Task 3.3: Frontend Testing (2 hours)

    - Test format selection UI component
    - Test download functionality for both formats
    - Test filename generation
    - Ensure no regression in existing UI

    Task 3.4: End-to-End Validation (1 hour)

    - Manual test: Complete export workflow (select format → download)
    - Test CSV file opens in Excel
    - Test CSV imports into pandas
    - Verify all performance metrics present

    ---
    ✅ Critical Success Criteria

    Functional Requirements

    - Export includes all performance scores from performance_scores table
    - Export includes scoring configuration for reproducibility  
    - CSV format available via API and UI
    - CSV imports directly into Python pandas without preprocessing
    - No regression in existing JSON export functionality

    Technical Quality (Following CLAUDE.md)

    - Uses synchronous Supabase client (no AsyncMock in tests)
    - Repository pattern for data access
    - Thin API controllers, business logic in services
    - RLS policies leveraged for security
    - Clean, minimal test coverage

    Research Usability

    - Researcher can select CSV format in UI
    - CSV download works with proper filename
    - CSV opens in Excel without issues
    - All therapeutic metrics available as columns
    - Performance data ready for statistical analysis

    ---
    🧪 Testing Checklist

    Critical Tests (Must Pass)

    - Test 1: test_export_includes_critical_performance_data() ✅
    - Test 2: test_csv_export_research_ready() ✅  
    - Test 3: test_export_api_format_selection() ✅

    Regression Tests

    - Existing JSON export still works ✅
    - ExportTab UI components function normally ✅
    - Channel selection and downsampling preserved ✅

    Test Execution Commands

    # Critical MVP tests
    python -m pytest tests/integration/test_enhanced_export.py -v
    python -m pytest tests/integration/test_csv_export.py -v
    python -m pytest tests/api/test_export_api.py -v

    # Full regression suite  
    python -m pytest tests/ -v --tb=short

    ---
    📈 Definition of Done

    Backend Complete

    - Export service returns performance scores + scoring config
    - CSV conversion utility works for nested JSON
    - API endpoint supports format parameter
    - All backend tests pass

    Frontend Complete

    - Format selection UI integrated into ExportTab
    - Download logic handles both JSON and CSV
    - UI tests pass, no regression in existing components

    Integration Complete

    - End-to-end export workflow works (UI → API → download)
    - CSV file imports successfully into pandas
    - All performance metrics available to researchers
    - Export includes reproducibility information

    Quality Gates

    - All critical tests pass ✅
    - No regressions in existing functionality ✅
    - Code follows SOLID, KISS, DRY principles ✅
    - Backend patterns follow CLAUDE.md guidelines ✅

    ---
    Total Estimated Effort: 3 days implementation + testingFiles Changed: ~6 files (2 backend, 2 frontend, 2 test files)Code Added: ~200 lines total (minimal, focused 
    changes)Value Delivered: Complete performance data + CSV format for researchers
