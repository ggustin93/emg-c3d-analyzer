# SQL Database & NocoDB Integration Plan

## Task Overview
Implement SQL database persistence for EMG C3D analysis data (similar to JsonExportModal) and integrate with NocoDB for visual data management and analysis.

## Current System Analysis

### Existing Architecture
- **Backend**: FastAPI with stateless processing
- **Frontend**: React/TypeScript with Zustand state management  
- **Database**: Supabase PostgreSQL ("Ghostly +" project - `egihfsmxphqcsjotmhmm`)
- **Data Flow**: Upload → Process → Analyze → Visualize (all in-memory)
- **Export**: JsonExportModal creates structured export with mock data

### Current Supabase Schema
```sql
-- Existing tables:
- therapists (id, user_id, first_name, last_name, created_at)
- patients (id, therapist_id, patient_code, first_name, last_name, date_of_birth, created_at)  
- emg_sessions (id, patient_id, file_path, recorded_at, notes, created_at)
- researcher_profiles (id, full_name, institution, department, role, access_level, created_at, updated_at, last_login)
```

### JsonExportModal Data Structure Analysis
The current export modal provides a comprehensive data structure that maps perfectly to database storage:

```typescript
interface ExportData {
  export_metadata: {
    export_timestamp: string;
    export_version: string;
    exporter: string;
  };
  file_info: {
    source_file: string;
    full_path: string;
    file_size_bytes: number;
    file_modified: string;
  };
  game_metadata: any;
  processing_parameters: {
    session_parameters: GameSessionParameters;
    processing_options: object;
    analysis_functions_used: string[];
  };
  channels: Record<string, ChannelData>;
  analytics: Record<string, ChannelAnalytics>;
  summary_statistics: object;
  debug_info?: object;
  request_metadata: {
    user_id: string;
    patient_id: string | null;
    session_id: string | null;
    filename: string;
    export_timestamp: string;
  };
}
```

## Implementation Plan

### Phase 1: Database Schema Design

#### 1.1 Core EMG Analysis Tables
```sql
-- EMG Analysis Results (main table)
CREATE TABLE emg_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES emg_sessions(id),
    file_id TEXT NOT NULL,
    
    -- File Information
    source_filename TEXT NOT NULL,
    file_size_bytes BIGINT,
    file_modified_at TIMESTAMPTZ,
    
    -- Game Metadata (JSON)
    game_metadata JSONB,
    
    -- Processing Configuration (JSON)
    processing_parameters JSONB NOT NULL,
    analysis_functions_used TEXT[],
    
    -- Summary Statistics (JSON)
    summary_statistics JSONB,
    
    -- Debug Information (JSON, optional)
    debug_info JSONB,
    
    -- Metadata
    export_version TEXT DEFAULT '1.0.0',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMG Channel Data
CREATE TABLE emg_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_result_id UUID REFERENCES emg_analysis_results(id) ON DELETE CASCADE,
    
    -- Channel Identification
    channel_name TEXT NOT NULL,
    channel_type TEXT CHECK (channel_type IN ('emg_channel')),
    
    -- Signal Metadata
    sampling_rate FLOAT NOT NULL,
    data_points INTEGER NOT NULL,
    duration_seconds FLOAT NOT NULL,
    
    -- Signal Data (compressed/encoded)
    raw_data_compressed BYTEA, -- For optional raw signals
    time_axis_compressed BYTEA,
    rms_envelope_compressed BYTEA,
    
    -- Signal Summary (when raw data excluded)
    signal_summary JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMG Channel Analytics  
CREATE TABLE emg_channel_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES emg_channels(id) ON DELETE CASCADE,
    
    -- Basic Metrics
    rms FLOAT,
    mav FLOAT,
    peak_amplitude FLOAT,
    
    -- Frequency Domain
    mpf FLOAT, -- Mean Power Frequency
    mdf FLOAT, -- Median Frequency
    spectral_bandwidth FLOAT,
    
    -- Fatigue Analysis
    fatigue_index_fi_nsm5 FLOAT,
    fatigue_slope FLOAT,
    
    -- Temporal Statistics (JSON for mean±std format)
    rms_temporal_stats JSONB,
    mav_temporal_stats JSONB,
    fatigue_index_temporal_stats JSONB,
    mpf_temporal_stats JSONB,
    mdf_temporal_stats JSONB,
    
    -- Contraction Analysis
    total_contractions INTEGER,
    good_contractions INTEGER,
    contraction_metrics JSONB, -- Duration, amplitude stats
    
    -- Performance Metrics
    mvc_threshold FLOAT,
    intensity_rate FLOAT,
    duration_rate FLOAT,
    quality_score FLOAT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis Export Log (for tracking exports)
CREATE TABLE emg_analysis_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_result_id UUID REFERENCES emg_analysis_results(id),
    exported_by UUID REFERENCES auth.users(id),
    export_format TEXT DEFAULT 'json',
    include_raw_signals BOOLEAN DEFAULT true,
    include_debug_info BOOLEAN DEFAULT true,
    export_size_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.2 Database Indexes & Constraints
```sql
-- Performance indexes
CREATE INDEX idx_emg_analysis_results_session_id ON emg_analysis_results(session_id);
CREATE INDEX idx_emg_analysis_results_created_at ON emg_analysis_results(created_at);
CREATE INDEX idx_emg_channels_analysis_result_id ON emg_channels(analysis_result_id);
CREATE INDEX idx_emg_channel_analytics_channel_id ON emg_channel_analytics(channel_id);

