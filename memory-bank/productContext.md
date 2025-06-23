# Product Context

## Problem Space
The EMG C3D Analyzer addresses the critical need for automated analysis of EMG data in rehabilitation settings. It specifically integrates with the GHOSTLY rehabilitation game platform to provide:

1. Real-time EMG signal processing
2. Automated muscle contraction detection
3. Progress tracking for rehabilitation patients
4. Data-driven insights for therapists
5. Enhanced clinical metrics for rehabilitation assessment

## User Experience Goals

### For Therapists
- Quick upload and processing of C3D files
- Clear visualization of EMG data with clinically relevant metrics
- Easy access to patient progress
- Automated report generation
- Intuitive interface for data analysis
- Fast and reliable data retrieval
- Improved assessment of contraction quality and fatigue
- Better visualization of muscle activity patterns
- Integration of standardized clinical assessment scales

### For Researchers
- Access to raw EMG data
- Detailed analytics and metrics
- Advanced temporal analysis of EMG parameters
- Batch processing capabilities
- Data export functionality
- Customizable analysis parameters

## Core Workflows

### Data Processing Workflow
1. Upload C3D file through API
2. Automatic extraction of EMG data
3. Comprehensive signal processing and contraction detection
4. Advanced analytics calculation including temporal analysis
5. Complete data returned to frontend for visualization
6. Client-side plotting and interactive data exploration

### Patient Monitoring Workflow
1. Associate data with patient ID
2. Track multiple sessions over time
3. Compare progress across sessions
4. Generate progress reports
5. Store patient-specific analytics
6. Record subjective patient-reported outcomes

## Key Features

### EMG Analysis
- Multi-channel EMG data processing
- Configurable contraction detection
- Signal smoothing and filtering
- Peak detection and analysis
- Duration and amplitude calculations
- Calculation of Root Mean Square (RMS)
- Calculation of Mean Absolute Value (MAV)
- Calculation of spectral fatigue parameters (MPF, MDF)
- Calculation of Dimitrov's Fatigue Index (FI_nsm5)
- Enhanced temporal analysis of EMG parameters
- Statistical metrics for clinical assessment (mean, std, coefficient of variation)

### Visualization
- RMS envelope as primary signal display
- Optional raw EMG display
- Contraction period visualization
- Interactive charts with zoom/pan functionality
- MVC threshold reference lines
- Progress tracking charts
- Client-side plot generation with Recharts

### Clinical Assessment
- Borg CR10 Scale for Rating of Perceived Exertion (RPE)
- Subjective exertion level visualization (0-10 scale)
- Statistical representation of EMG metrics (mean ± standard deviation)
- Muscle symmetry analysis
- Performance scoring based on clinical parameters

### Data Management
- Stateless backend processing
- Efficient data bundling in API responses
- Patient data organization
- Session tracking
- Result caching
- Data cleanup utilities

## Integration Points

### GHOSTLY Game Platform
- C3D file format compatibility
- Game metadata extraction
- Score integration
- Session tracking
- Player identification

### External Systems
- RESTful API access
- Standardized data formats
- Authentication support
- Bulk data operations
- Error handling and validation 

## Clinical Relevance

### Enhanced Assessment
- Improved contraction detection algorithms
- Better fatigue estimation through multiple metrics
- Statistical analysis of EMG parameters over time
- Clearer visualization of muscle activity patterns
- Standardized subjective exertion measurement using Borg CR10 Scale

### Rehabilitation Focus
- Assessment of contraction quality based on MVC thresholds
- Tracking of patient adherence and progress
- Quantification of rehabilitation session effectiveness
- Support for clinical decision-making
- Correlation of objective EMG data with subjective patient-reported outcomes 