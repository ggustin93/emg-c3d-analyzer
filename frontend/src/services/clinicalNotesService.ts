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
export class ClinicalNotesService {
  private static readonly BASE_PATH = (import.meta.env.VITE_API_URL || 'http://localhost:8080') + '/api/clinical-notes'
  
  // Get bucket name from environment variable or use default
  private static readonly BUCKET_NAME = import.meta.env.VITE_STORAGE_BUCKET_NAME || 'c3d-examples'

  /**
   * Get authorization header with current session token
   * Simple and direct - let Supabase handle token refresh automatically
   */
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    // Simply get the current session - Supabase handles refresh automatically
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      throw new Error('Authentication required. Please sign in again.')
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }

  /**
   * Make authenticated API request - simplified without circuit breaker
   * Trusts Supabase to handle auth state and retries
   */
  private static async apiRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(`${this.BASE_PATH}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    })

    if (!response.ok) {
      const error: ClinicalNotesError = await response.json().catch(() => ({
        error: 'NETWORK_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
        details: { status: response.status }
      }))
      throw new Error(error.message)
    }

    return response.json()
  }

  /**
   * Create a file note (linked to C3D file path)
   */
  static async createFileNote(
    filePath: string,
    content: string
  ): Promise<ClinicalNote> {
    const requestData: CreateNoteRequest = {
      content: content.trim(),
      note_type: 'file'
    }

    // Ensure file path includes bucket name if not already present
    const fullPath = filePath.includes('/') ? filePath : `${this.BUCKET_NAME}/${filePath}`
    
    // Use query parameter for file path as expected by backend
    const params = new URLSearchParams({ file_path: fullPath })
    
    return this.apiRequest<ClinicalNote>(`/file?${params}`, {
      method: 'POST',
      body: JSON.stringify(requestData)
    })
  }

  /**
   * Create a patient note (using patient_code for convenience)
   */
  static async createPatientNote(
    patientCode: string,
    content: string
  ): Promise<ClinicalNote> {
    const requestData: CreateNoteRequest = {
      content: content.trim(),
      note_type: 'patient'
    }

    return this.apiRequest<ClinicalNote>(`/patient/${patientCode}`, {
      method: 'POST',
      body: JSON.stringify(requestData)
    })
  }

  /**
   * Get all file notes for a specific C3D file
   */
  static async getFileNotes(filePath: string): Promise<ClinicalNoteWithPatientCode[]> {
    // Ensure file path includes bucket name if not already present
    const fullPath = filePath.includes('/') ? filePath : `${this.BUCKET_NAME}/${filePath}`
    
    // Use query parameter for file path as expected by backend
    const params = new URLSearchParams({ file_path: fullPath })
    
    const response = await this.apiRequest<NotesListResponse>(
      `/file?${params}`
    )
    return response.notes
  }

  /**
   * Get all patient notes for a specific patient (using patient_code)
   */
  static async getPatientNotes(patientCode: string): Promise<ClinicalNoteWithPatientCode[]> {
    const response = await this.apiRequest<NotesListResponse>(
      `/patient/${patientCode}`
    )
    return response.notes
  }

  /**
   * Get notes by author (current user's notes)
   */
  static async getMyNotes(
    page: number = 1,
    limit: number = 50
  ): Promise<NotesListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    })

    return this.apiRequest<NotesListResponse>(`/my-notes?${params}`)
  }

  /**
   * Update an existing note
   */
  static async updateNote(noteId: string, content: string): Promise<ClinicalNote> {
    const requestData: UpdateNoteRequest = {
      content: content.trim()
    }

    return this.apiRequest<ClinicalNote>(`/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(requestData)
    })
  }

  /**
   * Delete a note
   */
  static async deleteNote(noteId: string): Promise<void> {
    await this.apiRequest<void>(`/${noteId}`, {
      method: 'DELETE'
    })
  }

  /**
   * Get note count indicators for UI performance (batch loading)
   */
  static async getNotesIndicators(
    filePaths: string[] = [],
    patientCodes: string[] = []
  ): Promise<NotesIndicators> {
    // Ensure file paths include bucket name if not already present
    const fullPaths = filePaths.map(path => 
      path.includes('/') ? path : `${this.BUCKET_NAME}/${path}`
    )
    
    const requestData: NotesIndicatorsRequest = {
      file_paths: fullPaths.length > 0 ? fullPaths : undefined,
      patient_codes: patientCodes.length > 0 ? patientCodes : undefined
    }

    return this.apiRequest<NotesIndicators>('/indicators', {
      method: 'POST',
      body: JSON.stringify(requestData)
    })
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
   */
  static async getNotesCount(
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
      console.warn(`Failed to get notes count for ${targetType}:${targetId}`, error)
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
}

export default ClinicalNotesService