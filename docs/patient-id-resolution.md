# Patient ID Resolution Strategy

## Overview

The EMG C3D Analyzer implements a flexible Patient ID resolution system that accommodates different data organization patterns and metadata availability. This document outlines the logic and fallback mechanisms used to determine patient identification across the application.

## Resolution Hierarchy

The Patient ID is determined using the following priority order:

### 1. Game Metadata (Primary Source)
**Source**: C3D file analysis metadata  
**Field**: `metadata.player_name`  
**Context**: Available after C3D file processing  
**Reliability**: High - directly from the therapeutic session data  

```typescript
// From EMGAnalysisResult.metadata
interface GameMetadata {
  player_name?: string | null;
  // ... other metadata fields
}
```

### 2. Supabase Storage Folder Structure (Secondary Source)
**Source**: Supabase Storage bucket organization  
**Field**: Parent folder name in storage path  
**Context**: Available during file listing/browsing  
**Reliability**: Medium - depends on proper file organization  

```typescript
// Future implementation - extract patient ID from folder structure
// Example: /bucket/patient-123/session-data/file.c3d → Patient ID: "patient-123"
const extractPatientIdFromPath = (filePath: string): string | null => {
  const pathSegments = filePath.split('/');
  // Implement folder-based patient ID extraction logic
  return pathSegments[1] || null; // Assuming second segment is patient folder
};
```

### 3. Explicit Storage Metadata (Fallback Source)
**Source**: Supabase Storage file metadata  
**Field**: `patient_id` in file metadata  
**Context**: Set during file upload or manual assignment  
**Reliability**: Medium - depends on manual data entry  

```typescript
// From C3DFileInfo
interface C3DFileInfo {
  patient_id?: string;
  // ... other file info fields
}
```

## Implementation Strategy

### Current Implementation

**File Browser (`C3DFileBrowser.tsx`)**:
- Displays `patient_id` from storage metadata
- Shows "Unknown" when no patient information available
- Provides filtering capabilities based on available patient data

**Analysis Results (`FileMetadataBar.tsx`)**:
- Primary: Uses `metadata.player_name` from C3D analysis
- Fallback: Uses `patient_id` from storage metadata
- Implementation: `{metadata?.player_name || patient_id || 'Unknown'}`

### Future Enhancement Plan

```typescript
// Proposed patient ID resolution service
class PatientIdResolver {
  /**
   * Resolves patient ID using the established hierarchy
   */
  static resolvePatientId(context: {
    gameMetadata?: GameMetadata;
    storageMetadata?: C3DFileInfo;
    filePath?: string;
  }): PatientIdResolution {
    
    // 1. Check game metadata (highest priority)
    if (context.gameMetadata?.player_name) {
      return {
        patientId: context.gameMetadata.player_name,
        source: 'game_metadata',
        confidence: 'high'
      };
    }
    
    // 2. Extract from folder structure (medium priority)
    if (context.filePath) {
      const folderPatientId = this.extractFromFolderStructure(context.filePath);
      if (folderPatientId) {
        return {
          patientId: folderPatientId,
          source: 'folder_structure',
          confidence: 'medium'
        };
      }
    }
    
    // 3. Use explicit storage metadata (fallback)
    if (context.storageMetadata?.patient_id) {
      return {
        patientId: context.storageMetadata.patient_id,
        source: 'storage_metadata',
        confidence: 'medium'
      };
    }
    
    // 4. No patient ID available
    return {
      patientId: null,
      source: 'none',
      confidence: 'none'
    };
  }

  private static extractFromFolderStructure(filePath: string): string | null {
    // Implementation depends on agreed folder structure convention
    // Example: /bucket/PATIENT-001/sessions/2024-01-15/data.c3d
    const pathPattern = /\/([A-Z0-9-]+)\/(?:sessions?|data)/i;
    const match = filePath.match(pathPattern);
    return match ? match[1] : null;
  }
}

interface PatientIdResolution {
  patientId: string | null;
  source: 'game_metadata' | 'folder_structure' | 'storage_metadata' | 'none';
  confidence: 'high' | 'medium' | 'low' | 'none';
}
```

## Data Flow Integration

### File Upload Process
1. **Upload**: File stored in appropriate patient folder structure
2. **Metadata Extraction**: Patient ID extracted from folder path and stored in metadata
3. **Analysis**: C3D analysis may override with `player_name` from game data

### File Browsing Process
1. **Listing**: Show patient ID from storage metadata or folder structure
2. **Selection**: Provide patient context for filtering and organization
3. **Analysis**: Enhanced patient identification after C3D processing

### User Interface Presentation
- **File Browser**: Show best available patient ID with source indication
- **Analysis Results**: Prioritize game metadata, show confidence indicator
- **Filtering**: Support filtering by any available patient identification method

## Error Handling & Edge Cases

### Missing Patient Information
- Display "Unknown" with appropriate UI indication
- Provide manual patient ID assignment interface
- Log missing patient ID events for data quality monitoring

### Conflicting Patient IDs
- Prioritize game metadata over other sources
- Display conflict warnings in development mode
- Provide administrative override capabilities

### Folder Structure Variations
- Support multiple folder naming conventions
- Implement flexible pattern matching
- Provide configuration for custom folder structures

## Technical Considerations

### Performance
- Cache patient ID resolutions to avoid repeated processing
- Implement lazy loading for folder structure analysis
- Optimize metadata queries for large file collections

### Data Quality
- Validate patient ID formats and consistency
- Implement data quality metrics and reporting
- Provide data cleanup and normalization tools

### Privacy & Security
- Ensure patient ID handling complies with privacy regulations
- Implement proper access controls for patient data
- Consider patient ID anonymization/pseudonymization strategies

## Configuration

```typescript
// Configuration interface for patient ID resolution
interface PatientIdConfig {
  folderStructure: {
    enabled: boolean;
    pattern: string; // RegExp pattern for folder structure
    patientIdPosition: number; // Which capture group contains patient ID
  };
  
  gameMetadata: {
    enabled: boolean;
    fieldName: string; // Field name in game metadata (default: 'player_name')
  };
  
  storageMetadata: {
    enabled: boolean;
    fieldName: string; // Field name in storage metadata (default: 'patient_id')
  };
  
  fallbackBehavior: 'unknown' | 'generate' | 'prompt';
}
```

## Migration Strategy

### Phase 1: Documentation & Interface Definition
- Document current behavior and future requirements
- Define TypeScript interfaces for patient ID resolution
- Create configuration structure for flexible implementation

### Phase 2: Enhanced Resolution Service
- Implement `PatientIdResolver` service with all resolution methods
- Add folder structure parsing capabilities
- Integrate with existing file browser and analysis components

### Phase 3: User Interface Enhancements
- Add patient ID source indicators in UI
- Implement patient ID conflict resolution interface
- Provide manual patient ID assignment tools

### Phase 4: Data Quality & Analytics
- Implement patient ID resolution analytics
- Add data quality monitoring and reporting
- Provide administrative tools for patient ID management

---

## Related Documentation

- [Database Schema](./db_schema.md) - Patient data storage structure
- [API Documentation](./api.md) - Patient ID endpoints and responses
- [File Storage Organization](./storage-organization.md) - Supabase bucket structure guidelines