# EMG Analytics - Researcher's Guide

## 🔬 Research Analytics Platform Overview

This guide helps researchers leverage the EMG C3D Analyzer platform with Metabase for comprehensive data analysis and visualization without requiring programming knowledge.

## 📊 Getting Started with Analytics

### Step 1: Access the Analytics Platform

```bash
# Start the analytics platform
cd docker/compose
docker-compose -f docker-compose.metabase.yml up -d

# Access Metabase
# Open browser: http://localhost:3001
# Login with your researcher credentials
```

### Step 2: Understanding Your Data Structure

#### Core Tables for Research

1. **sessions** - All therapy sessions
   - `id`: Unique session identifier
   - `patient_id`: Anonymized patient ID
   - `session_date`: When session occurred
   - `compliance_percentage`: Adherence to protocol
   - `c3d_metadata`: Game parameters and settings

2. **emg_analytics** - Processed EMG metrics
   - `muscle_name`: Targeted muscle
   - `mean_amplitude`: Average EMG amplitude
   - `rms_value`: Root Mean Square value
   - `median_power_frequency`: Fatigue indicator
   - `contraction_count`: Number of contractions

3. **session_parameters** - MVC and thresholds
   - `mvc_values`: Maximum voluntary contraction
   - `thresholds`: Detection thresholds
   - `filtering_params`: Signal processing settings

## 📈 Pre-Built Research Dashboards

### 1. Patient Progress Monitor

Track individual patient progress over time:

**Metrics Included:**
- Compliance trends
- Muscle activation patterns
- Fatigue progression
- Session consistency

**How to Use:**
1. Navigate to Dashboards → Patient Progress
2. Select patient ID from dropdown
3. Adjust date range as needed
4. Export results using the download button

### 2. Cohort Comparison Dashboard

Compare groups of patients:

**Metrics Included:**
- Average compliance by group
- Muscle activation differences
- Recovery patterns
- Statistical significance tests

**How to Use:**
1. Navigate to Dashboards → Cohort Analysis
2. Define cohort criteria (age, condition, etc.)
3. Select comparison metrics
4. Generate comparative visualizations

### 3. Longitudinal Study Tracker

Monitor long-term trends:

**Metrics Included:**
- Weekly/monthly aggregations
- Trend lines with confidence intervals
- Seasonal patterns
- Progress milestones

## 🔍 Creating Custom Analyses

### Basic Query Builder (No SQL Required)

1. **Select Your Data Source**
   - Click "New" → "Question"
   - Choose "Simple Question"
   - Select table (e.g., "EMG Analytics")

2. **Filter Your Data**
   - Add filters for date ranges
   - Filter by patient or muscle
   - Set compliance thresholds

3. **Choose Visualizations**
   - Line charts for trends
   - Bar charts for comparisons
   - Scatter plots for correlations
   - Tables for detailed data

### Example Research Questions

#### Question 1: "What is the average muscle fatigue across all sessions?"

**Steps:**
1. Select `emg_analytics` table
2. Summarize → Average of `median_power_frequency`
3. Group by `muscle_name`
4. Visualize as bar chart

#### Question 2: "How does compliance change over time?"

**Steps:**
1. Select `sessions` table
2. Summarize → Average of `compliance_percentage`
3. Group by `session_date` (by week)
4. Visualize as line chart

#### Question 3: "Which muscles show the most activation?"

**Steps:**
1. Select `emg_analytics` table
2. Summarize → Average of `mean_amplitude`
3. Group by `muscle_name`
4. Sort descending
5. Visualize as horizontal bar chart

## 📊 Statistical Analysis Features

### Built-in Statistics

Metabase provides these statistical functions:
- **Mean, Median, Mode**
- **Standard Deviation**
- **Percentiles (25th, 75th, 90th)**
- **Min/Max values**
- **Count and Distinct Count**

### Trend Analysis

1. **Linear Regression**
   - Available in trend line settings
   - Shows equation and R² value

2. **Moving Averages**
   - Smooth out daily variations
   - 7-day or 30-day windows

3. **Period Comparisons**
   - Compare to previous period
   - Year-over-year analysis

## 📥 Exporting Data for Publication

### Export Formats

1. **CSV Export**
   - Best for Excel and statistical software
   - Preserves all decimal places
   - Includes headers

2. **Excel Export**
   - Formatted for immediate use
   - Multiple sheets support
   - Charts included

3. **JSON Export**
   - For programmatic analysis
   - Preserves data types
   - Nested structure maintained

### Publication-Ready Exports

