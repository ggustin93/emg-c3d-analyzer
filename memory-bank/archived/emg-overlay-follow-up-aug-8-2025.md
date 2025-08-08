# EMG Overlay System Follow-up Tasks
*Created: August 8, 2025*
*Status: Testing Required*

## Background
Fixed critical channel naming mismatch in backend `processor.py` that prevented Raw + RMS (Backend) overlay functionality. The frontend overlay implementation was already correct - it just needed both raw and processed signals to be available.

## Implementation Completed ✅
- **Backend Fix**: Modified `extract_emg_data()` to create both original C3D channel names AND "Raw" variants
- **File Modified**: `backend/processor.py` lines 167-184
- **Backward Compatibility**: Maintains existing channel naming while adding required variants
- **Debug Logging**: Added logging to confirm dual channel creation

## Testing Required
### Priority 1: Functional Verification
- [ ] Start backend server and upload a C3D file
- [ ] Select "Raw + RMS (Backend)" from signal type dropdown
- [ ] Verify overlay displays with:
  - Raw EMG signals (semi-transparent) on left Y-axis
  - RMS envelope signals (bold) on right Y-axis
  - Different axis scales for Raw vs RMS
- [ ] Check debug console output shows:
  - `rawKeys: ["CH1 Raw", "CH2 Raw"]` (not empty array)
  - `hasValidOverlayData: true`

### Priority 2: Edge Case Testing
- [ ] Test with different C3D files to ensure compatibility
- [ ] Verify other signal types still work correctly:
  - "Raw (C3D)"
  - "Activated (C3D)" 
  - "RMS (Backend)"
- [ ] Confirm backward compatibility with existing data processing

### Priority 3: Performance Validation
- [ ] Verify no performance regression from dual channel storage
- [ ] Check memory usage with larger C3D files
- [ ] Confirm frontend caching still works properly

## Expected Results
**Before Fix:**
```
availableDataKeys: ["CH1 Processed", "CH2 Processed"]
rawKeys: Array(0)                    // ❌ Empty
rmsKeys: ["CH1 Processed", "CH2 Processed"]
hasValidOverlayData: false           // ❌ Cannot overlay
```

**After Fix:**
```
availableDataKeys: ["CH1", "CH1 Raw", "CH1 Processed", "CH2", "CH2 Raw", "CH2 Processed"]
rawKeys: ["CH1 Raw", "CH2 Raw"]     // ✅ Populated
rmsKeys: ["CH1 Processed", "CH2 Processed"]
hasValidOverlayData: true            // ✅ Overlay possible
```

## Rollback Plan
If issues arise:
1. Revert `processor.py` lines 167-184 to original single channel creation
2. Alternative: Add feature flag to control dual channel creation
3. Frontend overlay logic requires no changes (already correct)

## Context Links
- **Original Issue**: User reported "Raw + RMS is actually the same as 'Activated (C3D)'"
- **Root Cause**: Channel naming mismatch between extraction and analysis pipeline
- **Frontend Code**: EMGChart.tsx overlay implementation already correct
- **Debug Session**: Full troubleshooting documented in session conversation

## Next Steps After Testing
1. If tests pass: Close task and update progress documentation
2. If tests fail: Investigate specific failure modes and implement fixes
3. Consider adding integration tests to prevent regression
4. Update user documentation if overlay behavior changes significantly