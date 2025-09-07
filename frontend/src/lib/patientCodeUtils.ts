/**
 * Patient Code Utilities
 * 
 * Utility functions for extracting, validating, and working with patient codes
 * in the EMG C3D Analyzer system.
 */

/**
 * Extract patient code from various sources
 */
export const PatientCodeExtractor = {
  /**
   * Extract patient code from file path
   * Matches patterns like P001, P123, etc.
   */
  fromFilePath(filePath: string): string | null {
    if (!filePath) return null

    // Match pattern: P followed by 3+ digits (case insensitive)
    const match = filePath.match(/P\d{3,}/i)
    return match ? match[0].toUpperCase() : null
  },

  /**
   * Extract patient code from filename
   */
  fromFileName(fileName: string): string | null {
    return this.fromFilePath(fileName)
  },

  /**
   * Extract patient code from session metadata
   */
  fromSessionData(sessionData: { 
    patient_id?: string
    patient_code?: string
    file_path?: string
    metadata?: Record<string, any>
  }): string | null {
    // Direct patient_code field
    if (sessionData.patient_code) {
      return sessionData.patient_code.toUpperCase()
    }

    // From file_path
    if (sessionData.file_path) {
      return this.fromFilePath(sessionData.file_path)
    }

    // From metadata
    if (sessionData.metadata?.patient_code) {
      return sessionData.metadata.patient_code.toString().toUpperCase()
    }

    return null
  },

  /**
   * Extract patient code from C3D file metadata
   */
  fromC3DMetadata(metadata: Record<string, any>): string | null {
    // Common metadata fields that might contain patient code
    const fields = [
      'patient_code',
      'patient_id',
      'subject_code',
      'subject_id',
      'participant_code',
      'participant_id'
    ]

    for (const field of fields) {
      const value = metadata[field]
      if (value) {
        const strValue = value.toString().toUpperCase()
        // Validate it looks like a patient code
        if (this.isValidPatientCode(strValue)) {
          return strValue
        }
      }
    }

    return null
  },

  /**
   * Extract multiple patient codes from batch data
   */
  /**
   * Validate if a string looks like a patient code
   */
  isValidPatientCode(code: string): boolean {
    // P followed by 2-4 digits (P01, P001, P0001, etc.)
    const pattern = /^P\d{2,4}$/i
    return pattern.test(code)
  },

  fromBatch(items: Array<{ filePath?: string, fileName?: string, metadata?: Record<string, any> }>): string[] {
    const codes = new Set<string>()

    for (const item of items) {
      const code = item.filePath 
        ? this.fromFilePath(item.filePath)
        : item.fileName 
          ? this.fromFileName(item.fileName)
          : item.metadata 
            ? this.fromC3DMetadata(item.metadata)
            : null

      if (code) {
        codes.add(code)
      }
    }

    return Array.from(codes).sort()
  }
}

/**
 * Patient code validation
 */
export const PatientCodeValidator = {
  /**
   * Check if string looks like a valid patient code
   */
  isValidPatientCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false

    // Must start with P and have 3+ digits
    return /^P\d{3,}$/i.test(code.trim())
  },

  /**
   * Validate and normalize patient code
   */
  normalize(code: string): string | null {
    if (!code || typeof code !== 'string') return null

    const trimmed = code.trim().toUpperCase()
    
    if (this.isValidPatientCode(trimmed)) {
      return trimmed
    }

    // Try to fix common issues
    const fixed = trimmed.replace(/[^P\d]/g, '') // Remove non-P, non-digit chars
    
    if (this.isValidPatientCode(fixed)) {
      return fixed
    }

    return null
  },

  /**
   * Batch validation
   */
  validateBatch(codes: string[]): { valid: string[], invalid: string[] } {
    const valid: string[] = []
    const invalid: string[] = []

    for (const code of codes) {
      const normalized = this.normalize(code)
      if (normalized) {
        valid.push(normalized)
      } else {
        invalid.push(code)
      }
    }

    return { valid, invalid }
  }
}

/**
 * Patient code formatting for display
 */
