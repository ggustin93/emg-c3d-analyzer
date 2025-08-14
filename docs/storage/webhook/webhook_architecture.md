# Clean Webhook Architecture - EMG C3D Analyzer

**Last Updated**: 2025-08-14  
**Status**: Production Ready  

## 🎯 **Architecture Overview**

Clean, SOLID, DRY webhook implementation for Supabase Storage events that works with the **actual database schema** and follows senior backend engineering principles.

### **Core Principles Applied**

#### **SOLID Principles** ✅
- **S**ingle Responsibility: Each service has one clear purpose
- **O**pen/Closed: Extensible without modification
- **L**iskov Substitution: Consistent interface contracts
- **I**nterface Segregation: Focused, minimal interfaces
- **D**ependency Inversion: Depends on abstractions, not concretions

#### **DRY (Don't Repeat Yourself)** ✅
- Single source of truth for webhook logic
- Reusable components across services
- No duplicate database operations

#### **KISS (Keep It Simple, Stupid)** ✅
- Simple, readable code structure
- Clear separation of concerns
- Minimal complexity

---

## 🏗️ **System Architecture**

```mermaid
graph TD
    A[Supabase Storage Event] --> B[Clean Webhook API]
    B --> C[Webhook Security]
    B --> D[Therapy Session Processor]
    D --> E[Database Operations]
    D --> F[C3D Processing]
    D --> G[Background Tasks]
    
    E --> H[(therapy_sessions)]
    E --> I[(emg_statistics)]
    E --> J[(c3d_technical_data)]
    E --> K[(performance_scores)]
    E --> L[(processing_parameters)]
    
    style B fill:#e1f5fe
    style D fill:#f3e5f5
    style C fill:#fff3e0
```

---

## 📁 **File Structure**

### **Core Components**

```
backend/
├── api/
│   └── webhooks.py                    # 🎯 Clean webhook endpoints
├── services/
│   ├── therapy_session_processor.py  # 🧠 Core business logic
│   └── webhook_security.py           # 🔒 Security service
└── test_clean_webhook.py             # 🧪 Test suite
```

### **Component Responsibilities**

| Component | Responsibility | Dependencies |
|-----------|---------------|-------------|
| `webhooks.py` | HTTP endpoint handling, validation | `TherapySessionProcessor`, `WebhookSecurity` |
| `therapy_session_processor.py` | Business logic, database operations | `supabase_client`, `GHOSTLYC3DProcessor` |
| `webhook_security.py` | Signature verification | None (pure function) |

---

## 🔄 **Data Flow**

### **Request Processing Flow**

```
1. Webhook Received 📨
   ├── Parse JSON payload
   ├── Verify signature (if configured)
   └── Validate event type
   
2. Session Creation 🆕
   ├── Create therapy_sessions record
   ├── Generate unique session_id
   └── Return immediate response (<50ms)
   
3. Background Processing 🔄
   ├── Download C3D file from storage
   ├── Process with GHOSTLYC3DProcessor
   ├── Populate all database tables
   └── Update session status
```

### **Database Population Sequence**

```sql
-- 1. Create therapy session (immediate)
INSERT INTO therapy_sessions (id, file_path, processing_status, ...)

-- 2. Background processing populates related tables
INSERT INTO c3d_technical_data (session_id, sampling_rate, ...)
INSERT INTO emg_statistics (session_id, channel_name, ...)  -- Per channel
INSERT INTO processing_parameters (session_id, filter_settings, ...)
INSERT INTO performance_scores (session_id, overall_score, ...)
```

---

## 🚀 **Key Benefits**

### **Performance Improvements**
- **Fast Webhook Response**: <50ms (vs 8-15 seconds in legacy system)
- **Background Processing**: Non-blocking C3D analysis
- **Efficient Database Operations**: Single transaction per table
- **Memory Management**: Temporary file cleanup

### **Reliability Improvements**
- **Error Isolation**: Background failures don't affect webhook response
- **Status Tracking**: Complete processing lifecycle visibility
- **Duplicate Detection**: File hash-based deduplication
- **Graceful Degradation**: Continues processing even with partial failures

### **Maintainability Improvements**
- **Clear Separation**: API layer separate from business logic
- **Single Responsibility**: Each class has one clear purpose
- **Testable Design**: Easy to unit test each component
- **Minimal Dependencies**: Reduced coupling between components

---

## 📊 **Database Schema Integration**

### **Actual Tables Used** (verified with Supabase MCP)

#### `therapy_sessions` (Main Record)
```sql
id                      UUID PRIMARY KEY
file_path               TEXT UNIQUE NOT NULL
file_hash               TEXT NOT NULL
processing_status       TEXT DEFAULT 'pending'
analytics_cache         JSONB DEFAULT '{}'
game_metadata          JSONB DEFAULT '{}'
processing_time_ms      DOUBLE PRECISION
created_at              TIMESTAMPTZ DEFAULT now()
processed_at            TIMESTAMPTZ
updated_at              TIMESTAMPTZ DEFAULT now()
```

#### `emg_statistics` (Per Channel Analysis)
```sql
id                      UUID PRIMARY KEY
session_id              UUID REFERENCES therapy_sessions(id)
channel_name            TEXT NOT NULL
total_contractions      INTEGER DEFAULT 0
good_contractions       INTEGER DEFAULT 0
compliance_rate         DOUBLE PRECISION DEFAULT 0.0
mvc_value               DOUBLE PRECISION NOT NULL
signal_quality_score    DOUBLE PRECISION
-- ... additional EMG metrics
```

#### `c3d_technical_data` (File Metadata)
```sql
session_id              UUID PRIMARY KEY REFERENCES therapy_sessions(id)
original_sampling_rate  REAL
channel_count           INTEGER
channel_names           TEXT[]
duration_seconds        REAL
extracted_at            TIMESTAMPTZ DEFAULT now()
```

