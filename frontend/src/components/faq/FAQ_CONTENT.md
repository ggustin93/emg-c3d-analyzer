# FAQ Content

## Getting Started

### What is the EMG C3D Analyzer?
**Roles:** all  
**Keywords:** introduction, overview, about, platform  
**Category:** getting-started  

The **EMG C3D Analyzer** is a rehabilitation technology platform designed to process C3D files from the GHOSTLY+ game.

Key Features:
- **EMG Data Extraction**: Automatically extracts electromyography data from C3D files
- **Clinical Analysis**: Provides detailed analysis for therapeutic assessment
- **Patient Management**: Track patient progress over multiple sessions
- **Export Capabilities**: Export data in CSV format for further analysis

### How do I log in to the system?
**Roles:** all  
**Keywords:** login, sign in, access, authentication  
**Category:** getting-started  

To access the EMG C3D Analyzer:
1. Navigate to the login page
2. Enter your **email address** and **password**
3. Click the **"Sign in"** button

User Roles:
- **Therapist**: Full access to patient management and session analysis
- **Researcher**: Access to anonymized session data for research
- **Admin**: System administration and user management

## Patient Management

### How do I add a new patient?
**Roles:** therapist  
**Keywords:** add, create, new, patient, registration  
**Category:** patients  

To add a new patient:
1. Navigate to the **Patients** tab
2. Click the **"Add Patient"** button
3. Fill in the required information
4. Click **"Save"**

### What do the different patient avatar colors mean?
**Roles:** therapist  
**Keywords:** avatar, colors, identification, visual  
**Category:** patients  

The patient avatar colors are automatically assigned to help visually distinguish between different patients. Colors are generated based on the patient's name and have no clinical meaning - they're simply a visual aid for easier navigation.

### Why can't I see patient names?
**Roles:** researcher  
**Keywords:** anonymized, privacy, researcher, names  
**Category:** patients  

As a researcher, you have access to anonymized data only to protect patient privacy. You can see patient codes and session data, but personal identifying information is hidden for privacy compliance.

### How do I add clinical notes to a patient?
**Roles:** therapist  
**Keywords:** clinical, notes, therapist  
**Category:** patients  

To add clinical notes:
1. Go to **Patients** tab
2. Click on a patient to open their profile
3. Click **Add Clinical Note** button
4. Enter your observations
5. Click **Save**

## Session Analysis

### How do I upload and analyze a C3D file?
**Roles:** all  
**Keywords:** upload, c3d, file, analysis, process  
**Category:** sessions  

To upload and analyze a C3D file:
1. Go to the **Sessions** tab
2. Click **"Upload C3D File"** button
3. Select your C3D file from your computer
4. The system automatically processes the file

The system supports up to 16 EMG channels and automatically identifies muscle contractions.

### What EMG metrics are calculated?
**Roles:** all  
**Keywords:** metrics, emg, analysis, calculations, measurements  
**Category:** sessions  

The system calculates:
- **RMS** (Root Mean Square)
- **MAV** (Mean Absolute Value)  
- **MPF** (Mean Power Frequency)
- **MDF** (Median Frequency)
- **Contraction Duration**
- **Fatigue Index**
- **Compliance Score**

## Data Export

### How do I export session data?
**Roles:** all  
**Keywords:** export, csv, download, data, report  
**Category:** export  

To export session data:
1. Navigate to the session you want to export
2. Click the **"Export"** button
3. Choose your export format (CSV Detailed or CSV Summary)

The export includes patient information (anonymized for researchers), session metadata, EMG channel data, and calculated metrics.

## Technical Support

### What browsers are supported?
**Roles:** all  
**Keywords:** browser, compatibility, chrome, firefox, safari  
**Category:** technical  

Recommended browsers:
- **Chrome** (version 90+)
- **Firefox** (version 88+)
- **Safari** (version 14+)
- **Edge** (version 90+)

Internet Explorer is not supported. For best experience, keep your browser updated and use a screen resolution of 1366×768 or higher.

### How is patient data protected?
**Roles:** all  
**Keywords:** security, privacy, data protection, encryption, gdpr, hipaa  
**Category:** technical  

Security measures include:
- All data is encrypted in transit and at rest
- Role-based access control (RBAC)
- GDPR compliant
- Automatic daily backups

### How do I manage user accounts?
**Roles:** admin  
**Keywords:** admin, users, accounts, management  
**Category:** technical  

As an admin, you can:
1. Go to **Admin Dashboard**
2. Click **Users** tab
3. Create new users, edit roles, reset passwords, or deactivate accounts