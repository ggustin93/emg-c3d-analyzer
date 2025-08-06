# Task: Fix Export UI and Metadata Issues

## Problem Statement
1. **JSON preview container doesn't take full height** - UI layout issue
2. **Metadata and Debug toggles are confusing** - Should always include essential information
3. **Duplicate/inconsistent filename** - Shows "unknown.c3d" in metadata but correct filename in debug
4. **Missing C3D parameters** - All C3D file parameters should be visible

## Current Issues
- JSON preview area has limited height instead of using full available space
- Metadata toggle hides essential information that should always be visible
- Debug information toggle hides useful data that researchers need
- Filename is inconsistent between metadata and debug sections
- C3D file parameters from the source file are not exposed

## Implementation Plan

### Phase 1: Fix JSON Preview Container Height ✅
- [x] Update ExportTab.tsx layout to use full height
- [x] Ensure proper flex layout for the JSON preview area
- [x] Remove height restrictions on the preview container

### Phase 2: Restructure Export Data Organization ✅
- [x] Always include metadata (remove toggle)
- [x] Always include file information (from debug)
- [x] Merge debug info into a more logical structure
- [x] Fix filename consistency issue
- [x] Add C3D parameters section

### Phase 3: Expose C3D File Parameters ✅
- [x] Check what C3D parameters are available from backend
- [x] Add a new section for C3D file metadata
- [x] Include placeholder with backend enhancement note

### Phase 4: Simplify Export Options ✅
- [x] Remove unnecessary toggles (Metadata, Debug)
- [x] Keep only meaningful options (Signals, Analytics, Performance)
- [x] Reorganize the export structure for clarity

## Expected Outcomes
1. JSON preview uses full available height ✅
2. Essential metadata always included ✅
3. Consistent filename throughout export ✅
4. All C3D parameters visible (placeholder added) ✅
5. Cleaner, more intuitive export options ✅

## Files Modified
- `frontend/src/components/sessions/ExportTab.tsx`

## ✅ IMPLEMENTATION COMPLETED - January 6, 2025

## Implementation Summary

### Changes Made:
1. **Fixed JSON Preview Height**:
   - Updated ScrollArea to use `h-full` and proper flex layout
   - Changed Textarea to use `minHeight: '100%'` instead of fixed 600px
   - JSON preview now uses full available container height

2. **Removed Confusing Toggles**:
   - Removed "Metadata" toggle - metadata is now always included
   - Removed "Debug Information" toggle - file info is now always included
   - Simplified export options to only meaningful choices

3. **Fixed Filename Consistency**:
   - Both metadata and fileInfo sections now use the same detected filename
   - Filename detection logic: uploadedFileName → analysisResult.source_filename → 'unknown.c3d'
   - No more inconsistency between "unknown.c3d" and actual filename

4. **Restructured Export Data**:
   - Moved debug info into structured `fileInfo` and `exportInfo` sections
   - Always include essential information without toggles
   - Better organization of export data

5. **Added C3D Parameters Section**:
   - Added placeholder `c3dParameters` section with backend enhancement note
   - Included available information (sampling rate, channel labels)
   - Notes point to existing backend capability in `export_utils.py`

### UI Improvements ✅:
- **JSON preview height fixed** - Now uses proper flex layout with min-height constraints  
- **Fixed layout structure** - Parent container uses proper flex with min-h-0 for content overflow
- **Improved container styling** - ScrollArea and Textarea now have proper height management
- Cleaner export options with only relevant toggles
- Updated export information text to reflect changes  
- Better visual use of screen space

### Latest Fix (January 6, 2025) ✅:
- **JSON Preview Container Height**: Fixed the "too short" container issue by:
  - Added `flex-1 min-h-0` to parent div for proper flex layout
  - Set `flex-shrink-0` on CardHeader to prevent compression
  - Used `min-h-[500px]` on both container and Textarea for minimum usable height
  - Proper ScrollArea integration with full height and width
  - Loading state now has minimum height to prevent layout shift

### Backend Enhancement Opportunity:
The backend already has C3D parameter extraction in `backend/export_utils.py` but it's not currently exposed through the main API. This could be added in a future enhancement.

## Estimated Time: 1-2 hours ✅ COMPLETED