import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Editor from 'react-simple-wysiwyg'
import { cn } from '@/lib/utils'
import { LoadingSpinner, ErrorState } from './LoadingStates'
import { useClinicalNotes } from '../../hooks/useClinicalNotes'
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor'
import { ClinicalNotesService } from '../../services/clinicalNotesService'
import type { NotesModalProps, ClinicalNoteWithPatientCode } from '../../types/clinical-notes'

/**
 * Clinical Notes Modal
 * 
 * Comprehensive modal for viewing, creating, editing, and deleting clinical notes.
 * Supports both file notes and patient notes with simple WYSIWYG editing.
 */
export const ClinicalNotesModal: React.FC<NotesModalProps> = ({
  isOpen,
  onClose,
  noteType,
  targetId,
  targetDisplayName,
  existingNotes = [],
  onNotesChanged
}) => {
  const {
    notes,
    error,
    getFileNotes,
    getPatientNotes,
    createFileNote,
    createPatientNote,
    updateNote,
    deleteNote,
    clearError,
    validateContent,
    getTargetDisplayName
  } = useClinicalNotes()

  // Local state - optimized with better loading management
  const [localNotes, setLocalNotes] = useState<ClinicalNoteWithPatientCode[]>([])
  const [selectedNote, setSelectedNote] = useState<ClinicalNoteWithPatientCode | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editorContent, setEditorContent] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  
  // Enhanced loading states with specific operations
  const [loadingState, setLoadingState] = useState<{
    notes: boolean
    saving: boolean
    deleting: string | null
  }>({ notes: false, saving: false, deleting: null })
  
  // Cache for author email to prevent re-fetching
  const [authorEmailCache, setAuthorEmailCache] = useState<string | null>(null)
  
  // Performance monitoring
  const { startOperation, endOperation } = usePerformanceMonitor('ClinicalNotesModal')

  // Computed values
  const displayName = useMemo(() => {
    return targetDisplayName || getTargetDisplayName(noteType, targetId)
  }, [targetDisplayName, noteType, targetId, getTargetDisplayName])

  const hasNotes = localNotes.length > 0
  const canSave = editorContent.trim().length > 0 && validateContent(editorContent).valid

  // Enhanced notes loading with better performance and error handling
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setSelectedNote(null)
      setLocalNotes([])
      setLoadingState({ notes: false, saving: false, deleting: null })
      return
    }

    const loadNotes = async () => {
      // Prevent multiple simultaneous loads
      if (loadingState.notes) return
      
      try {
        setLoadingState(prev => ({ ...prev, notes: true }))
        startOperation('loadNotes')
        clearError()
        let fetchedNotes: ClinicalNoteWithPatientCode[] = []

        if (existingNotes.length > 0) {
          // Use provided notes (for performance) - no API call needed
          startOperation('loadCachedNotes')
          fetchedNotes = existingNotes
          // Simulate brief loading for consistent UX
          await new Promise(resolve => setTimeout(resolve, 50))
          endOperation('loadCachedNotes')
        } else {
          // Fetch from API with timeout protection
          startOperation('fetchNotesAPI')
          const fetchPromise = noteType === 'file' 
            ? getFileNotes(targetId)
            : getPatientNotes(targetId)
          
          // Add timeout to prevent indefinite loading
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 10000)
          )
          
          fetchedNotes = await Promise.race([fetchPromise, timeoutPromise])
          endOperation('fetchNotesAPI')
        }

        setLocalNotes(fetchedNotes)

        // Auto-select first note if exists and none is selected
        if (fetchedNotes.length > 0 && !selectedNote) {
          setSelectedNote(fetchedNotes[0])
        }
        
        endOperation('loadNotes')
      } catch (err) {
        console.error('Failed to load notes:', err)
        endOperation('loadNotes', false)
        // Error is handled by the hook's withLoadingAndError
      } finally {
        setLoadingState(prev => ({ ...prev, notes: false }))
      }
    }

    loadNotes()
  }, [isOpen, noteType, targetId, existingNotes.length])

  // Handle modal close
  const handleClose = useCallback(() => {
    setSelectedNote(null)
    setIsEditing(false)
    setIsCreating(false)
    setEditorContent('')
    // Removed setShowPreview - using simple WYSIWYG editor
    setDeleteConfirm(null)
    clearError()
    onClose()
  }, [onClose, clearError])

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, handleClose])

  // Enhanced note creation with optimistic updates
  const handleCreateNote = useCallback(async () => {
    if (!canSave || loadingState.saving) return

    // Optimistic update - create temporary note immediately
    const tempId = `temp-${Date.now()}`
    const optimisticNote: ClinicalNoteWithPatientCode = {
      id: tempId,
      content: editorContent,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      patient_code: noteType === 'patient' ? targetId : undefined,
      author_id: '', // Will be set by backend
      note_type: noteType
    }

    try {
      setLoadingState(prev => ({ ...prev, saving: true }))
      startOperation('createNote')
      
      // Add optimistic note to UI immediately
      setLocalNotes(prev => [optimisticNote, ...prev])
      setSelectedNote(optimisticNote)
      setIsCreating(false)
      setEditorContent('')

      // Create actual note
      let newNote: any
      if (noteType === 'file') {
        newNote = await createFileNote(targetId, editorContent)
      } else {
        newNote = await createPatientNote(targetId, editorContent)
      }

      // Replace optimistic note with real note
      const noteWithCode: ClinicalNoteWithPatientCode = {
        ...newNote,
        patient_code: noteType === 'patient' ? targetId : undefined
      }

      setLocalNotes(prev => prev.map(note => 
        note.id === tempId ? noteWithCode : note
      ))
      setSelectedNote(noteWithCode)

      // Notify parent
      onNotesChanged?.()
      
      // Dispatch custom event for batch indicators refresh
      window.dispatchEvent(new CustomEvent('clinical-notes-changed', {
        detail: { filePath: targetId, noteType, action: 'create' }
      }))
      
      endOperation('createNote')
    } catch (err) {
      endOperation('createNote', false)
      console.error('Failed to create note:', err)
      // Revert optimistic update on error
      setLocalNotes(prev => prev.filter(note => note.id !== tempId))
      setSelectedNote(null)
      setIsCreating(true)
      setEditorContent(editorContent)
    } finally {
      setLoadingState(prev => ({ ...prev, saving: false }))
    }
  }, [canSave, loadingState.saving, noteType, targetId, editorContent])

  // Enhanced note update with optimistic updates
  const handleUpdateNote = useCallback(async () => {
    if (!selectedNote || !canSave || loadingState.saving) return

    // Store original content for rollback
    const originalContent = selectedNote.content
    const originalUpdatedAt = selectedNote.updated_at

    try {
      setLoadingState(prev => ({ ...prev, saving: true }))
      startOperation('updateNote')
      
      // Optimistic update - update UI immediately
      const optimisticUpdate = {
        ...selectedNote,
        content: editorContent,
        updated_at: new Date().toISOString()
      }
      
      setLocalNotes(prev =>
        prev.map(note =>
          note.id === selectedNote.id ? optimisticUpdate : note
        )
      )
      setSelectedNote(optimisticUpdate)
      setIsEditing(false)
      setEditorContent('')

      // Perform actual update
      const updatedNote = await updateNote(selectedNote.id, editorContent)

      // Replace optimistic update with real data
      const finalUpdate = {
        ...selectedNote,
        content: updatedNote.content,
        updated_at: updatedNote.updated_at
      }
      
      setLocalNotes(prev =>
        prev.map(note =>
          note.id === selectedNote.id ? finalUpdate : note
        )
      )
      setSelectedNote(finalUpdate)

      // Notify parent
      onNotesChanged?.()
      
      // Dispatch custom event for batch indicators refresh
      window.dispatchEvent(new CustomEvent('clinical-notes-changed', {
        detail: { filePath: targetId, noteType, action: 'update' }
      }))
      
      endOperation('updateNote')
    } catch (err) {
      endOperation('updateNote', false)
      console.error('Failed to update note:', err)
      // Revert optimistic update on error
      const revertedNote = {
        ...selectedNote,
        content: originalContent,
        updated_at: originalUpdatedAt
      }
      
      setLocalNotes(prev =>
        prev.map(note =>
          note.id === selectedNote.id ? revertedNote : note
        )
      )
      setSelectedNote(revertedNote)
      setIsEditing(true)
      setEditorContent(originalContent)
    } finally {
      setLoadingState(prev => ({ ...prev, saving: false }))
    }
  }, [selectedNote, canSave, loadingState.saving, editorContent])

  // Enhanced note deletion with loading states
  const handleDeleteNote = useCallback(async (noteId: string) => {
    // Store note for potential rollback
    const noteToDelete = localNotes.find(note => note.id === noteId)
    if (!noteToDelete) return

    try {
      setLoadingState(prev => ({ ...prev, deleting: noteId }))
      startOperation('deleteNote')
      
      // Optimistic removal - remove from UI immediately
      const remainingNotes = localNotes.filter(note => note.id !== noteId)
      setLocalNotes(remainingNotes)

      // Handle selected note deletion
      if (selectedNote?.id === noteId) {
        setSelectedNote(remainingNotes.length > 0 ? remainingNotes[0] : null)
      }

      // Perform actual deletion
      await deleteNote(noteId)

      setDeleteConfirm(null)

      // Notify parent
      onNotesChanged?.()
      
      // Dispatch custom event for batch indicators refresh
      window.dispatchEvent(new CustomEvent('clinical-notes-changed', {
        detail: { filePath: targetId, noteType, action: 'delete' }
      }))
      
      endOperation('deleteNote')
    } catch (err) {
      endOperation('deleteNote', false)
      console.error('Failed to delete note:', err)
      // Revert optimistic deletion on error
      setLocalNotes(prev => {
        const restored = [...prev, noteToDelete].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        return restored
      })
      if (selectedNote?.id === noteId) {
        setSelectedNote(noteToDelete)
      }
    } finally {
      setLoadingState(prev => ({ ...prev, deleting: null }))
    }
  }, [selectedNote, localNotes])

  // Start editing
  const startEditing = useCallback((note?: ClinicalNoteWithPatientCode) => {
    if (note) {
      setSelectedNote(note)
      setEditorContent(note.content)
    } else {
      setEditorContent('')
    }
    setIsEditing(true)
    setIsCreating(!note)
  }, [])

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setIsCreating(false)
    setEditorContent('')
    // Removed setShowPreview - using simple WYSIWYG editor
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl h-[80vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              noteType === 'file' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
            )}>
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h5.586a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V12.5A1.5 1.5 0 0 1 12.5 14h-8A1.5 1.5 0 0 1 3 12.5v-9z"/>
                <path d="M5 7h6v1H5V7zm0 2h6v1H5V9z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Clinical Notes</h2>
              <p className="text-sm text-slate-600">{displayName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => startEditing()}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg font-medium transition-colors"
              >
                Add Note
              </button>
            )}
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M.293.293a1 1 0 011.414 0L8 6.586 14.293.293a1 1 0 111.414 1.414L9.414 8l6.293 6.293a1 1 0 01-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 01-1.414-1.414L6.586 8 .293 1.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Notes List */}
          {hasNotes && (
            <div className="w-72 border-r border-slate-200 flex flex-col bg-slate-50">
              <div className="p-3 border-b border-slate-200">
                <h3 className="text-sm font-medium text-slate-700">Notes ({localNotes.length})</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {localNotes.map(note => (
                  <div
                    key={note.id}
                    className={cn(
                      'p-3 border-b border-slate-200 cursor-pointer transition-colors relative',
                      selectedNote?.id === note.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-white',
                      loadingState.deleting === note.id && 'opacity-50'
                    )}
                    onClick={() => !loadingState.deleting && setSelectedNote(note)}
                  >
                    {/* Loading overlay for note being processed */}
                    {(loadingState.deleting === note.id || (note.id.startsWith('temp-') && loadingState.saving)) && (
                      <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {loadingState.deleting === note.id ? 'Deleting...' : 'Saving...'}
                        </div>
                      </div>
                    )}
                    <div className="text-sm text-slate-800 line-clamp-3 mb-2 prose prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: note.content }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex flex-col gap-0.5">
                        <span>{ClinicalNotesService.formatEuropeanTimestamp(note.created_at)}</span>
                        {note.patient_code && (
                          <span className="text-slate-400">Patient: {note.patient_code}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditing(note)
                          }}
                          disabled={loadingState.saving}
                          className={cn(
                            'p-1 rounded transition-colors',
                            loadingState.saving 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'hover:bg-slate-200'
                          )}
                          title="Edit note"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirm(note.id)
                          }}
                          disabled={loadingState.deleting === note.id}
                          className={cn(
                            'p-1 rounded transition-colors',
                            loadingState.deleting === note.id
                              ? 'bg-red-50 text-red-400 cursor-not-allowed'
                              : 'hover:bg-red-100 text-red-600'
                          )}
                          title="Delete note"
                        >
                          {loadingState.deleting === note.id ? (
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Enhanced loading states with specific messaging */}
            {loadingState.notes ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <LoadingSpinner size="lg" className="mb-4" />
                  <p className="text-sm text-slate-600">
                    {existingNotes.length > 0 ? 'Preparing notes...' : 'Loading notes...'}
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
                <ErrorState
                  title="Failed to load notes"
                  message={error.message}
                  onRetry={() => {
                    setLoadingState(prev => ({ ...prev, notes: true }))
                    clearError()
                    // Retry loading with a small delay
                    setTimeout(() => {
                      const retryLoad = async () => {
                        try {
                          let fetchedNotes: ClinicalNoteWithPatientCode[] = []
                          if (existingNotes.length > 0) {
                            fetchedNotes = existingNotes
                          } else {
                            fetchedNotes = noteType === 'file' 
                              ? await getFileNotes(targetId)
                              : await getPatientNotes(targetId)
                          }
                          setLocalNotes(fetchedNotes)
                          if (fetchedNotes.length > 0 && !selectedNote) {
                            setSelectedNote(fetchedNotes[0])
                          }
                        } catch (err) {
                          console.error('Retry failed:', err)
                        } finally {
                          setLoadingState(prev => ({ ...prev, notes: false }))
                        }
                      }
                      retryLoad()
                    }, 500)
                  }}
                />
              </div>
            ) : isEditing ? (
              <ClinicalNotesEditor
                content={editorContent}
                onChange={setEditorContent}
                onSave={isCreating ? handleCreateNote : handleUpdateNote}
                onCancel={cancelEditing}
                canSave={canSave}
                isCreating={isCreating}
                isSaving={loadingState.saving}
              />
            ) : selectedNote ? (
              <ClinicalNoteViewer
                note={selectedNote}
                onEdit={() => startEditing(selectedNote)}
                onDelete={() => setDeleteConfirm(selectedNote.id)}
                authorEmail={authorEmailCache}
                onAuthorEmailLoad={setAuthorEmailCache}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h5.586a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V12.5A1.5 1.5 0 0 1 12.5 14h-8A1.5 1.5 0 0 1 3 12.5v-9z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 mb-2">No notes yet</h3>
                  <p className="text-slate-600 mb-4">Create your first clinical note for this {noteType}.</p>
                  <button
                    onClick={() => startEditing()}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Create Note
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 mx-4 max-w-md">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete Note</h3>
            <p className="text-slate-600 mb-4">Are you sure you want to delete this note? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNote(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sub-components for better organization

interface EditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
  onCancel: () => void
  canSave: boolean
  isCreating: boolean
  isSaving: boolean
}

const ClinicalNotesEditor: React.FC<EditorProps> = ({
  content,
  onChange,
  onSave,
  onCancel,
  canSave,
  isCreating,
  isSaving
}) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between p-3 border-b border-slate-200">
      <h3 className="font-medium text-slate-800">
        {isCreating ? 'Create Note' : 'Edit Note'}
      </h3>
    </div>
    
    <div className="flex-1 p-4">
      <div className="h-full border border-slate-200 rounded-lg overflow-hidden">
        <Editor
          value={content}
          onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
          placeholder="Write your clinical note here..."
          containerProps={{ 
            style: { height: '300px' }
          }}
        />
      </div>
    </div>
    
    <div className="flex justify-between items-center p-4 border-t border-slate-200">
      <div className="text-sm text-slate-500">
        {content.length}/10,000 characters
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!canSave || isSaving}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
            canSave && !isSaving
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          )}
        >
          {isSaving && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {isSaving ? 'Saving...' : (isCreating ? 'Create' : 'Update')}
        </button>
      </div>
    </div>
  </div>
)

interface ViewerProps {
  note: ClinicalNoteWithPatientCode
  onEdit: () => void
  onDelete: () => void
  authorEmail?: string | null
  onAuthorEmailLoad?: (email: string) => void
}

const ClinicalNoteViewer: React.FC<ViewerProps> = ({ 
  note, 
  onEdit, 
  onDelete, 
  authorEmail: cachedAuthorEmail, 
  onAuthorEmailLoad 
}) => {
  const [localAuthorEmail, setLocalAuthorEmail] = React.useState<string | null>(cachedAuthorEmail || null)
  const [isLoadingEmail, setIsLoadingEmail] = React.useState(false)
  
  React.useEffect(() => {
    // Only load email if not cached and not already loading
    if (!localAuthorEmail && !isLoadingEmail) {
      setIsLoadingEmail(true)
      ClinicalNotesService.getCurrentUserEmail()
        .then(email => {
          setLocalAuthorEmail(email)
          if (email && onAuthorEmailLoad) {
            onAuthorEmailLoad(email)
          }
        })
        .catch(err => {
          console.warn('Failed to load author email:', err)
          setLocalAuthorEmail('Unknown')
        })
        .finally(() => setIsLoadingEmail(false))
    }
  }, [localAuthorEmail, isLoadingEmail, onAuthorEmailLoad])
  
  return (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between p-4 border-b border-slate-200">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-sm text-slate-500">
            Created: {ClinicalNotesService.formatEuropeanTimestamp(note.created_at)}
          </div>
          {note.updated_at !== note.created_at && (
            <div className="text-sm text-slate-500">
              Updated: {ClinicalNotesService.formatEuropeanTimestamp(note.updated_at)}
            </div>
          )}
          {note.patient_code && (
            <div className="text-sm text-slate-500">
              Patient: {note.patient_code}
            </div>
          )}
          {isLoadingEmail ? (
            <div className="text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading author...
              </span>
            </div>
          ) : localAuthorEmail && (
            <div className="text-sm text-slate-500">
              Author: {localAuthorEmail}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
    
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="prose prose-sm max-w-none">
        <div dangerouslySetInnerHTML={{ __html: note.content }} />
      </div>
    </div>
  </div>
  )
}

export default ClinicalNotesModal