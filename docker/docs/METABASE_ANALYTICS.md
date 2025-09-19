# Metabase Analytics Platform for EMG Research

## 📊 Overview

Metabase is an open-source business intelligence platform that provides powerful data visualization and analytics capabilities for EMG researchers. It connects directly to your Supabase database to create interactive dashboards, reports, and data explorations without requiring SQL knowledge.

### Why Metabase for EMG Research?

- **No-Code Analytics**: Researchers can explore data without SQL knowledge
- **Interactive Dashboards**: Real-time visualization of EMG metrics
- **Statistical Analysis**: Built-in aggregations and trend analysis
- **Export Capabilities**: Export results to CSV, Excel, or JSON
- **Collaboration**: Share dashboards with research teams
- **Automated Reports**: Schedule email reports for longitudinal studies

## 🚀 Quick Start

### 1. Start Metabase

```bash
# Start Metabase and its PostgreSQL database
cd docker/compose
docker-compose -f docker-compose.metabase.yml up -d

# Check status
docker-compose -f docker-compose.metabase.yml ps

# View logs
docker-compose -f docker-compose.metabase.yml logs -f metabase
```

### 2. Access Metabase

Open your browser and navigate to: `http://localhost:3001`

### 3. Initial Setup

1. **Create Admin Account**:
   - Email: your-email@example.com
   - Password: (strong password)
   - First/Last Name: Your details

2. **Connect to Supabase Database**:
   ```
   Type: PostgreSQL
   Display Name: EMG Research Database
   Host: db.xxxxx.supabase.co
   Port: 5432 (or 6543 for pooled connections)
   Database: postgres
   Username: postgres (or read-only user)
   Password: [Your Supabase password]
   SSL: Required
   Additional options: sslmode=require
   ```

3. **Select Data Access**:
   - ✅ Include: `public` schema
   - ❌ Exclude: `auth`, `storage`, `graphql_public`

## 📈 Pre-Built Dashboard Templates

### 1. EMG Session Overview Dashboard

```sql
-- Sessions by Game Type
SELECT 
  c3d_metadata->>'gameName' as game_type,
  COUNT(*) as session_count,
  AVG(compliance_percentage) as avg_compliance
FROM sessions
GROUP BY game_type;

-- Muscle Activation Patterns
SELECT 
  muscle_name,
  AVG(mean_amplitude) as avg_activation,
  AVG(peak_amplitude) as peak_activation,
  COUNT(DISTINCT session_id) as sessions
FROM emg_analytics
GROUP BY muscle_name
ORDER BY avg_activation DESC;
```

### 2. Patient Progress Dashboard

```sql
-- Compliance Trend Over Time
SELECT 
  DATE(session_date) as date,
  AVG(compliance_percentage) as compliance,
  AVG(performance_analysis->>'overallScore') as performance
FROM sessions
WHERE patient_id = {{patient_id}}
GROUP BY date
ORDER BY date;

-- Muscle Fatigue Analysis
SELECT 
  muscle_name,
  median_power_frequency,
  mean_power_frequency,
  fatigue_index
FROM emg_analytics
WHERE session_id = {{session_id}}
ORDER BY muscle_name;
```

### 3. Research Analytics Dashboard

```sql
-- Contraction Quality Metrics
SELECT 
  muscle_name,
  COUNT(*) as total_contractions,
  AVG(mean_amplitude) as avg_amplitude,
  AVG(rms_value) as avg_rms,
  STDDEV(mean_amplitude) as amplitude_variability
FROM emg_analytics
JOIN sessions ON emg_analytics.session_id = sessions.id
WHERE sessions.created_at >= {{start_date}}
GROUP BY muscle_name;

-- Session Performance Distribution
SELECT 
  CASE 
    WHEN compliance_percentage >= 80 THEN 'Excellent'
    WHEN compliance_percentage >= 60 THEN 'Good'
    WHEN compliance_percentage >= 40 THEN 'Fair'
    ELSE 'Poor'
  END as performance_category,
  COUNT(*) as session_count
FROM sessions
GROUP BY performance_category;
```

## 🔬 Research-Specific Features

### 1. Custom Metrics

Create calculated fields for research-specific metrics:

- **MVC Percentage**: `(mean_amplitude / mvc_value) * 100`
- **Fatigue Rate**: `(initial_mpf - final_mpf) / session_duration`
- **Activation Symmetry**: `ABS(left_muscle - right_muscle) / AVG(left_muscle, right_muscle)`

### 2. Statistical Analysis

Metabase provides built-in statistical functions:

- **Descriptive Statistics**: Mean, Median, Standard Deviation
- **Trend Analysis**: Linear regression, moving averages
- **Comparative Analysis**: Period-over-period comparisons
- **Correlation Analysis**: Scatter plots and correlation matrices

### 3. Export Templates

Configure export templates for research papers:

```javascript
// Custom export format for research
{
  "format": "csv",
  "columns": [
    "patient_id",
    "session_date",
    "muscle_name",
    "mean_amplitude",
    "rms_value",
    "median_power_frequency",
    "fatigue_index",
    "compliance_percentage"
  ],
  "filters": {
    "date_range": "last_30_days",
    "min_compliance": 50
  }
}
```

## 🔐 Security Best Practices

### 1. Read-Only Database User

Create a read-only user in Supabase for Metabase:

