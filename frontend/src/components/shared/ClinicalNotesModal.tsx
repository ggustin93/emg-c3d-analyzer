import React, { useState, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { LoadingSpinner, ErrorState } from './LoadingStates'
import { useClinicalNotes } from '../../hooks/useClinicalNotes'
import type { NotesModalProps, ClinicalNoteWithPatientCode } from '../../types/clinical-notes'
import MarkdownEditor from './MarkdownEditor'

/**
 * Clinical Notes Modal
 * 
 * Comprehensive modal for viewing, creating, editing, and deleting clinical notes.
 * Supports both file notes and patient notes with markdown editing.
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

  // Local state
  const [localNotes, setLocalNotes] = useState<ClinicalNoteWithPatientCode[]>([])
  const [selectedNote, setSelectedNote] = useState<ClinicalNoteWithPatientCode | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editorContent, setEditorContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Computed values
  const displayName = useMemo(() => {
    return targetDisplayName || getTargetDisplayName(noteType, targetId)
  }, [targetDisplayName, noteType, targetId, getTargetDisplayName])

  const hasNotes = localNotes.length > 0
  const canSave = editorContent.trim().length > 0 && validateContent(editorContent).valid

  // Load notes when modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setSelectedNote(null)
      setLocalNotes([])
      setModalLoading(false)
      return
    }

    const loadNotes = async () => {
      try {
        setModalLoading(true)
        clearError()
        let fetchedNotes: ClinicalNoteWithPatientCode[] = []

        if (existingNotes.length > 0) {
          // Use provided notes (for performance) - no API call needed
          fetchedNotes = existingNotes
        } else {
          // Fetch from API
          if (noteType === 'file') {
            fetchedNotes = await getFileNotes(targetId)
          } else {
            fetchedNotes = await getPatientNotes(targetId)
          }
        }

        setLocalNotes(fetchedNotes)

        // Auto-select first note if exists
        if (fetchedNotes.length > 0) {
          setSelectedNote(fetchedNotes[0])
        }
      } catch (err) {
        console.error('Failed to load notes:', err)
      } finally {
        // Always set loading to false, regardless of global loading state
        setModalLoading(false)
      }
    }

    loadNotes()
  }, [isOpen, noteType, targetId, existingNotes, getFileNotes, getPatientNotes, clearError])

  // Handle modal close
  const handleClose = useCallback(() => {
    setSelectedNote(null)
    setIsEditing(false)
    setIsCreating(false)
    setEditorContent('')
    setShowPreview(false)
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

  // Create new note
  const handleCreateNote = useCallback(async () => {
    if (!canSave || isSaving) return

    try {
      setIsSaving(true)
      let newNote: any

      if (noteType === 'file') {
        newNote = await createFileNote(targetId, editorContent)
      } else {
        newNote = await createPatientNote(targetId, editorContent)
      }

      // Add to local notes
      const noteWithCode: ClinicalNoteWithPatientCode = {
        ...newNote,
        patient_code: noteType === 'patient' ? targetId : undefined
      }

      setLocalNotes(prev => [noteWithCode, ...prev])
      setSelectedNote(noteWithCode)
      setIsCreating(false)
      setEditorContent('')

      // Notify parent
      onNotesChanged?.()
      
      // Dispatch custom event for batch indicators refresh
      window.dispatchEvent(new CustomEvent('clinical-notes-changed', {
        detail: { filePath: targetId, noteType, action: 'create' }
      }))
    } catch (err) {
      console.error('Failed to create note:', err)
    } finally {
      setIsSaving(false)
    }
  }, [canSave, isSaving, noteType, targetId, editorContent, createFileNote, createPatientNote, onNotesChanged])

  // Update existing note
  const handleUpdateNote = useCallback(async () => {
    if (!selectedNote || !canSave || isSaving) return

    try {
      setIsSaving(true)
      const updatedNote = await updateNote(selectedNote.id, editorContent)

      // Update local state
      setLocalNotes(prev =>
        prev.map(note =>
          note.id === selectedNote.id
            ? { ...note, content: updatedNote.content, updated_at: updatedNote.updated_at }
            : note
        )
      )

      setSelectedNote(prev => prev ? { ...prev, content: updatedNote.content, updated_at: updatedNote.updated_at } : null)
      setIsEditing(false)
      setEditorContent('')

      // Notify parent
      onNotesChanged?.()
      
      // Dispatch custom event for batch indicators refresh
      window.dispatchEvent(new CustomEvent('clinical-notes-changed', {
        detail: { filePath: targetId, noteType, action: 'create' }
      }))
    } catch (err) {
      console.error('Failed to update note:', err)
    } finally {
      setIsSaving(false)
    }
  }, [selectedNote, canSave, isSaving, editorContent, updateNote, onNotesChanged])

  // Delete note
  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      await deleteNote(noteId)

      // Update local state
      setLocalNotes(prev => prev.filter(note => note.id !== noteId))

      // Handle selected note deletion
      if (selectedNote?.id === noteId) {
        const remainingNotes = localNotes.filter(note => note.id !== noteId)
        setSelectedNote(remainingNotes.length > 0 ? remainingNotes[0] : null)
      }

      setDeleteConfirm(null)

      // Notify parent
      onNotesChanged?.()
      
      // Dispatch custom event for batch indicators refresh
      window.dispatchEvent(new CustomEvent('clinical-notes-changed', {
        detail: { filePath: targetId, noteType, action: 'create' }
      }))
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }, [deleteNote, selectedNote, localNotes, onNotesChanged])

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
    setShowPreview(false)
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
                      'p-3 border-b border-slate-200 cursor-pointer transition-colors',
                      selectedNote?.id === note.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-white'
                    )}
                    onClick={() => setSelectedNote(note)}
                  >
                    <div className="text-sm text-slate-800 line-clamp-3 mb-2">
                      {note.content}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex flex-col gap-0.5">
                        <span>{new Date(note.created_at).toLocaleDateString()}</span>
                        {note.author_email && (
                          <span className="text-slate-400">{note.author_email}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditing(note)
                          }}
                          className="p-1 hover:bg-slate-200 rounded"
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
                          className="p-1 hover:bg-red-100 text-red-600 rounded"
                          title="Delete note"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                          </svg>
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
            {/* Temporarily disabled loading spinner for testing */}
            {false && modalLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
                <ErrorState
                  title="Failed to load notes"
                  message={error.message}
                  onRetry={() => window.location.reload()}
                />
              </div>
            ) : isEditing ? (
              <ClinicalNotesEditor
                content={editorContent}
                onChange={setEditorContent}
                onSave={isCreating ? handleCreateNote : handleUpdateNote}
                onCancel={cancelEditing}
                canSave={canSave}
                showPreview={showPreview}
                onTogglePreview={() => setShowPreview(!showPreview)}
                isCreating={isCreating}
                isSaving={isSaving}
              />
            ) : selectedNote ? (
              <ClinicalNoteViewer
                note={selectedNote}
                onEdit={() => startEditing(selectedNote)}
                onDelete={() => setDeleteConfirm(selectedNote.id)}
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
  showPreview: boolean
  onTogglePreview: () => void
  isCreating: boolean
  isSaving: boolean
}