**Steps for Clean Export:**
1. Create your visualization
2. Click "Download results"
3. Choose "Formatting options"
4. Select:
   - ✅ Include column headers
   - ✅ Use scientific notation
   - ✅ Limit decimal places (3-4)
5. Download as CSV

### Automated Reports

**Setting Up Weekly Reports:**
1. Create dashboard with key metrics
2. Click "Subscription" → "Email this dashboard"
3. Set schedule (e.g., Every Monday 9 AM)
4. Add recipient emails
5. Choose format (PDF or CSV attachment)

## 🔒 Data Privacy & Compliance

### Best Practices

1. **Patient Anonymization**
   - Always use patient IDs, never names
   - Don't include identifying information
   - Apply date shifting if needed

2. **Access Control**
   - Request appropriate permissions
   - Don't share login credentials
   - Log out when finished

3. **Export Guidelines**
   - Check institutional policies
   - Ensure HIPAA compliance
   - Document data usage

## 💡 Advanced Research Techniques

### 1. Correlation Analysis

Find relationships between variables:

```
X-axis: session_parameters.mvc_values
Y-axis: emg_analytics.mean_amplitude
Bubble size: compliance_percentage
```

### 2. Outlier Detection

Identify unusual patterns:

1. Create box plot visualization
2. Look for points outside whiskers
3. Investigate anomalies
4. Document findings

### 3. Comparative Effectiveness

Compare treatment protocols:

1. Segment by `c3d_metadata.gameName`
2. Compare outcome metrics
3. Apply statistical tests
4. Report significance levels

## 📚 Research Templates

### Template 1: Clinical Trial Report

**Sections:**
- Patient Demographics
- Compliance Statistics
- Primary Outcomes (EMG metrics)
- Secondary Outcomes (fatigue, duration)
- Adverse Events
- Statistical Analysis

### Template 2: Case Study Analysis

**Sections:**
- Patient Background
- Session Timeline
- Muscle Activation Patterns
- Progress Visualization
- Clinical Observations
- Conclusions

### Template 3: Comparative Study

**Sections:**
- Cohort Definitions
- Baseline Characteristics
- Intervention Details
- Outcome Measures
- Statistical Comparisons
- Discussion Points

## 🛠️ Troubleshooting Common Issues

### Issue: "No data available"

**Solutions:**
- Check date range filters
- Verify patient ID exists
- Ensure data has been processed
- Refresh database schema

### Issue: "Slow dashboard loading"

**Solutions:**
- Reduce date range
- Limit number of visualizations
- Use data aggregation
- Cache frequently used queries

### Issue: "Cannot export data"

**Solutions:**
- Check browser permissions
- Try different export format
- Reduce data size
- Clear browser cache

## 📞 Support Resources

### Technical Support
- Platform documentation: `/docker/docs/`
- Metabase guides: [metabase.com/learn](https://www.metabase.com/learn/)
- Contact IT support: support@example.com

### Research Collaboration
- Share dashboards with team
- Create research collections
- Set up automated alerts
- Schedule regular reports

## 🎯 Quick Reference

### Essential Metrics

| Metric | Table | Column | Clinical Significance |
|--------|-------|--------|----------------------|
| Muscle Activation | emg_analytics | mean_amplitude | Strength indicator |
| Muscle Fatigue | emg_analytics | median_power_frequency | Endurance measure |
| Compliance | sessions | compliance_percentage | Protocol adherence |
| Contraction Quality | emg_analytics | rms_value | Signal quality |
| Session Duration | sessions | duration_seconds | Engagement level |

### Keyboard Shortcuts

- `Cmd/Ctrl + K`: Quick search
- `Cmd/Ctrl + Enter`: Run query
- `Cmd/Ctrl + S`: Save question
- `Cmd/Ctrl + D`: Duplicate
- `Esc`: Cancel operation

### SQL Snippets for Advanced Users

```sql
-- Patient summary statistics
SELECT 
  patient_id,
  COUNT(*) as total_sessions,
  AVG(compliance_percentage) as avg_compliance,
  MAX(session_date) as last_session
FROM sessions
GROUP BY patient_id
ORDER BY avg_compliance DESC;

-- Muscle activation heatmap data
SELECT 
  muscle_name,
  DATE_TRUNC('week', session_date) as week,
  AVG(mean_amplitude) as avg_activation
FROM emg_analytics ea
JOIN sessions s ON ea.session_id = s.id
GROUP BY muscle_name, week
ORDER BY week, muscle_name;
```

---

**Remember**: This platform is designed to make EMG data analysis accessible. Start with pre-built dashboards, then gradually explore custom analyses as you become comfortable with the interface.