# Manual Testing Guide: Webhook System

## 🎯 Quick Testing Checklist

### Pre-Testing Setup
- [ ] Backend server running on port 8080 (use `./start_dev.sh`)
- [ ] Environment variables loaded (check `.env` file)
- [ ] Supabase connection established
- [ ] RLS policies applied for researcher authentication
- [ ] Test C3D files available

### Core Tests
- [ ] Valid C3D file upload webhook
- [ ] Invalid signature rejection  
- [ ] Non-C3D file ignored
- [ ] Wrong bucket rejection
- [ ] Processing status check
- [ ] Data format compatibility

## 🚀 Step-by-Step Manual Tests

### Test 1: Valid C3D Upload Processing

**Simulate webhook payload:**
```bash
curl -X POST http://localhost:8080/webhooks/storage/c3d-upload \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "ObjectCreated:Post",
    "bucket": "c3d-examples", 
    "objectName": "P005/session1/test_file.c3d",
    "objectSize": 1024000,
    "contentType": "application/octet-stream",
    "timestamp": "2025-08-11T10:30:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "C3D file processing initiated", 
  "processing_id": "uuid-string"
}
```

**✅ Pass Criteria:**
- Status code: 200
- Processing ID returned
- Background task initiated

### Test 2: Signature Verification (Security)

**Test with webhook secret configured:**
```bash
# First, ensure WEBHOOK_SECRET is set in backend/.env
echo "WEBHOOK_SECRET=test_secret_key" >> backend/.env

# Test without signature (should fail)
curl -X POST http://localhost:8080/webhooks/storage/c3d-upload \
  -H "Content-Type: application/json" \
  -d '{"eventType": "ObjectCreated:Post", "bucket": "c3d-examples", "objectName": "test.c3d", "objectSize": 1000}'
```

**Expected Response:**
```json
{
  "detail": "Invalid webhook signature"
}
```

**✅ Pass Criteria:**
- Status code: 401
- Signature validation working
- Security protection active

### Test 3: File Type Validation

**Test non-C3D file:**
```bash
curl -X POST http://localhost:8080/webhooks/storage/c3d-upload \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "ObjectCreated:Post",
    "bucket": "c3d-examples",
    "objectName": "document.pdf",
    "objectSize": 500000,
    "contentType": "application/pdf",
    "timestamp": "2025-08-11T10:30:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Ignoring non-C3D file: document.pdf"
}
```

**✅ Pass Criteria:**
- Status code: 200
- Non-C3D files ignored gracefully
- No processing initiated

### Test 4: Wrong Bucket Rejection

**Test invalid bucket:**
```bash
curl -X POST http://localhost:8080/webhooks/storage/c3d-upload \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "ObjectCreated:Post",
    "bucket": "wrong-bucket",
    "objectName": "test.c3d",
    "objectSize": 1000000,
    "contentType": "application/octet-stream",
    "timestamp": "2025-08-11T10:30:00Z"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "Invalid bucket: wrong-bucket"
}
```

**✅ Pass Criteria:**
- Status code: 200
- Invalid bucket rejected
- Error message clear

### Test 5: Processing Status Check

**Using processing ID from Test 1:**
```bash
# Replace {processing_id} with actual UUID from Test 1
curl -X GET "http://localhost:8080/webhooks/storage/status/{processing_id}"
```

**Expected Response (if completed):**
```json
{
  "processing_id": "uuid-string",
  "status": "completed",
  "file_path": "P005/session1/test_file.c3d",
  "created_at": "2025-08-11T10:30:00Z",
  "processed_at": "2025-08-11T10:35:00Z",
  "analysis_results": {
    // Complete analytics data
  }
}
```

**✅ Pass Criteria:**
- Status code: 200 (if found) or 404 (if not found)
- Processing status tracked correctly
- Analysis results returned when completed

### Test 6: Invalid UUID Format

**Test status endpoint with invalid UUID:**
```bash
curl -X GET "http://localhost:8080/webhooks/storage/status/invalid-uuid-format"
```

**Expected Response:**
```json
{
  "detail": "Invalid processing ID format"
}
```

**✅ Pass Criteria:**
- Status code: 400
- UUID validation working
- Clear error message

## 🔍 Database Verification

### Check Metadata Storage
```sql
-- Connect to Supabase database and run:
SELECT id, file_path, processing_status, created_at 
FROM c3d_metadata 
ORDER BY created_at DESC 
LIMIT 5;
```

**✅ Verify:**
- File metadata properly stored
- Processing status updated correctly
- Timestamps populated

### Check Analysis Results
```sql
-- Verify cached analysis data
SELECT id, file_hash, processing_version, created_at
FROM analysis_results 
WHERE c3d_metadata_id = 'uuid-from-metadata-check'
LIMIT 1;
```

**✅ Verify:**
- Analysis results cached
- Data format matches API response
- Processing parameters stored

## 🎛️ Integration Testing

### Test with Real C3D File
1. **Upload actual C3D file to Supabase Storage**
2. **Trigger webhook manually or via storage event**
3. **Verify complete processing pipeline**
4. **Check data compatibility with frontend Export Tab**

### Frontend Compatibility Test
1. **Access cached results via webhook status endpoint**
2. **Compare format with `/upload` endpoint response**
3. **Verify Export Tab can process webhook-generated data**
4. **Test signal visualization and analytics**

## 🚨 Common Issues & Solutions

### Issue: "Object not found" Error
**Solution**: Test files may not exist in Supabase Storage. Mock successful responses expected for non-existent test files.

### Issue: Environment Variables Not Loaded
**Solution**: Restart backend server after updating `.env` file.

### Issue: Database Connection Error
**Solution**: Verify Supabase credentials and network connectivity.

### Issue: Webhook Secret Mismatch
**Solution**: Ensure `WEBHOOK_SECRET` matches between environment and test signatures.

## 📊 Expected Test Results Summary

| Test Case | Expected Status | Expected Response |
|-----------|----------------|-------------------|
| Valid C3D Upload | 200 | Processing initiated |
| Invalid Signature | 401 | Signature error |
| Non-C3D File | 200 | Ignored gracefully |
| Wrong Bucket | 200 | Rejected with reason |
| Status Check | 200/404 | Status returned |
| Invalid UUID | 400 | Format error |

## ✅ Completion Criteria

**All manual tests pass when:**
- [ ] Security validation working (signatures)
- [ ] File type filtering working
- [ ] Database integration working
- [ ] Status tracking functional
- [ ] Error handling graceful
- [ ] Data format compatible with frontend

**System is production-ready when all tests pass and database contains expected data in the correct format.**