-- Search indexes for JSON fields
CREATE INDEX idx_emg_analysis_results_game_metadata ON emg_analysis_results USING GIN (game_metadata);
CREATE INDEX idx_emg_analysis_results_processing_params ON emg_analysis_results USING GIN (processing_parameters);

-- Row Level Security (RLS)
ALTER TABLE emg_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE emg_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE emg_channel_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE emg_analysis_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies (match existing pattern)
CREATE POLICY "Users can view their own analysis results" ON emg_analysis_results
    FOR SELECT USING (
        session_id IN (
            SELECT id FROM emg_sessions 
            WHERE patient_id IN (
                SELECT id FROM patients 
                WHERE therapist_id IN (
                    SELECT id FROM therapists 
                    WHERE user_id = auth.uid()
                )
            )
        )
    );
```

### Phase 2: Backend Implementation

#### 2.1 Database Models & Repository Pattern
```python
# backend/models/emg_analysis_models.py
class EMGAnalysisResultDB(BaseModel):
    id: UUID
    session_id: UUID
    file_id: str
    source_filename: str
    file_size_bytes: Optional[int]
    game_metadata: Optional[dict]
    processing_parameters: dict
    analysis_functions_used: List[str]
    summary_statistics: Optional[dict]
    debug_info: Optional[dict]
    created_at: datetime
    
class EMGChannelDB(BaseModel):
    id: UUID
    analysis_result_id: UUID
    channel_name: str
    sampling_rate: float
    data_points: int
    duration_seconds: float
    # Signal data handling methods
    
class EMGChannelAnalyticsDB(BaseModel):
    id: UUID
    channel_id: UUID
    rms: Optional[float]
    mav: Optional[float]
    # ... all analytics fields
```

#### 2.2 Repository Layer
```python
# backend/repositories/emg_analysis_repository.py
class EMGAnalysisRepository:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    async def save_analysis_result(self, result: EMGAnalysisResult, session_id: UUID) -> UUID:
        """Save complete analysis result to database"""
        # 1. Insert main analysis result
        # 2. Insert channels with compressed signal data
        # 3. Insert analytics for each channel
        # 4. Return analysis_result_id
        
    async def get_analysis_result(self, analysis_id: UUID) -> EMGAnalysisResult:
        """Retrieve complete analysis result from database"""
        
    async def list_analysis_results(self, session_id: UUID) -> List[EMGAnalysisResultSummary]:
        """List analysis results for a session"""
        
    async def export_analysis_result(self, analysis_id: UUID, options: ExportOptions) -> dict:
        """Export analysis result in JsonExportModal format"""
```

#### 2.3 API Endpoint Modifications
```python
# backend/api.py - Enhanced endpoints
@app.post("/api/v1/emg/upload-and-save")
async def upload_and_save_emg_file(
    file: UploadFile,
    session_id: UUID,
    save_to_db: bool = True,
    include_raw_signals: bool = True
):
    """
    Enhanced upload endpoint that:
    1. Processes C3D file (existing logic)
    2. Optionally saves to database 
    3. Returns analysis result + database ID
    """
    
