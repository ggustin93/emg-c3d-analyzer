import { useState, useCallback, useRef } from 'react'
import { ClinicalNotesService } from '../services/clinicalNotesService'
import type {
  ClinicalNote,
  ClinicalNoteWithPatientCode,
  NotesIndicators,
  ClinicalNotesError,
  UseNotesReturn
} from '../types/clinical-notes'

/**
 * Clinical Notes Hook
 * 
 * React hook for managing Clinical Notes state and operations.
 * Provides CRUD operations, indicators loading, and error handling.
 */
export const useClinicalNotes = (): UseNotesReturn => {
  // State management
  const [notes, setNotes] = useState<ClinicalNoteWithPatientCode[]>([])
  const [indicators, setIndicators] = useState<NotesIndicators | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ClinicalNotesError | null>(null)

  // Ref to track active operations for cleanup
  const activeOperations = useRef(new Set<string>())

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Handle API errors consistently
   */
  const handleError = useCallback((err: unknown, operation: string) => {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    const clinicalError: ClinicalNotesError = {
      error: 'API_ERROR',
      message: `${operation}: ${errorMessage}`,
      details: { operation, timestamp: new Date().toISOString() }
    }
    
    setError(clinicalError)
    console.error(`Clinical Notes ${operation} error:`, err)
    return clinicalError
  }, [])

  /**
   * Wrap async operations with loading and error handling
   * Fixed loading state management with timeout protection
   */
  const withLoadingAndError = useCallback(async <T>(
    operation: string,
    asyncFn: () => Promise<T>
  ): Promise<T | null> => {
    const operationId = `${operation}-${Date.now()}`
    
    try {
      activeOperations.current.add(operationId)
      setLoading(true)
      clearError()
      
      const result = await asyncFn()
      return result
    } catch (err) {
      handleError(err, operation)
      return null
    } finally {
      activeOperations.current.delete(operationId)
      
      // Set loading to false immediately after operation completes
      // Use setTimeout to avoid race conditions with React state updates
      setTimeout(() => {
        if (activeOperations.current.size === 0) {
          setLoading(false)
        }
      }, 0)
    }
  }, [clearError, handleError])

  /**
   * Create a file note
   */
  const createFileNote = useCallback(async (
    filePath: string,
    content: string
  ): Promise<ClinicalNote> => {
    const validation = ClinicalNotesService.validateNoteContent(content)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const result = await withLoadingAndError(
      'Create file note',
      () => ClinicalNotesService.createFileNote(filePath, content)
    )

    if (!result) {
      throw new Error('Failed to create file note')
    }

    return result
  }, [withLoadingAndError])

  /**
   * Create a patient note
   */
  const createPatientNote = useCallback(async (
    patientCode: string,
    content: string
  ): Promise<ClinicalNote> => {
    const validation = ClinicalNotesService.validateNoteContent(content)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const result = await withLoadingAndError(
      'Create patient note',
      () => ClinicalNotesService.createPatientNote(patientCode, content)
    )

    if (!result) {
      throw new Error('Failed to create patient note')
    }

    return result
  }, [withLoadingAndError])

  /**
   * Get file notes
   */
  const getFileNotes = useCallback(async (
    filePath: string
  ): Promise<ClinicalNoteWithPatientCode[]> => {
    const result = await withLoadingAndError(
      'Get file notes',
      async () => {
        const fetchedNotes = await ClinicalNotesService.getFileNotes(filePath)
        setNotes(fetchedNotes)
        return fetchedNotes
      }
    )

    return result || []
  }, [withLoadingAndError])

  /**
   * Get patient notes
   */
  const getPatientNotes = useCallback(async (
    patientCode: string
  ): Promise<ClinicalNoteWithPatientCode[]> => {
    const result = await withLoadingAndError(
      'Get patient notes',
      async () => {
        const fetchedNotes = await ClinicalNotesService.getPatientNotes(patientCode)
        setNotes(fetchedNotes)
        return fetchedNotes
      }
    )

    return result || []
  }, [withLoadingAndError])

  /**
   * Update a note
   */
  const updateNote = useCallback(async (
    noteId: string,
    content: string
  ): Promise<ClinicalNote> => {
    const validation = ClinicalNotesService.validateNoteContent(content)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const result = await withLoadingAndError(
      'Update note',
      async () => {
        const updatedNote = await ClinicalNotesService.updateNote(noteId, content)
        
        // Update local state
        setNotes(prevNotes =>
          prevNotes.map(note =>
            note.id === noteId
              ? { ...note, content: updatedNote.content, updated_at: updatedNote.updated_at }
              : note
          )
        )
        
        return updatedNote
      }
    )

    if (!result) {
      throw new Error('Failed to update note')
    }

    return result
  }, [withLoadingAndError])

  /**
   * Delete a note
   */
  const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
    const result = await withLoadingAndError(
      'Delete note',
      async () => {
        await ClinicalNotesService.deleteNote(noteId)
        
        // Update local state
        setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId))
        
        return true
      }
    )

    return result || false
  }, [withLoadingAndError])

  /**
   * Load notes indicators (batch loading for UI performance)
   */
  const loadIndicators = useCallback(async (
    filePaths: string[],
    patientCodes: string[]
  ): Promise<void> => {
    await withLoadingAndError(
      'Load indicators',
      async () => {
        const fetchedIndicators = await ClinicalNotesService.getCachedIndicators(
          filePaths,
          patientCodes
        )
        setIndicators(fetchedIndicators)
        return fetchedIndicators
      }
    )
  }, [withLoadingAndError])

  /**
   * Refresh current data
   */
  const refresh = useCallback(async (): Promise<void> => {
    // Clear cache and reload indicators if they exist
    ClinicalNotesService.clearCache()
    
    // Get current indicators without creating a dependency loop
    const currentIndicators = indicators
    if (currentIndicators) {
      const filePaths = Object.keys(currentIndicators.file_notes || {})
      const patientCodes = Object.keys(currentIndicators.patient_notes || {})
      
      if (filePaths.length > 0 || patientCodes.length > 0) {
        await loadIndicators(filePaths, patientCodes)
      }
    }
  }, [loadIndicators])

  /**
   * Get notes count for a specific target
   */
  const getNotesCount = useCallback((
    targetType: 'file' | 'patient',
    targetId: string
  ): number => {
    if (!indicators) return 0
    
    if (targetType === 'file') {
      return indicators.file_notes[targetId] || 0
    } else {
      return indicators.patient_notes[targetId] || 0
    }
  }, [indicators])

  /**
   * Check if notes exist for a target
   */
  const hasNotes = useCallback((
    targetType: 'file' | 'patient',
    targetId: string
  ): boolean => {
    return getNotesCount(targetType, targetId) > 0
  }, [getNotesCount])

  /**
   * Get display name for target
   */
  const getTargetDisplayName = useCallback((
    targetType: 'file' | 'patient',
    targetId: string
  ): string => {
    return ClinicalNotesService.getTargetDisplayName(targetType, targetId)
  }, [])

  /**
   * Extract patient code from file path
   */
  const extractPatientCode = useCallback((filePath: string): string | null => {
    return ClinicalNotesService.extractPatientCodeFromPath(filePath)
  }, [])

  /**
   * Validate note content
   */
  const validateContent = useCallback((content: string) => {
    return ClinicalNotesService.validateNoteContent(content)
  }, [])

  /**
   * Format note content for display
   */
  const formatContent = useCallback((content: string): string => {
    return ClinicalNotesService.formatNoteContent(content)
  }, [])

  return {
    // State
    notes,
    indicators,
    loading,
    error,

    // File note operations
    createFileNote,
    getFileNotes,

    // Patient note operations
    createPatientNote,
    getPatientNotes,

    // General operations
    updateNote,
    deleteNote,
    loadIndicators,

    // Utility functions
    clearError,
    refresh,
    getNotesCount,
    hasNotes,
    getTargetDisplayName,
    extractPatientCode,
    validateContent,
    formatContent
  }
}

export default useClinicalNotes