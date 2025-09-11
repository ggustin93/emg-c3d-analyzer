# Test Analysis Workflow from Session History

## Test Scenario
Testing the new analysis workflow where clicking "Analyze" from the PatientSessionBrowser triggers the backend /upload endpoint.

## Components Modified
1. **PatientSessionBrowser.tsx**
   - Added async `handleFileSelect` function
   - Downloads file from Supabase storage
   - Sends file to backend `/upload` endpoint
   - Navigates to analysis view with results

2. **PatientProfile.tsx**
   - Removed onFileSelect prop to let PatientSessionBrowser handle analysis internally

## Test Steps
1. Navigate to Therapist Dashboard
2. Select a patient from PatientManagement
3. Go to "Session History" tab
4. Click "Analyze" button on any C3D file
5. Verify:
   - File downloads from Supabase
   - Request sent to backend /upload
   - Navigation to /analysis page with results

## Expected Behavior
- When clicking "Analyze" on a C3D file:
  1. File is downloaded from Supabase storage
  2. File is sent to backend API at http://localhost:8080/upload
  3. Analysis results are received
  4. User is navigated to /analysis page with results
  5. Results are stored in sessionStorage for persistence

## Error Handling
- If download fails: Shows alert and fallback navigation
- If backend processing fails: Shows error alert and fallback navigation
- Fallback: Navigate to `/analysis?file={filename}` 

## API Integration
- **Endpoint**: `POST /upload`
- **FormData fields**:
  - `file`: The C3D file blob
  - `file_source`: "supabase_storage"
  - `patient_id`: Patient code
  - `upload_date`: File upload timestamp

## Console Logs to Monitor
```javascript
// Success flow
logger.info("🚀 Starting analysis for file: {filename}")
logger.info("✅ Downloaded file: {filename}, size: {size} bytes")
logger.info("📡 Sending file to backend for processing")
logger.info("✅ Analysis completed")

// Error flow
logger.error("❌ Analysis failed")
```

## Backend Requirements
- Backend server must be running on http://localhost:8080
- `/upload` endpoint must be accessible
- Supabase storage must be configured with C3D files

## Notes
- Analysis results are stored in sessionStorage for the analysis page
- Patient code is passed along with the analysis request
- The component handles both async operations and error states gracefully