# Contraction Highlighting Validation Task

## Priority: HIGH 🔴
**Date Created**: January 8, 2025
**Status**: Active Development Priority
**Assigned to**: Tomorrow's work session

## Problem Statement

The user has identified that the "highlight" of good/bad contractions in the EMG charts needs verification and potential correction. With the recent threshold display synchronization fixes, we need to ensure that:

1. Contraction highlighting (good/bad visual indicators) matches the actual backend calculations
2. The visual representations accurately reflect the updated threshold values (250ms duration, actual MVC values)
3. Contraction quality assessment is consistent between backend logic and frontend display

## Technical Context

### Recent Changes Impact
- **MVC Thresholds**: Now displaying actual calculated values (e.g., 1.125e-4V instead of 1.500e-4V)
- **Duration Thresholds**: Updated from 2000ms to 250ms default across system
- **Backend Parameters**: Added `contraction_duration_threshold` to API endpoints
- **Session Parameters**: Now properly synchronized between backend and frontend

### Key Components to Investigate
1. **EMGChart.tsx**: Lines ~238-244 contraction quality calculation
2. **Backend processor.py**: Lines ~240-242 `meets_mvc` and `meets_duration` logic  
3. **Contraction highlighting**: Visual indicators (colors, dots, areas) on charts
4. **Performance metrics**: Quality score calculations in performance cards

## Investigation Tasks

### 1. Backend Logic Verification
- [ ] Verify `meets_mvc` calculation uses correct threshold values
- [ ] Verify `meets_duration` calculation uses correct threshold values  
- [ ] Check `is_good` contraction flagging logic
- [ ] Validate contraction quality flags in backend logs

### 2. Frontend Display Verification  
- [ ] Check EMGChart contraction highlighting matches backend flags
- [ ] Verify good/poor contraction visual indicators (dots, areas, colors)
- [ ] Validate performance card quality scores match backend calculations
- [ ] Test contraction tooltips show correct threshold comparisons

### 3. End-to-End Testing
- [ ] Upload test file and verify highlighting accuracy
- [ ] Check backend logs for `meets_mvc` and `meets_duration` values
- [ ] Cross-reference frontend display with backend calculations
- [ ] Validate performance metrics consistency

## Expected Outcome

After completion, the system should have:
- ✅ Accurate contraction highlighting that matches backend quality assessment
- ✅ Consistent good/bad contraction indicators across all chart views
- ✅ Performance metrics that reflect actual contraction quality
- ✅ Visual feedback that helps therapists identify quality contractions

## Files to Examine

### Backend
- `backend/processor.py` - Contraction quality calculation logic
- `backend/emg_analysis.py` - MVC and duration threshold functions
- Backend logs - Contraction debug output

### Frontend  
- `frontend/src/components/tabs/SignalPlotsTab/EMGChart.tsx` - Chart highlighting
- `frontend/src/hooks/usePerformanceMetrics.ts` - Performance calculations
- `frontend/src/components/tabs/shared/performance-card.tsx` - Quality display

## Success Criteria

1. **Visual Accuracy**: Chart highlighting perfectly matches backend quality flags
2. **Threshold Consistency**: All quality assessments use updated 250ms duration and actual MVC values
3. **Performance Alignment**: Performance cards show metrics consistent with visual highlighting
4. **User Confidence**: Therapists can trust the visual indicators for clinical assessment

## Priority Justification

This is a HIGH priority task because:
- Clinical accuracy depends on correct quality assessment
- Visual indicators guide therapist decision-making  
- Recent threshold changes may have affected highlighting logic
- User explicitly identified this as a concern requiring attention