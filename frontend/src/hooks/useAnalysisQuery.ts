/**
 * Analysis Result Caching Hook
 * 
 * Caches expensive EMG analysis computations with longer retention
 * for instant re-access and improved user experience.
 */
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import { logger, LogCategory } from '../services/logger'
import SupabaseStorageService from '../services/supabaseStorage'
import { API_CONFIG } from '../config/apiConfig'

export interface AnalysisParams {
  filename: string
  sessionParams?: any
  processingOptions?: {
    filterType?: string
    thresholds?: Record<string, number>
    analysisType?: 'full' | 'quick'
  }
}

export interface AnalysisResult {
  filename: string
  processingTime: number
  results: {
    emgData?: any
    metrics?: any
    visualizations?: any
    summary?: any
  }
  metadata: {
    processedAt: string
    version: string
    parameters: any
  }
}

// Analysis function - this performs the actual EMG analysis with caching
async function fetchEMGAnalysis(
  filename: string, 
  sessionParams?: any
): Promise<AnalysisResult> {
  try {
    logger.info(LogCategory.API, `🔍 Starting cached EMG analysis for file: ${filename}`)
    const startTime = Date.now()
    
    // Step 1: Download file from Supabase Storage
    logger.info(LogCategory.API, '📥 Downloading file from storage...')
    const blob = await SupabaseStorageService.downloadFile(filename)
    const file = new File([blob], filename, { type: 'application/octet-stream' })
    
    // Step 2: Prepare FormData for upload API
    const formData = new FormData()
    formData.append('file', file, filename)
    formData.append('filename', filename)
    
    // Add all session parameters to the form data
    if (sessionParams) {
      Object.keys(sessionParams).forEach(key => {
        const value = sessionParams[key]
        if (value !== null && value !== undefined) {
          if (key === 'channel_muscle_mapping' || key === 'muscle_color_mapping' || 
              key === 'session_mvc_values' || key === 'session_mvc_threshold_percentages') {
            formData.append(key, JSON.stringify(value || {}))
          } else {
            formData.append(key, String(value))
          }
        }
      })
    }
    
    // Step 3: Send to backend for processing
    logger.info(LogCategory.API, '⚡ Processing file on backend...')
    const apiUrl = API_CONFIG.getBaseUrl() + '/upload'
    
    const uploadResponse = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    })
    
    if (!uploadResponse.ok) {
      let errorData: any
      try {
        errorData = await uploadResponse.json()
      } catch {
        errorData = { detail: `Server error: ${uploadResponse.status}` }
      }
      throw new Error(errorData.detail || 'Analysis failed')
    }
    
    // Step 4: Get results
    const analysisData = await uploadResponse.json()
    const processingTime = Date.now() - startTime
    
    logger.info(LogCategory.API, `✅ Cached EMG analysis completed in ${processingTime}ms`)
    
    // Return in the expected AnalysisResult format
    return {
      filename,
      processingTime,
      results: {
        emgData: analysisData, // The full EMG analysis result
        metrics: analysisData?.analytics || {},
        summary: analysisData?.metadata || {}
      },
      metadata: {
        processedAt: new Date().toISOString(),
        version: '1.0.0',
        parameters: sessionParams || {}
      }
    }
    
  } catch (error) {
    logger.error(LogCategory.API, 'Cached EMG analysis failed:', error)
    throw new Error(`Analysis failed for ${filename}: ${error}`)
  }
}

export function useAnalysisQuery(params: AnalysisParams) {
  const { filename, sessionParams } = params
  
  return useQuery({
    queryKey: queryKeys.upload.analysis(filename),
    queryFn: () => fetchEMGAnalysis(filename, sessionParams),
    enabled: !!filename,
    
    // Longer cache times for expensive analysis results
    staleTime: 10 * 60 * 1000,  // 10 minutes - analysis results stay fresh longer
    gcTime: 30 * 60 * 1000,     // 30 minutes - keep analysis results in cache longer
    
    // Retry configuration for analysis operations
    retry: (failureCount, error) => {
      // Don't retry client errors, but retry network/server errors up to 2 times
      if (error.message.includes('404') || error.message.includes('400')) {
        return false
      }
      return failureCount < 2
    },
    
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Utility hook for multiple analysis queries
export function useMultipleAnalysisQueries(analysisParams: AnalysisParams[]) {
  const results = analysisParams.map(params => 
    useAnalysisQuery(params)
  )
  
  return {
    results,
    isLoading: results.some(r => r.isLoading),
    hasError: results.some(r => r.error),
    allSuccess: results.every(r => r.data && !r.error),
    completed: results.filter(r => r.data).length,
    total: results.length
  }
}

// Types are already exported above