import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface SimpleNotesCount {
  [filePath: string]: number
}

interface UseSimpleNotesCountReturn {
  notesCount: SimpleNotesCount
  loading: boolean
  error: string | null
  refreshNotes: () => Promise<void>
}

/**
 * Simple Clinical Notes Count Hook
 * 
 * Replaces complex 400+ line system with single Supabase query + JavaScript groupBy.
 * Addresses ghost badge issue through direct path matching.
 * 
 * Performance: 1 query instead of 71 individual queries
 * Simplicity: ~50 lines instead of 400+ lines
 * Reliability: Direct database lookup eliminates path mapping issues
 */
export const useSimpleNotesCount = (enabled: boolean = true): UseSimpleNotesCountReturn => {
  const [notesCount, setNotesCount] = useState<SimpleNotesCount>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAllFileNotes = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setNotesCount({})
        return
      }

      // Single query: fetch ALL file-type clinical notes for current user
      const { data: notes, error: fetchError } = await supabase
        .from('clinical_notes')
        .select('file_path')
        .eq('note_type', 'file')
        .eq('author_id', session.user.id)
        .not('file_path', 'is', null)

      if (fetchError) {
        throw new Error(`Failed to fetch notes: ${fetchError.message}`)
      }

      // JavaScript groupBy: count notes per file path
      const counts: SimpleNotesCount = {}
      notes?.forEach(note => {
        if (note.file_path) {
          counts[note.file_path] = (counts[note.file_path] || 0) + 1
        }
      })

      setNotesCount(counts)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch file notes count:', err)
      setNotesCount({}) // Reset on error
    } finally {
      setLoading(false)
    }
  }, [enabled])

  // Auto-fetch on mount and when enabled changes
  useEffect(() => {
    if (enabled) {
      fetchAllFileNotes()
    }
  }, [enabled, fetchAllFileNotes])

  // Public refresh method
  const refreshNotes = useCallback(async () => {
    await fetchAllFileNotes()
  }, [fetchAllFileNotes])

  return {
    notesCount,
    loading,
    error,
    refreshNotes
  }
}

export default useSimpleNotesCount