# Webhook System Documentation

## Overview

The EMG C3D Analyzer webhook system provides **automated C3D file processing** when files are uploaded to Supabase Storage. This enables real-time analysis without manual upload through the web interface.

## 🏗️ Architecture

### Components
- **Webhook Endpoint**: `/webhooks/storage/c3d-upload`
- **Status Endpoint**: `/webhooks/storage/status/{processing_id}`
- **Background Processing**: Async C3D analysis
- **Database Integration**: Metadata and result caching
- **Security**: HMAC-SHA256 signature verification

### Data Flow
```
Supabase Storage → Webhook → Background Processing → Database Cache
                                      ↓
Frontend Export Tab ← API Response ← Cached Results
```

## 🔒 Security

### HMAC Signature Verification
- **Algorithm**: HMAC-SHA256
- **Header**: `X-Webhook-Signature`
- **Timing Attack Protection**: Uses `hmac.compare_digest()`
- **Configuration**: Set `WEBHOOK_SECRET` in environment variables

### File Validation
- **Bucket Restriction**: Only `c3d-examples` bucket accepted
- **File Type**: Only `.c3d` files processed
- **Size Limits**: Maximum 50MB per file
- **Deduplication**: SHA-256 hash prevents duplicate processing

## 📊 Database Schema

### `c3d_metadata` Table
Stores comprehensive file metadata and processing status:

```sql
CREATE TABLE c3d_metadata (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path text UNIQUE NOT NULL,
    file_hash text NOT NULL,
    file_size_bytes bigint NOT NULL,
    
    -- Patient/Session Resolution
    patient_id text,
    session_id text,
    resolved_patient_id text,
    resolved_therapist_id text,
    
    -- C3D Technical Metadata
    channel_names jsonb,
    channel_count integer,
    sampling_rate float8,
    duration_seconds float8,
    frame_count integer,
    
    -- Processing Status
    processing_status text DEFAULT 'pending' 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_version text,
    error_message text,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    processed_at timestamptz
);
```

### `analysis_results` Table
Caches processed analysis data in **exact `/upload` API response format**:

```sql
CREATE TABLE analysis_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    c3d_metadata_id uuid NOT NULL REFERENCES c3d_metadata(id),
    file_hash text NOT NULL,
    processing_version text NOT NULL,
    
    -- Complete Analysis Data (matches /upload response exactly)
    analytics_data jsonb NOT NULL,          -- Full ChannelAnalytics data
    emg_signals jsonb,                      -- Raw/processed signal data
    compliance_scores jsonb,                -- Performance analysis
    temporal_stats jsonb,                   -- Statistical analysis
    
    -- Processing Metadata
    processing_params jsonb,                -- Parameters used for analysis
    processing_time_ms integer,
    
    -- Cache Management
    cache_hits integer DEFAULT 0,
    last_accessed_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '30 days'),
    created_at timestamptz DEFAULT now()
);
```

## 🔄 API Endpoints

### Webhook Processing Endpoint
```http
POST /webhooks/storage/c3d-upload
Content-Type: application/json
X-Webhook-Signature: <hmac-sha256-signature>

{
  "eventType": "ObjectCreated:Post",
  "bucket": "c3d-examples",
  "objectName": "P005/session1/test_file.c3d",
  "objectSize": 1024000,
  "contentType": "application/octet-stream",
  "timestamp": "2025-08-11T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "C3D file processing initiated",
  "processing_id": "12345678-1234-1234-1234-123456789abc"
}
```

### Status Check Endpoint
```http
GET /webhooks/storage/status/{processing_id}
```

**Response (Completed):**
```json
{
  "processing_id": "12345678-1234-1234-1234-123456789abc",
  "status": "completed",
  "file_path": "P005/session1/test_file.c3d",
  "created_at": "2025-08-11T10:30:00Z",
  "processed_at": "2025-08-11T10:35:00Z",
  "analysis_results": {
    // Complete ChannelAnalytics data (same format as /upload endpoint)
  },
  "compliance_scores": {
    "left": 85,
    "right": 90
  }
}
```

## 📥 Data Compatibility

### Frontend Export Tab Integration
The webhook system stores data in **exactly the same format** as the `/upload` endpoint response, ensuring perfect compatibility with:

- **Export Tab Signal Processing**: Direct access to `emg_signals` data
- **Performance Analysis**: `compliance_scores` matches frontend expectations  
- **Analytics Dashboard**: `analytics_data` provides complete `ChannelAnalytics`
- **Temporal Analysis**: `temporal_stats` supports advanced metrics

### Data Format Alignment
```typescript
// Frontend ExportData type matches database storage exactly
interface ExportData {
  metadata: { exportDate: string, fileName: string },
  analytics: ChannelAnalytics,      // ← analysis_results.analytics_data
  processedSignals: EMGSignalData,  // ← analysis_results.emg_signals  
  performanceAnalysis: any,         // ← analysis_results.compliance_scores
}
```

## 🧪 Testing Status

### Test Coverage: 100% ✅
- **30/30 tests passing**
- **Core Validation**: Signature verification, payload validation, error handling
- **Integration Tests**: End-to-end workflows, database operations, status tracking
- **Security Tests**: HMAC verification, timing attack protection

## 🚀 Production Deployment

### Environment Setup
```bash
# Backend .env configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # Required for file downloads & RLS bypass
WEBHOOK_SECRET=your-webhook-secret     # For signature verification
PROCESSING_VERSION=v2.1.0

# Start development environment
./start_dev.sh  # Starts backend on port 8080
```

### 🔒 Security & Authentication
**Row Level Security (RLS) is ENABLED** - requires researcher authentication:
- Users must be logged in with valid `researcher_profiles` entry
- Roles: `researcher`, `clinical_specialist`, or `admin` 
- Webhook processing uses service key to bypass RLS for automation
- See `/docs/webhook_security_rls.md` for complete security implementation

### Supabase Storage Configuration
1. **Create Webhook**: Configure webhook in Supabase Dashboard
2. **Set URL**: `https://your-domain.com/webhooks/storage/c3d-upload`
3. **Configure Secret**: Match `WEBHOOK_SECRET` environment variable
4. **Select Events**: Enable `ObjectCreated:Post` for C3D uploads

## 📋 System Health

### Monitoring
- **Processing Status**: Track via `c3d_metadata.processing_status`
- **Cache Performance**: Monitor `analysis_results.cache_hits`
- **Error Tracking**: Review `c3d_metadata.error_message` for failures
- **Performance**: Track `analysis_results.processing_time_ms`

### Maintenance
- **Cache Cleanup**: Automatic expiry after 30 days
- **Error Recovery**: Failed processes can be retried via manual API calls
- **Version Tracking**: `processing_version` ensures cache validity across updates

## 🔧 Configuration

### File Processing Rules
- **Supported Buckets**: `c3d-examples` only
- **File Types**: `.c3d` extensions only
- **Size Limits**: 50MB maximum
- **Deduplication**: SHA-256 hash prevents reprocessing identical files

### Patient/Session Resolution Priority
1. **Subfolder Pattern**: `P005/session1/file.c3d` → Patient: P005, Session: session1
2. **C3D Metadata**: `player_name` field in C3D file
3. **Storage Metadata**: Additional metadata from upload context

The webhook system is **production-ready** with comprehensive testing, security measures, and seamless integration with existing frontend components.