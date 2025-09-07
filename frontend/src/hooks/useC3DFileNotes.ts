import { useState, useCallback, useEffect, useMemo } from 'react'
import { useClinicalNotes } from './useClinicalNotes'
import type { ClinicalNoteWithPatientCode } from '../types/clinical-notes'

/**
 * C3D File Notes Integration Hook
 * 
 * Specialized hook for integrating clinical notes with C3D file displays.
 * Provides easy-to-use interface for existing file components.
 */
interface C3DFileNotesProps {
  filePath: string
  fileName?: string
  patientCode?: string
  enabled?: boolean
  autoLoad?: boolean
  onNotesChanged?: () => void
}

interface UseC3DFileNotesReturn {
  // Note state
  notes: ClinicalNoteWithPatientCode[]
  notesCount: number
  hasNotes: boolean
  loading: boolean
  error: string | null

  // UI state
  isModalOpen: boolean
  openModal: () => void
  closeModal: () => void

  // Operations
  refreshNotes: () => Promise<void>
  clearError: () => void

  // Display helpers
  displayName: string
  patientInfo: {
    code: string | null
    hasCode: boolean
  }

  // Badge component props (ready to use)
  badgeProps: {
    count: number
    type: 'file'
    onClick: () => void
    loading: boolean
    disabled: boolean
  }

  // Modal component props (ready to use)
  modalProps: {
    isOpen: boolean
    onClose: () => void
    noteType: 'file'
    targetId: string
    targetDisplayName: string
    existingNotes: ClinicalNoteWithPatientCode[]
    onNotesChanged: () => void
  }
}

export const useC3DFileNotes = ({
  filePath,
  fileName,
  patientCode,
  enabled = true,
  autoLoad = true,
  onNotesChanged
}: C3DFileNotesProps): UseC3DFileNotesReturn => {
  const {
    notes: hookNotes,
    loading: hookLoading,
    error: hookError,
    getFileNotes,
    clearError: hookClearError,
    extractPatientCode,
    getTargetDisplayName
  } = useClinicalNotes()

  // Local state
  const [notes, setNotes] = useState<ClinicalNoteWithPatientCode[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)

  // Extract patient code if not provided
  const resolvedPatientCode = useMemo(() => {
    return patientCode || extractPatientCode(filePath)
  }, [patientCode, filePath, extractPatientCode])

  // Generate display name
  const displayName = useMemo(() => {
    if (fileName) {
      return resolvedPatientCode ? `${resolvedPatientCode} - ${fileName}` : fileName
    }
    return getTargetDisplayName('file', filePath)
  }, [fileName, resolvedPatientCode, filePath, getTargetDisplayName])

  // Patient info object
  const patientInfo = useMemo(() => ({
    code: resolvedPatientCode,
    hasCode: !!resolvedPatientCode
  }), [resolvedPatientCode])

  // Computed values
  const notesCount = notes.length
  const hasNotes = notesCount > 0
  const loading = hookLoading || localLoading
  const error = hookError?.message || null

  // Load notes
  const loadNotes = useCallback(async (showLoading = true) => {
    if (!enabled || !filePath) return

    try {
      if (showLoading) {
        setLocalLoading(true)
      }

      const fetchedNotes = await getFileNotes(filePath)
      setNotes(fetchedNotes)
    } catch (err) {
      console.error('Failed to load C3D file notes:', err)
    } finally {
      if (showLoading) {
        setLocalLoading(false)
      }
    }
  }, [enabled, filePath, getFileNotes])

  // Auto-load notes when component mounts or filePath changes
  useEffect(() => {
    if (autoLoad && enabled && filePath) {
      loadNotes()
    }
  }, [autoLoad, enabled, filePath, loadNotes])

  // Refresh notes (public method)
  const refreshNotes = useCallback(async () => {
    await loadNotes(true)
  }, [loadNotes])

  // Clear error (public method)
  const clearError = useCallback(() => {
    hookClearError()
  }, [hookClearError])

  // Modal control
  const openModal = useCallback(() => {
    if (enabled) {
      setIsModalOpen(true)
    }
  }, [enabled])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  // Handle notes changed (refresh local state and notify parent)
  const handleNotesChanged = useCallback(() => {
    // Refresh local notes
    refreshNotes()
    // Call original callback if provided (for parent indicators refresh)
    onNotesChanged?.()
  }, [refreshNotes, onNotesChanged])

  // Badge component props (ready to use)
  const badgeProps = useMemo(() => ({
    count: notesCount,
    type: 'file' as const,
    onClick: openModal,
    loading,
    disabled: !enabled || !filePath
  }), [notesCount, openModal, loading, enabled, filePath])

  // Modal component props (ready to use)
  const modalProps = useMemo(() => ({
    isOpen: isModalOpen,
    onClose: closeModal,
    noteType: 'file' as const,
    targetId: filePath,
    targetDisplayName: displayName,
    existingNotes: notes,
    onNotesChanged: handleNotesChanged
  }), [isModalOpen, closeModal, filePath, displayName, notes, handleNotesChanged])

  return {
    // Note state
    notes,
    notesCount,
    hasNotes,
    loading,
    error,

    // UI state
    isModalOpen,
    openModal,
    closeModal,

    // Operations
    refreshNotes,
    clearError,

    // Display helpers
    displayName,
    patientInfo,

    // Component props
    badgeProps,
    modalProps
  }
}