export const PatientCodeFormatter = {
  /**
   * Format patient code for display with optional styling
   */
  forDisplay(code: string | null, options: {
    showPrefix?: boolean
    zeroPadding?: number
    separator?: string
  } = {}): string {
    if (!code || !PatientCodeValidator.isValidPatientCode(code)) {
      return 'Unknown Patient'
    }

    const {
      showPrefix = true,
      zeroPadding = 0,
      separator = ''
    } = options

    const normalized = code.toUpperCase()
    const prefix = normalized.charAt(0) // 'P'
    const number = normalized.slice(1) // '001', '123', etc.

    // Apply zero padding if requested
    const paddedNumber = zeroPadding > 0 
      ? number.padStart(zeroPadding, '0')
      : number

    if (showPrefix) {
      return `${prefix}${separator}${paddedNumber}`
    } else {
      return paddedNumber
    }
  },

  /**
   * Format for file names (safe characters only)
   */
  forFileName(code: string | null): string {
    if (!code || !PatientCodeValidator.isValidPatientCode(code)) {
      return 'unknown_patient'
    }

    return code.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  },

  /**
   * Format for URLs (URL-safe)
   */
  forUrl(code: string | null): string {
    if (!code || !PatientCodeValidator.isValidPatientCode(code)) {
      return 'unknown'
    }

    return encodeURIComponent(code.toUpperCase())
  },

  /**
   * Format list of patient codes for display
   */
  formatList(codes: string[], options: {
    separator?: string
    maxDisplay?: number
    showCount?: boolean
  } = {}): string {
    const {
      separator = ', ',
      maxDisplay = 5,
      showCount = true
    } = options

    const validCodes = codes.filter(code => PatientCodeValidator.isValidPatientCode(code))
    
    if (validCodes.length === 0) {
      return 'No patients'
    }

    const displayCodes = validCodes.slice(0, maxDisplay)
    const formatted = displayCodes.map(code => this.forDisplay(code)).join(separator)

    if (validCodes.length > maxDisplay) {
      const remaining = validCodes.length - maxDisplay
      return `${formatted}${separator}+${remaining} more`
    }

    if (showCount && validCodes.length > 1) {
      return `${formatted} (${validCodes.length} patients)`
    }

    return formatted
  }
}

/**
 * Patient code sorting and grouping
 */
export const PatientCodeSorter = {
  /**
   * Sort patient codes numerically
   */
  sort(codes: string[]): string[] {
    return codes
      .filter(code => PatientCodeValidator.isValidPatientCode(code))
      .sort((a, b) => {
        // Extract numbers for proper numerical sorting
        const numA = parseInt(a.slice(1), 10)
        const numB = parseInt(b.slice(1), 10)
        return numA - numB
      })
  },

  /**
   * Group codes by numeric ranges
   */
  groupByRange(codes: string[], rangeSize: number = 100): Record<string, string[]> {
    const groups: Record<string, string[]> = {}
    
    const validCodes = codes.filter(code => PatientCodeValidator.isValidPatientCode(code))
    
    for (const code of validCodes) {
      const num = parseInt(code.slice(1), 10)
      const rangeStart = Math.floor(num / rangeSize) * rangeSize
      const rangeEnd = rangeStart + rangeSize - 1
      const rangeKey = `P${rangeStart.toString().padStart(3, '0')}-P${rangeEnd.toString().padStart(3, '0')}`
      
      if (!groups[rangeKey]) {
        groups[rangeKey] = []
      }
      groups[rangeKey].push(code)
    }

    // Sort within each group
    Object.keys(groups).forEach(key => {
      groups[key] = this.sort(groups[key])
    })

    return groups
  }
}

/**
 * Patient code statistics
 */
export const PatientCodeStats = {
  /**
   * Generate statistics for a list of patient codes
   */
  analyze(codes: string[]): {
    total: number
    valid: number
    invalid: number
    range: { min: number | null, max: number | null }
    gaps: number[]
    duplicates: string[]
  } {
    const { valid, invalid } = PatientCodeValidator.validateBatch(codes)
    
    // Find duplicates
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const code of codes) {
      if (seen.has(code)) {
        duplicates.push(code)
      } else {
        seen.add(code)
      }
    }

    // Find range and gaps
    const numbers = valid.map(code => parseInt(code.slice(1), 10)).sort((a, b) => a - b)
    const range = numbers.length > 0 
      ? { min: numbers[0], max: numbers[numbers.length - 1] }
      : { min: null, max: null }

    // Find gaps in sequence
    const gaps: number[] = []
    if (numbers.length > 1) {
      for (let i = 1; i < numbers.length; i++) {
        const current = numbers[i]
        const previous = numbers[i - 1]
        if (current - previous > 1) {
          for (let gap = previous + 1; gap < current; gap++) {
            gaps.push(gap)
          }
        }
      }
    }

    return {
      total: codes.length,
      valid: valid.length,
      invalid: invalid.length,
      range,
      gaps,
      duplicates
    }
  }
}

/**
 * Main utility object combining all patient code functions
 */
export const PatientCodeUtils = {
  extract: PatientCodeExtractor,
  validate: PatientCodeValidator,
  format: PatientCodeFormatter,
  sort: PatientCodeSorter,
  stats: PatientCodeStats,

  /**
   * Quick extraction from common sources
   */
  quickExtract(input: string | { filePath?: string, fileName?: string, metadata?: Record<string, any> }): string | null {
    if (typeof input === 'string') {
      return PatientCodeExtractor.fromFilePath(input)
    }

    return PatientCodeExtractor.fromSessionData(input)
  },

  /**
   * Safe patient code for UI display
   */
  safeDisplay(code: string | null): string {
    return PatientCodeFormatter.forDisplay(code)
  },

  /**
   * Check if patient code is valid
   */
  isValid(code: string | null): boolean {
    return code ? PatientCodeValidator.isValidPatientCode(code) : false
  }
}

export default PatientCodeUtils