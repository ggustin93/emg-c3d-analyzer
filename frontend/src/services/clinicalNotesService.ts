import { supabase } from '../lib/supabase'
import type { 
  ClinicalNote,
  ClinicalNoteWithPatientCode,
  CreateNoteRequest,
  UpdateNoteRequest,
  NotesIndicatorsRequest,
  NotesIndicators,
  NotesListResponse,
  ClinicalNotesError
} from '../types/clinical-notes'

/**
 * Clinical Notes Service
 * 
 * Handles all Clinical Notes API operations with hybrid patient identification.
 * Supports both file notes (file_path) and patient notes (patient_code → patient_id).
 */
import { ENV_CONFIG } from '../config/environment';

export class ClinicalNotesService {
  // Get bucket name from centralized configuration
  private static readonly BUCKET_NAME = ENV_CONFIG.STORAGE_BUCKET_NAME;

  /**
   * Create a file note (linked to C3D file path)
   * OPTIMIZED: Uses direct Supabase for instant saves
   */
  static async createFileNote(
    filePath: string,
    title: string,
    content: string
  ): Promise<ClinicalNote> {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        throw new Error('Authentication required')
      }

      // Ensure file path includes bucket name for consistency
      const fullPath = filePath.includes('/') ? filePath : `${this.BUCKET_NAME}/${filePath}`