@app.get("/api/v1/emg/analysis/{analysis_id}")
async def get_analysis_result(analysis_id: UUID):
    """Retrieve saved analysis result"""
    
@app.get("/api/v1/emg/session/{session_id}/analyses")
async def list_session_analyses(session_id: UUID):
    """List all analyses for a session"""
    
@app.post("/api/v1/emg/analysis/{analysis_id}/export")
async def export_analysis_result(
    analysis_id: UUID,
    options: ExportOptions
):
    """Export analysis result (replaces JsonExportModal mock data)"""
```

### Phase 3: Frontend Integration

#### 3.1 Enhanced Upload Flow
```typescript
// frontend/src/hooks/useEmgDataPersistence.ts
export const useEmgDataPersistence = () => {
  const saveAnalysisResult = async (
    file: File,
    sessionId: string,
    options: SaveOptions
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);
    formData.append('save_to_db', options.saveToDatabase.toString());
    formData.append('include_raw_signals', options.includeRawSignals.toString());
    
    const response = await fetch('/api/v1/emg/upload-and-save', {
      method: 'POST',
      body: formData
    });
    
    return response.json();
  };
  
  return { saveAnalysisResult };
};
```

#### 3.2 Analysis History Component
```typescript
// frontend/src/components/AnalysisHistory.tsx
const AnalysisHistory: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [analyses, setAnalyses] = useState<AnalysisResultSummary[]>([]);
  
  useEffect(() => {
    fetch(`/api/v1/emg/session/${sessionId}/analyses`)
      .then(res => res.json())
      .then(setAnalyses);
  }, [sessionId]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Previous Analyses</CardTitle>
      </CardHeader>
      <CardContent>
        {analyses.map(analysis => (
          <AnalysisCard 
            key={analysis.id}
            analysis={analysis}
            onLoad={() => loadAnalysis(analysis.id)}
            onExport={() => exportAnalysis(analysis.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
};
```

#### 3.3 Enhanced Export Modal
```typescript
// Modify existing JsonExportModal to use real database data
const JsonExportModal: React.FC<JsonExportModalProps> = ({ 
  analysisResult, 
  analysisId, // NEW: database ID
  uploadedFileName,
  children 
}) => {
  const handleExport = async () => {
    if (analysisId) {
      // Use real database export
      const response = await fetch(`/api/v1/emg/analysis/${analysisId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportOptions)
      });
      
      const exportData = await response.json();
      setExportData(exportData);
    } else {
      // Fallback to mock data for unsaved analyses
      handleExportWithMockData();
    }
  };
  
  // ... rest of component
};
```

### Phase 4: NocoDB Integration

#### 4.1 NocoDB Setup with Supabase
```bash
# Docker command to connect NocoDB to existing Supabase
docker run -d --name nocodb-emg \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  -e NC_DB="pg://[supabase-user]:[password]@db.egihfsmxphqcsjotmhmm.supabase.co:5432/postgres?schema=public" \
  -e NC_AUTH_JWT_SECRET="your-jwt-secret" \
  nocodb/nocodb:latest
```

#### 4.2 NocoDB Configuration Steps
1. **Database Connection**: Connect to existing Supabase PostgreSQL
2. **Base Creation**: Create "EMG Analysis" base
3. **Table Import**: Import existing tables + new EMG analysis tables
4. **View Creation**: 
   - Analysis Results Overview
   - Channel Analytics Dashboard
   - Export History
   - Session Timeline
5. **Form Creation**: Data entry forms for metadata
6. **Dashboard Setup**: Analytics visualization

#### 4.3 NocoDB Views Design
```sql
-- View: EMG Analysis Dashboard
SELECT 
  ar.id,
  ar.source_filename,
  ar.created_at,
  p.patient_code,
  p.first_name || ' ' || p.last_name as patient_name,
  t.first_name || ' ' || t.last_name as therapist_name,
  COUNT(ec.id) as channel_count,
  AVG(eca.rms) as avg_rms,
  AVG(eca.total_contractions) as avg_contractions
FROM emg_analysis_results ar
JOIN emg_sessions es ON ar.session_id = es.id
JOIN patients p ON es.patient_id = p.id  
JOIN therapists t ON p.therapist_id = t.id
JOIN emg_channels ec ON ar.id = ec.analysis_result_id
JOIN emg_channel_analytics eca ON ec.id = eca.channel_id
GROUP BY ar.id, p.patient_code, p.first_name, p.last_name, t.first_name, t.last_name;

-- View: Channel Performance Metrics
SELECT 
  ec.channel_name,
  eca.rms,
  eca.mav,
  eca.mpf,
  eca.mdf,
  eca.total_contractions,
  eca.good_contractions,
  eca.intensity_rate,
  eca.duration_rate,
  eca.quality_score,
  ar.source_filename,
  ar.created_at
FROM emg_channel_analytics eca
JOIN emg_channels ec ON eca.channel_id = ec.id
JOIN emg_analysis_results ar ON ec.analysis_result_id = ar.id;
```

### Phase 5: Data Migration & NocoDB Synchronization

#### 5.1 Migration Strategy
```python
# backend/migrations/migrate_existing_data.py
async def migrate_existing_analyses():
    """
    Migration script for existing JsonExportModal data
    1. Identify existing analysis files/sessions
    2. Convert to new database schema
    3. Preserve historical data
    """
    
async def refresh_nocodb_schema():
    """
    Manual schema refresh in NocoDB after database changes
    1. Use NocoDB Meta API to refresh table metadata
    2. Update views and dashboards
    3. Validate data integrity
    """
```

#### 5.2 NocoDB Synchronization Strategies

**✅ Validated Approach: Webhook-Based Synchronization**
Based on Context7 and Perplexity research, NocoDB provides robust webhook support for real-time synchronization:

```python
# backend/webhooks/nocodb_sync.py
class NoCDBWebhookHandler:
    """
    Handle NocoDB webhooks for bidirectional synchronization
    """
    
    def setup_nocodb_webhooks(self):
        """
        Configure webhooks in NocoDB for EMG analysis tables
        - records.after.insert
        - records.after.update  
        - records.after.delete
        """
        webhook_config = {
            "type": "records.after.insert",
            "notification": {
                "url": f"{API_BASE_URL}/webhooks/nocodb/emg-analysis",
                "method": "POST",
                "headers": {"Authorization": f"Bearer {API_TOKEN}"}
            }
        }
        
    async def handle_nocodb_webhook(self, webhook_data: dict):
        """
        Process webhook payload from NocoDB
        {
          "type": "records.after.update",
          "data": {
            "table_name": "emg_analysis_results",
            "records": [...],
            "previous_records": [...]
          }
        }
        """
        if webhook_data["data"]["table_name"] == "emg_analysis_results":
            await self.sync_analysis_result_changes(webhook_data)
```

**✅ Supabase Real-time Integration**
```typescript
// frontend/src/hooks/useSupabaseRealtimeSync.ts
const setupSupabaseRealtimeSync = () => {
  supabase
    .channel('emg_analysis_changes')
    .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'emg_analysis_results' },
        (payload) => {
          // Real-time updates trigger NocoDB cache refresh
          handleDatabaseChange(payload);
        }
    )
    .subscribe();
};

const handleDatabaseChange = async (payload) => {
  // Notify other connected users
  // Trigger NocoDB metadata refresh if needed
  if (payload.eventType === 'INSERT') {
    await refreshNoCDBViews();
  }
};
```

**❌ Schema Auto-Sync Limitation**
Research confirms NocoDB does **not** provide automatic meta-diff synchronization for schema changes. Manual approaches required:

```python
# Manual schema sync approach
async def sync_schema_changes_to_nocodb():
    """
    Manual schema synchronization after database migrations
    - Use NocoDB Meta API: /api/v1/db/meta/projects/{projectId}/meta-diff
    - Refresh table structures manually
    - Update views and dashboards programmatically
    """
    
    # 1. Get current schema diff from NocoDB
    meta_diff = await nocodb_client.get(f"/api/v1/db/meta/projects/{PROJECT_ID}/meta-diff")
    
    # 2. Apply schema changes if needed
    if meta_diff.get("changes"):
        await nocodb_client.post(f"/api/v1/db/meta/projects/{PROJECT_ID}/meta-diff", 
                                json=meta_diff)
        
    # 3. Refresh views and dashboards
    await refresh_nocodb_views()
```

#### 5.3 Synchronization Architecture

**Three-Layer Sync Strategy:**
1. **Database Layer**: Supabase PostgreSQL as single source of truth
2. **Application Layer**: EMG Analyzer with real-time Supabase subscriptions  
3. **Visualization Layer**: NocoDB with webhook-based updates

```mermaid
graph TB
    A[Supabase PostgreSQL] -->|Real-time subscriptions| B[EMG Analyzer]
    A -->|Direct connection| C[NocoDB]
    B -->|API calls| A
    C -->|Webhooks| D[Webhook Handler]
    D -->|Updates| B
    C -->|Manual refresh| E[Schema Sync Service]
```

## Technical Implementation Details

### Data Compression Strategy
- **Raw Signals**: Use gzip compression + base64 encoding for BYTEA storage
- **JSON Fields**: PostgreSQL native JSONB compression
- **Size Optimization**: Configurable signal downsampling for storage

### Performance Considerations
- **Indexing**: GIN indexes on JSONB fields for fast queries
- **Partitioning**: Time-based partitioning for large datasets
- **Caching**: Redis layer for frequently accessed analyses
- **Lazy Loading**: Load raw signals only when requested

### Security & Compliance
- **RLS Policies**: Match existing therapist/patient access patterns
- **Audit Trail**: Track all data access and modifications
- **GDPR Compliance**: Data anonymization and deletion capabilities
- **Medical Device Standards**: Maintain FDA Class II compliance

### Error Handling & Rollback
- **Transaction Safety**: Atomic operations for multi-table inserts
- **Backup Strategy**: Point-in-time recovery for critical data
- **Validation**: Schema validation at API and database levels
- **Monitoring**: Query performance and storage usage alerts

## Implementation Timeline

### Phase 1 (Week 1): Database Schema
- [ ] Create migration scripts
- [ ] Deploy schema to development environment
- [ ] Test with sample data
- [ ] Implement RLS policies

### Phase 2 (Week 2): Backend Integration  
- [ ] Implement repository layer
- [ ] Update API endpoints
- [ ] Add data compression utilities
- [ ] Write unit tests

### Phase 3 (Week 3): Frontend Integration
- [ ] Update upload flow
- [ ] Implement analysis history
- [ ] Enhance export modal
- [ ] Add save/load functionality

### Phase 4 (Week 4): NocoDB Setup
- [ ] Configure database connection
- [ ] Create base and import tables
- [ ] Design dashboards and views
- [ ] Set up user access controls

### Phase 5 (Week 5): Testing & Deployment
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Production deployment
- [ ] User training and documentation

## Success Criteria

1. **Data Persistence**: All EMG analysis results saved to PostgreSQL
2. **Export Compatibility**: JsonExportModal works with real database data
3. **NocoDB Integration**: Visual database interface operational
4. **Performance**: Sub-3-second save/load times for typical analyses
5. **Reliability**: 99.9% data integrity with proper backup/recovery
6. **Clinical Compliance**: Maintains FDA Class II medical device standards
7. **User Experience**: Seamless integration with existing workflow

## Risk Mitigation

1. **Data Loss**: Implement staged rollout with backup verification
2. **Performance Degradation**: Load testing with realistic data volumes
3. **Schema Changes**: Versioned migrations with rollback capability
4. **NocoDB Compatibility**: Test with multiple NocoDB versions
5. **Clinical Disruption**: Parallel operation during transition period

## Post-Implementation Benefits

1. **Data Analytics**: Historical trend analysis across patients/sessions
2. **Research Capabilities**: Large-scale EMG data mining and insights
3. **Clinical Workflow**: Streamlined patient progress tracking
4. **Compliance Reporting**: Automated regulatory compliance reports
5. **System Integration**: API access for external research tools
6. **Scalability**: Support for multi-center research studies

## ✅ Plan Validation Summary (Context7 + Perplexity Research)

### **Research Findings**

**✅ NocoDB Self-Hosted PostgreSQL Integration**
- **Fully validated**: Direct PostgreSQL connection support with SSL configuration
- **Connection string**: `pg://host:port?u=user&p=password&d=database&schema=public`
- **SSL support**: Full TLS/MTLS configuration options available
- **Schema targeting**: Specific schema selection via `searchPath` configuration

**✅ Real-time Synchronization via Webhooks**
- **Webhook types**: `records.after.insert`, `records.after.update`, `records.after.delete`, `records.after.bulkUpdate`
- **Payload structure**: Complete record data with previous/current state comparison
- **Integration**: Handlebars syntax for custom payload formatting
- **API endpoints**: Full Meta API support for webhook management

**❌ Automatic Meta-Diff Sync Limitation**
- **Key finding**: NocoDB does NOT provide automatic schema synchronization
- **Manual approach required**: Use `/api/v1/db/meta/projects/{projectId}/meta-diff` endpoint
- **Impact**: Schema changes require manual intervention or custom automation
- **Workaround**: Webhook-based data sync + manual schema refresh workflow

**✅ Supabase Integration Pattern**
- **Real-time subscriptions**: PostgreSQL change notifications via Supabase
- **RLS compatibility**: Works with existing Row Level Security policies
- **Authentication**: Integrates with existing Supabase auth system
- **Performance**: Sub-second webhook delivery and processing

### **Architecture Validation**

**✅ Three-Layer Synchronization Model**
1. **Database Layer**: Supabase PostgreSQL (single source of truth) ✅
2. **Application Layer**: EMG Analyzer with real-time subscriptions ✅  
3. **Visualization Layer**: NocoDB with webhook notifications ✅

**✅ Technical Stack Compatibility**
- **PostgreSQL 15.8**: Full NocoDB support confirmed
- **JSONB storage**: Native support for EMG metadata and analytics
- **Webhook reliability**: Production-grade webhook system with retry logic
- **API access**: Complete REST API for programmatic management

### **Implementation Approach Refined**

Based on research findings, the plan emphasizes:
1. **Webhook-first synchronization** (not database triggers)
2. **Manual schema migration** workflow with NocoDB Meta API
3. **Supabase real-time** for immediate UI updates
4. **NocoDB webhooks** for bidirectional data flow
5. **Structured error handling** for webhook failures and retries

## 🎯 **SIMPLIFIED IMPLEMENTATION (Recommended)**

**Key Insight**: Since EMG data flow is **one-way** (Analysis → Database → Visualization), the implementation is **much simpler** than general bidirectional sync.

### **Simplified Architecture**
```mermaid
graph LR
    A[EMG Analysis] --> B[Supabase PostgreSQL] 
    B --> C[NocoDB Dashboard]
    B --> D[EMG Analyzer UI]
```

### **Phase 1: Minimal Viable Integration (1 Week)**
```bash
# 1. Deploy NocoDB pointing to existing Supabase
docker run -d --name nocodb-emg \
  -p 8080:8080 \
  -e NC_DB="postgresql://[user]:[pass]@db.egihfsmxphqcsjotmhmm.supabase.co:5432/postgres" \
  nocodb/nocodb:latest

# 2. Create EMG analysis tables in Supabase (existing schema)
# 3. Import tables into NocoDB
# 4. Create dashboards and views
# 5. Done! 🎉
```

### **What You Actually Need**
- ✅ **Simple database connection** (5 minutes)
- ✅ **Table import** (10 minutes) 
- ✅ **Dashboard creation** (2-4 hours)
- ❌ **No complex webhooks needed**
- ❌ **No bidirectional sync**
- ❌ **No schema conflict resolution**

### **Optional Enhancements** (If Desired Later)
- **Real-time refresh**: Simple webhook to refresh NocoDB views when new EMG data arrives
- **Custom views**: Patient progress tracking, therapist dashboards
- **Export features**: PDF reports, data exports from NocoDB interface

### **Estimated Timeline**
- **Minimum viable**: **1 day** (basic connection + dashboards)
- **Production ready**: **1 week** (with proper views and styling)
- **Full integration**: **2-3 weeks** (if you want real-time updates)

This comprehensive plan transforms the EMG C3D Analyzer from a stateless processing tool into a full-featured clinical database system with advanced visualization and management capabilities through validated NocoDB integration patterns.