```sql
-- In Supabase SQL Editor
CREATE ROLE metabase_reader WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE postgres TO metabase_reader;
GRANT USAGE ON SCHEMA public TO metabase_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metabase_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO metabase_reader;
```

### 2. Row-Level Security

Ensure RLS policies work with Metabase:

```sql
-- Example: Researchers see only their assigned patients
CREATE POLICY "Researchers see assigned patients"
ON sessions
FOR SELECT
TO metabase_reader
USING (
  patient_id IN (
    SELECT patient_id 
    FROM researcher_assignments 
    WHERE researcher_email = current_setting('metabase.user_email')
  )
);
```

### 3. Environment Variables

```bash
# docker/.env
METABASE_DB_USER=metabase_secure
METABASE_DB_PASS=strong_password_here
METABASE_ENCRYPTION_SECRET_KEY=your-32-char-secret-key
MB_EMBEDDING_SECRET_KEY=another-secret-for-embedding
```

## 📊 Advanced Analytics

### 1. Time Series Analysis

```sql
-- EMG Amplitude Trend with Moving Average
WITH amplitude_series AS (
  SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    muscle_name,
    AVG(mean_amplitude) as avg_amplitude
  FROM emg_analytics
  GROUP BY hour, muscle_name
)
SELECT 
  hour,
  muscle_name,
  avg_amplitude,
  AVG(avg_amplitude) OVER (
    PARTITION BY muscle_name 
    ORDER BY hour 
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) as moving_avg_7h
FROM amplitude_series;
```

### 2. Cohort Analysis

```sql
-- Patient Cohort Performance
WITH first_session AS (
  SELECT 
    patient_id,
    DATE_TRUNC('week', MIN(session_date)) as cohort_week
  FROM sessions
  GROUP BY patient_id
)
SELECT 
  cohort_week,
  weeks_since_start,
  AVG(compliance_percentage) as avg_compliance,
  COUNT(DISTINCT patient_id) as active_patients
FROM (
  SELECT 
    fs.cohort_week,
    EXTRACT(WEEK FROM s.session_date - fs.cohort_week) as weeks_since_start,
    s.patient_id,
    s.compliance_percentage
  FROM sessions s
  JOIN first_session fs ON s.patient_id = fs.patient_id
) cohort_data
GROUP BY cohort_week, weeks_since_start
ORDER BY cohort_week, weeks_since_start;
```

### 3. Machine Learning Integration

```python
# Export data from Metabase for ML analysis
import pandas as pd
import requests

# Metabase API endpoint
METABASE_URL = "http://localhost:3001/api"
API_KEY = "your-api-key"

# Query EMG data
response = requests.post(
    f"{METABASE_URL}/dataset",
    headers={"X-API-Key": API_KEY},
    json={
        "database": 1,
        "query": {
            "source-table": "emg_analytics"
        }
    }
)

df = pd.DataFrame(response.json()["data"]["rows"])
# Proceed with ML analysis...
```

## 🚢 Production Deployment

### Docker Compose Production

```yaml
# docker-compose.metabase.prod.yml
version: '3.8'

services:
  metabase:
    image: metabase/metabase:v0.48.0  # Pin version for production
    restart: always
    environment:
      MB_DB_CONNECTION_URI: ${METABASE_DATABASE_URL}
      MB_ENCRYPTION_SECRET_KEY: ${METABASE_ENCRYPTION_KEY}
      JAVA_OPTS: "-Xmx4g -XX:+UseG1GC"
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G
```

### Coolify Deployment

1. **Create Metabase Service** in Coolify
2. **Configure Environment Variables**
3. **Set Up SSL** with Let's Encrypt
4. **Configure Backups** for Metabase database
5. **Set Resource Limits** based on usage

## 📚 Resources

### Official Documentation
- [Metabase Documentation](https://www.metabase.com/docs/latest/)
- [Metabase API Reference](https://www.metabase.com/docs/latest/api-documentation)
- [SQL Query Guide](https://www.metabase.com/learn/sql-questions/)

### EMG-Specific Queries
- See `/docker/docs/metabase-queries/` for pre-built query templates
- Custom visualization examples in `/docker/docs/metabase-dashboards/`

### Integration Guides
- [Supabase + Metabase](https://supabase.com/docs/guides/integrations/metabase)
- [PostgreSQL SSL Configuration](https://www.metabase.com/docs/latest/databases/connections/postgresql)

## 🆘 Troubleshooting

### Connection Issues

```bash
# Test Supabase connection from Metabase container
docker exec -it emg-metabase bash
apt-get update && apt-get install -y postgresql-client
psql "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres?sslmode=require"
```

### Performance Optimization

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_sessions_date ON sessions(session_date);
CREATE INDEX idx_emg_muscle ON emg_analytics(muscle_name);
CREATE INDEX idx_emg_session ON emg_analytics(session_id);
```

### Memory Issues

```bash
# Increase Java heap size
docker-compose -f docker-compose.metabase.yml down
# Edit JAVA_OPTS in compose file to "-Xmx4g"
docker-compose -f docker-compose.metabase.yml up -d
```

---

## 📝 Notes for Researchers

1. **Data Privacy**: Always use anonymized patient IDs in dashboards
2. **Export Compliance**: Ensure exports comply with research protocols
3. **Version Control**: Save dashboard definitions in Git
4. **Collaboration**: Use Metabase collections to organize research projects
5. **Automation**: Schedule reports for regular data collection

For additional support, consult the Metabase community forum or your technical team.