      // Create note directly in Supabase
      const { data: note, error } = await supabase
        .from('clinical_notes')
        .insert({
          author_id: session.user.id,
          file_path: fullPath,
          title: title.trim(),
          content: content.trim(),
          note_type: 'file',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create file note:', error)
        throw new Error(error.message)
      }

      return note
    } catch (error) {
      console.error('Failed to create file note:', error)
      throw error
    }
  }

  /**
   * Create a patient note (using patient_code for convenience)
   * OPTIMIZED: Uses direct Supabase for instant saves
   */
  static async createPatientNote(
    patientCode: string,
    title: string,
    content: string
  ): Promise<ClinicalNote> {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        throw new Error('Authentication required')
      }

      // First get patient_id from patient_code
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('patient_code', patientCode)
        .single()

      if (patientError || !patientData) {
        console.error('Failed to find patient:', patientError)
        throw new Error(`Patient ${patientCode} not found`)
      }

      // Create note directly in Supabase
      const { data: note, error } = await supabase
        .from('clinical_notes')
        .insert({
          author_id: session.user.id,
          patient_id: patientData.id,
          title: title.trim(),
          content: content.trim(),
          note_type: 'patient',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create patient note:', error)
        throw new Error(error.message)
      }

      return note
    } catch (error) {
      console.error('Failed to create patient note:', error)
      throw error
    }
  }

  /**
   * Get all file notes for a specific C3D file
   * OPTIMIZED: Uses direct Supabase query for read performance
   */
  static async getFileNotes(filePath: string): Promise<ClinicalNoteWithPatientCode[]> {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return []

      // Ensure file path includes bucket name for consistency
      const fullPath = filePath.includes('/') ? filePath : `${this.BUCKET_NAME}/${filePath}`
      
      // Direct Supabase query - much faster than API call
      const { data: notes, error } = await supabase
        .from('clinical_notes')
        .select(`
          *,
          patients:patient_id (
            patient_code
          )
        `)
        .eq('file_path', fullPath)
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch file notes:', error)
        throw new Error(error.message)
      }

      // Transform to match expected format
      return (notes || []).map(note => ({
        ...note,
        patient_code: note.patients?.patient_code || null
      }))
    } catch (error) {
      console.error('Failed to get file notes:', error)
      return []
    }
  }

  /**
   * Get all patient notes for a specific patient (using patient_code)
   * OPTIMIZED: Uses direct Supabase query for read performance
   */
  static async getPatientNotes(patientCode: string): Promise<ClinicalNoteWithPatientCode[]> {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return []

      // First get patient_id from patient_code
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('patient_code', patientCode)
        .single()

      if (patientError || !patientData) {
        console.error('Failed to find patient:', patientError)
        return []
      }

      // Direct Supabase query for notes
      const { data: notes, error } = await supabase
        .from('clinical_notes')
        .select('*')
        .eq('patient_id', patientData.id)
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch patient notes:', error)
        throw new Error(error.message)
      }

      // Add patient_code to each note
      return (notes || []).map(note => ({
        ...note,
        patient_code: patientCode
      }))
    } catch (error) {
      console.error('Failed to get patient notes:', error)
      return []
    }
  }

  /**
   * Get all notes related to a patient (both patient notes and session notes)
   * Combines patient-specific notes and file notes that contain the patient code
   * OPTIMIZED: Uses direct Supabase for comprehensive patient view
   */
  static async getPatientRelatedNotes(patientCode: string): Promise<ClinicalNoteWithPatientCode[]> {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return []

      // First get patient_id from patient_code
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('patient_code', patientCode)
        .single()

      if (patientError) {
        console.warn('Patient not found:', patientError)
        // Continue without patient_id to still get file notes
      }

      // Get all notes (both patient and file types) for this user
      const { data: allNotes, error } = await supabase
        .from('clinical_notes')
        .select(`
          *,
          patients:patient_id (
            patient_code
          )
        `)
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch notes:', error)
        throw new Error(error.message)
      }

      // Filter notes related to this patient
      const relatedNotes = (allNotes || []).filter(note => {
        // Include patient notes for this specific patient
        if (note.note_type === 'patient' && note.patients?.patient_code === patientCode) {
          return true
        }
        
        // Include file notes where the file path contains the patient code
        if (note.note_type === 'file' && note.file_path) {
          const extractedPatientCode = this.extractPatientCodeFromPath(note.file_path)
          return extractedPatientCode === patientCode
        }
        
        return false
      })

      // Transform to match expected format
      return relatedNotes.map(note => ({
        ...note,
        patient_code: note.patients?.patient_code || this.extractPatientCodeFromPath(note.file_path || '') || patientCode
      }))
    } catch (error) {
      console.error('Failed to get patient related notes:', error)
      return []
    }
  }

  /**
   * Get notes by author (current user's notes)
   * OPTIMIZED: Uses direct Supabase query for read performance
   */
  static async getMyNotes(
    page: number = 1,
    limit: number = 50
  ): Promise<NotesListResponse> {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        return { notes: [], total_count: 0 }
      }

      // Calculate pagination
      const from = (page - 1) * limit
      const to = from + limit - 1

      // Direct Supabase query with pagination
      const { data: notes, error, count } = await supabase
        .from('clinical_notes')
        .select(`
          *,
          patients:patient_id (
            patient_code
          )
        `, { count: 'exact' })
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Failed to fetch user notes:', error)
        throw new Error(error.message)
      }

      // Transform to match expected format
      const transformedNotes = (notes || []).map(note => ({
        ...note,
        patient_code: note.patients?.patient_code || null
      }))

      return {
        notes: transformedNotes,
        total_count: count || 0
      }
    } catch (error) {
      console.error('Failed to get user notes:', error)
      return { notes: [], total_count: 0 }
    }
  }

  /**
   * Update an existing note
   * OPTIMIZED: Uses direct Supabase for instant updates
   */
  static async updateNote(noteId: string, title: string, content: string): Promise<ClinicalNote> {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        throw new Error('Authentication required')
      }

      // Update note directly in Supabase
      const { data: note, error } = await supabase
        .from('clinical_notes')
        .update({
          title: title.trim(),
          content: content.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)
        .eq('author_id', session.user.id) // Ensure user owns the note
        .select()
        .single()

      if (error) {
        console.error('Failed to update note:', error)
        throw new Error(error.message)
      }

      return note
    } catch (error) {
      console.error('Failed to update note:', error)
      throw error
    }
  }

  /**
   * Delete a note
   * OPTIMIZED: Uses direct Supabase for instant deletion
   */
  static async deleteNote(noteId: string): Promise<void> {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        throw new Error('Authentication required')
      }

      // Delete note directly in Supabase
      const { error } = await supabase
        .from('clinical_notes')
        .delete()
        .eq('id', noteId)
        .eq('author_id', session.user.id) // Ensure user owns the note

      if (error) {
        console.error('Failed to delete note:', error)
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('Failed to delete note:', error)
      throw error
    }
  }

  /**
   * Get note count indicators for UI performance (batch loading)
   * OPTIMIZED: Uses direct Supabase queries for read performance
   */
  static async getNotesIndicators(
    filePaths: string[] = [],
    patientCodes: string[] = []
  ): Promise<NotesIndicators> {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        return { file_notes: {}, patient_notes: {} }
      }

      const indicators: NotesIndicators = {
        file_notes: {},
        patient_notes: {}
      }

      // Batch query for file notes if paths provided
      if (filePaths.length > 0) {
        const fullPaths = filePaths.map(path => 
          path.includes('/') ? path : `${this.BUCKET_NAME}/${path}`
        )

        const { data: fileNotes, error: fileError } = await supabase
          .from('clinical_notes')
          .select('file_path', { count: 'exact', head: false })
          .eq('author_id', session.user.id)
          .in('file_path', fullPaths)

        if (!fileError && fileNotes) {
          // Count notes per file path
          for (const path of fullPaths) {
            indicators.file_notes[path] = fileNotes.filter(n => n.file_path === path).length
          }
        }
      }

      // Batch query for patient notes if codes provided
      if (patientCodes.length > 0) {
        // First get patient IDs for the codes
        const { data: patients, error: patientError } = await supabase
          .from('patients')
          .select('id, patient_code')
          .in('patient_code', patientCodes)

        if (!patientError && patients) {
          const patientIds = patients.map(p => p.id)
          
          // Get note counts for these patients
          const { data: patientNotes, error: notesError } = await supabase
            .from('clinical_notes')
            .select('patient_id', { count: 'exact', head: false })
            .eq('author_id', session.user.id)
            .in('patient_id', patientIds)

          if (!notesError && patientNotes) {
            // Map counts back to patient codes
            for (const patient of patients) {
              const count = patientNotes.filter(n => n.patient_id === patient.id).length
              indicators.patient_notes[patient.patient_code] = count
            }
          }
        }
      }

      return indicators
    } catch (error) {
      console.error('Failed to get notes indicators:', error)
      return { file_notes: {}, patient_notes: {} }
    }
  }

  /**
   * Extract patient code from file path (utility function)
   */
  static extractPatientCodeFromPath(filePath: string): string | null {
    if (!filePath) return null

    // Match pattern: P followed by 3+ digits (P001, P123, etc.)
    const match = filePath.match(/P\d{3,}/i)
    return match ? match[0].toUpperCase() : null
  }

  /**
   * Get notes count for a specific target (file or patient)
   * Uses direct Supabase client for efficiency (KISS principle)
   */
  static async getNotesCount(
    targetType: 'file' | 'patient',
    targetId: string
  ): Promise<number> {
    try {
      // Get current user session for auth
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return 0

      // Build query based on target type
      let query = supabase
        .from('clinical_notes')
        .select('*', { count: 'exact', head: true }) // Efficient count without data
        .eq('author_id', session.user.id)

      if (targetType === 'file') {
        // Ensure file path includes bucket name
        const fullPath = targetId.includes('/') ? targetId : `${this.BUCKET_NAME}/${targetId}`
        query = query.eq('file_path', fullPath)
      } else {
        // For patient notes, we need to get patient_id from patient_code
        // First, get the patient_id for the patient_code
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('patient_code', targetId)
          .single()
        
        if (!patientData?.id) return 0
        query = query.eq('patient_id', patientData.id)
      }

      const { count, error } = await query
      
      if (error) {
        console.warn(`Failed to get notes count: ${error.message}`)
        return 0
      }

      return count || 0
    } catch (error) {
      console.warn(`Failed to get notes count for ${targetType}:${targetId}`, error)
      return 0
    }
  }

  /**
   * Get notes count using batch indicators (fallback for batch operations)
   */
  static async getNotesCountBatch(
    targetType: 'file' | 'patient',
    targetId: string
  ): Promise<number> {
    try {
      const indicators = await this.getNotesIndicators(
        targetType === 'file' ? [targetId] : [],
        targetType === 'patient' ? [targetId] : []
      )

      if (targetType === 'file') {
        // Check with both the provided ID and the full path format
        const fullPath = targetId.includes('/') ? targetId : `${this.BUCKET_NAME}/${targetId}`
        return indicators.file_notes[fullPath] || indicators.file_notes[targetId] || 0
      } else {
        return indicators.patient_notes[targetId] || 0
      }
    } catch (error) {
      console.warn(`Failed to get notes count batch for ${targetType}:${targetId}`, error)
      return 0
    }
  }

  /**
   * Check if a note exists by ID (utility)
   */
  static async noteExists(noteId: string): Promise<boolean> {
    try {
      // Try to get user's notes and check if the note ID exists
      const response = await this.getMyNotes(1, 1000) // Large limit for comprehensive check
      return response.notes.some(note => note.id === noteId)
    } catch (error) {
      return false
    }
  }

  /**
   * Batch load indicators with caching support
   */
  private static indicatorsCache = new Map<string, {
    data: NotesIndicators
    timestamp: number
    ttl: number
  }>()

  static async getCachedIndicators(
    filePaths: string[] = [],
    patientCodes: string[] = [],
    cacheTtlMs: number = 5 * 60 * 1000 // 5 minutes
  ): Promise<NotesIndicators> {
    const cacheKey = JSON.stringify({ filePaths: filePaths.sort(), patientCodes: patientCodes.sort() })
    const cached = this.indicatorsCache.get(cacheKey)
    const now = Date.now()

    // Return cached data if valid
    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data
    }

    // Fetch fresh data
    const indicators = await this.getNotesIndicators(filePaths, patientCodes)
    
    // Cache the result
    this.indicatorsCache.set(cacheKey, {
      data: indicators,
      timestamp: now,
      ttl: cacheTtlMs
    })

    // Clean up old cache entries
    for (const [key, entry] of this.indicatorsCache) {
      if ((now - entry.timestamp) > entry.ttl) {
        this.indicatorsCache.delete(key)
      }
    }

    return indicators
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  static clearCache(): void {
    this.indicatorsCache.clear()
  }

  /**
   * Validate note content
   */
  static validateNoteContent(content: string): { valid: boolean; error?: string } {
    const trimmed = content.trim()
    
    if (!trimmed) {
      return { valid: false, error: 'Note content cannot be empty' }
    }
    
    if (trimmed.length > 10000) {
      return { valid: false, error: 'Note content exceeds maximum length (10,000 characters)' }
    }
    
    return { valid: true }
  }

  /**
   * Format note content for display (basic markdown support)
   */
  static formatNoteContent(content: string): string {
    return content
      .trim()
      // Convert **bold** to <strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert *italic* to <em>
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Convert line breaks
      .replace(/\n/g, '<br />')
  }

  /**
   * Get display name for target (file path or patient code)
   */
  static getTargetDisplayName(
    targetType: 'file' | 'patient',
    targetId: string
  ): string {
    if (targetType === 'patient') {
      return targetId // Patient codes are already user-friendly (P001, P002, etc.)
    }
    
    // For files, extract meaningful name from path
    const fileName = targetId.split('/').pop() || targetId
    const patientCode = this.extractPatientCodeFromPath(targetId)
    
    if (patientCode && fileName) {
      return `${patientCode} - ${fileName}`
    }
    
    return fileName
  }
  
  /**
   * Generate consistent file path identifier for notes
   * Ensures bucket name is correctly included
   */
  static getFilePathIdentifier(fileName: string): string {
    // If fileName already includes bucket name, return as is
    if (fileName.startsWith(`${this.BUCKET_NAME}/`)) {
      return fileName
    }
    
    // Otherwise, prepend bucket name
    return `${this.BUCKET_NAME}/${fileName}`
  }

  /**
   * Format timestamp to European format (DD-MM-YYYY HH:mm)
   */
  static formatEuropeanTimestamp(timestamp: string): string {
    const date = new Date(timestamp)
    
    // Format: DD-MM-YYYY HH:mm (24-hour format)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    
    return `${day}-${month}-${year} ${hours}:${minutes}`
  }

  /**
   * Get current user email from Supabase auth
   */
  static async getCurrentUserEmail(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user?.email || null
  }
}

export default ClinicalNotesService