/**
 * Batch C3D Files Notes Hook
 * 
 * For loading notes indicators for multiple files at once (UI performance).
 */
interface BatchC3DFileNotesProps {
  files: Array<{
    path: string
    name?: string
    patientCode?: string
  }>
  enabled?: boolean
}

interface UseBatchC3DFileNotesReturn {
  // Indicators state
  indicators: Record<string, number> // filePath -> noteCount
  loading: boolean
  error: string | null

  // Operations
  loadIndicators: () => Promise<void>
  refreshIndicators: () => Promise<void>
  clearError: () => void

  // Helpers
  getNotesCount: (filePath: string) => number
  hasNotes: (filePath: string) => boolean
}

export const useBatchC3DFileNotes = ({
  files,
  enabled = true
}: BatchC3DFileNotesProps): UseBatchC3DFileNotesReturn => {
  const {
    indicators: hookIndicators,
    loading,
    error: hookError,
    loadIndicators: hookLoadIndicators,
    clearError: hookClearError
  } = useClinicalNotes()

  // Local state
  const [indicators, setIndicators] = useState<Record<string, number>>({})

  // File paths for batch loading
  const filePaths = useMemo(() => {
    return files.map(file => file.path)
  }, [files])

  // Load indicators
  const loadIndicators = useCallback(async () => {
    if (!enabled || filePaths.length === 0) return

    try {
      await hookLoadIndicators(filePaths, [])
      
      // Extract file notes from indicators
      const fileIndicators: Record<string, number> = {}
      if (hookIndicators?.file_notes) {
        for (const filePath of filePaths) {
          fileIndicators[filePath] = hookIndicators.file_notes[filePath] || 0
        }
      }
      
      setIndicators(fileIndicators)
    } catch (err) {
      console.error('Failed to load batch file notes indicators:', err)
    }
  }, [enabled, filePaths, hookLoadIndicators])

  // Auto-load when files change
  useEffect(() => {
    if (enabled && filePaths.length > 0) {
      loadIndicators()
    }
  }, [enabled, filePaths, loadIndicators])

  // Refresh indicators (public method)
  const refreshIndicators = useCallback(async () => {
    await loadIndicators()
  }, [loadIndicators])

  // Clear error (public method)
  const clearError = useCallback(() => {
    hookClearError()
  }, [hookClearError])

  // Helper functions
  const getNotesCount = useCallback((filePath: string): number => {
    return indicators[filePath] || 0
  }, [indicators])

  const hasNotes = useCallback((filePath: string): boolean => {
    return getNotesCount(filePath) > 0
  }, [getNotesCount])

  return {
    // State
    indicators,
    loading,
    error: hookError?.message || null,

    // Operations
    loadIndicators,
    refreshIndicators,
    clearError,

    // Helpers
    getNotesCount,
    hasNotes
  }
}

export default {
  useC3DFileNotes,
  useBatchC3DFileNotes
}