const ClinicalNotesEditor: React.FC<EditorProps> = ({
  content,
  onChange,
  onSave,
  onCancel,
  canSave,
  showPreview,
  onTogglePreview,
  isCreating,
  isSaving
}) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between p-3 border-b border-slate-200">
      <h3 className="font-medium text-slate-800">
        {isCreating ? 'Create Note' : 'Edit Note'}
      </h3>
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePreview}
          className={cn(
            'px-3 py-1.5 text-sm rounded-lg transition-colors',
            showPreview
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          )}
        >
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>
    </div>
    
    <div className="flex-1 p-4">
      {showPreview ? (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      ) : (
        <div className="h-full border border-slate-200 rounded-lg overflow-hidden">
          <MarkdownEditor
            value={content}
            onChange={onChange}
            placeholder="Write your clinical note here..."
            rows={8}
            maxLength={10000}
            className="h-full"
            showToolbar={true}
          />
        </div>
      )}
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
}

const ClinicalNoteViewer: React.FC<ViewerProps> = ({ note, onEdit, onDelete }) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between p-4 border-b border-slate-200">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-sm text-slate-500">
            Created {new Date(note.created_at).toLocaleDateString()} at {new Date(note.created_at).toLocaleTimeString()}
          </div>
          {note.updated_at !== note.created_at && (
            <div className="text-sm text-slate-500">
              Updated {new Date(note.updated_at).toLocaleDateString()} at {new Date(note.updated_at).toLocaleTimeString()}
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
        <ReactMarkdown>{note.content}</ReactMarkdown>
      </div>
    </div>
  </div>
)

export default ClinicalNotesModal