#### `performance_scores` (Clinical Scoring)
```sql
id                      UUID PRIMARY KEY
session_id              UUID REFERENCES therapy_sessions(id)
overall_score           DOUBLE PRECISION DEFAULT 0.0
compliance_score        DOUBLE PRECISION DEFAULT 0.0
symmetry_score          DOUBLE PRECISION
effort_score            DOUBLE PRECISION
bfr_compliant           BOOLEAN DEFAULT true
```

---

## 🔐 **Security Implementation**

### **Webhook Signature Verification**

```python
# HMAC-SHA256 verification
def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.replace("sha256=", ""))
```

### **Security Features**
- ✅ **Signature Verification**: HMAC-SHA256 validation
- ✅ **Timing Attack Protection**: Constant-time comparison
- ✅ **Input Validation**: Strict payload validation
- ✅ **Error Handling**: Secure error responses

---

## 📋 **API Reference**

### **Webhook Endpoint**

#### `POST /webhooks/storage/c3d-upload`

**Purpose**: Handle C3D file upload from Supabase Storage

**Request Headers**:
```
Content-Type: application/json
x-supabase-signature: sha256=<hmac_signature>  # Optional
```

**Request Body** (Supabase Storage Event):
```json
{
  "type": "INSERT",
  "table": "objects", 
  "schema": "storage",
  "record": {
    "name": "session_file.c3d",
    "bucket_id": "c3d-examples",
    "metadata": {
      "size": 1024000,
      "mimetype": "application/octet-stream"
    }
  }
}
```

**Response** (Fast - <50ms):
```json
{
  "success": true,
  "message": "C3D processing initiated",
  "session_id": "uuid-here",
  "processing_time_ms": 45.2
}
```

### **Status Endpoint**

#### `GET /webhooks/storage/status/{session_id}`

**Purpose**: Check processing status for a therapy session

**Response**:
```json
{
  "session_id": "uuid-here",
  "status": "completed",  // pending, processing, completed, failed
  "file_path": "c3d-examples/session_file.c3d",
  "created_at": "2025-08-14T10:30:00Z",
  "processed_at": "2025-08-14T10:30:05Z",
  "has_analysis": true
}
```

---

## 🧪 **Testing**

### **Test Coverage**

```bash
# Run webhook tests
python test_clean_webhook.py
```

**Test Cases**:
- ✅ Payload parsing and validation
- ✅ Signature verification (valid/invalid)
- ✅ Event filtering (C3D files only)
- ✅ Response format validation
- ✅ Error handling

### **Integration Testing**

```bash
# Test with real Supabase webhook
curl -X POST http://localhost:8080/webhooks/storage/c3d-upload \
  -H "Content-Type: application/json" \
  -H "x-supabase-signature: sha256=<signature>" \
  -d '{"type":"INSERT","table":"objects",...}'
```

---

## 🔍 **Monitoring & Observability**

### **Logging Strategy**

```python
# Structured logging throughout the pipeline
logger.info(f"📁 Processing C3D upload: {event.object_name}")
logger.info(f"✅ Session created: {session_id} ({processing_time:.1f}ms)")
logger.info(f"🔄 Background processing started: {session_id}")
logger.info(f"📊 EMG channels analyzed: {result.get('channels_analyzed', 0)}")
```

### **Health Check**

#### `GET /webhooks/health`
```json
{
  "service": "C3D Webhook Processing",
  "status": "healthy",
  "database_tables": [
    "therapy_sessions", 
    "emg_statistics",
    "c3d_technical_data", 
    "performance_scores"
  ],
  "features": [
    "background_processing", 
    "signature_verification", 
    "status_tracking"
  ]
}
```

---

## 🆚 **Comparison: Before vs After**

| Aspect | Legacy Implementation | Clean Implementation |
|--------|----------------------|---------------------|
| **Architecture** | Multiple services, circular dependencies | Single responsibility, clean dependencies |
| **Database** | Wrong schema (non-existent tables) | Actual production schema |
| **Response Time** | 8-15 seconds | <50ms |
| **Code Duplication** | High (3+ webhook services) | None (single source of truth) |
| **Error Handling** | Mixed concerns | Isolated, recoverable |
| **Testing** | Complex mocking | Simple, focused tests |
| **Maintainability** | High coupling | Loose coupling |
| **Security** | Mixed implementation | Dedicated security service |

---

## 🚀 **Deployment**

### **Environment Configuration**

```bash
# Required environment variables
WEBHOOK_SECRET=your_webhook_secret_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
PROCESSING_VERSION=v2.1.0
```

### **Production Readiness Checklist**

- ✅ SOLID principles implemented
- ✅ Works with actual database schema
- ✅ Signature verification enabled
- ✅ Background processing implemented
- ✅ Error handling and logging
- ✅ Status tracking available
- ✅ Test suite passing
- ✅ Health check endpoint
- ✅ Documentation complete

---

## 🔮 **Future Enhancements**

### **Potential Improvements**
- 📋 Add webhook retry mechanism for failed processing
- 📋 Implement processing queue for high-volume scenarios
- 📋 Add metrics collection (processing times, success rates)
- 📋 Support for additional file formats
- 📋 Real-time processing status via WebSocket
- 📋 Automated performance optimization

### **Scalability Considerations**
- 📋 Horizontal scaling with multiple workers
- 📋 Database connection pooling
- 📋 Caching layer for frequent operations
- 📋 Load balancing for webhook endpoints

---

*This architecture provides a clean, maintainable, and efficient webhook system that follows senior backend engineering best practices and works with the actual production database schema.*