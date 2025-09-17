/**
 * C3D Upload Mutation Hook
 * 
 * Handles file upload workflow with automatic cache invalidation
 * and optimistic updates for smooth user experience.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import { logger, LogCategory } from '../services/logger'

export interface UploadFile {
  name: string
  file: File
  size: number
  type: string
}

export interface UploadResponse {
  success: boolean
  uploadedFiles: string[]
  errors?: string[]
}

// Upload function - this will call the actual upload service
async function uploadFiles(files: UploadFile[]): Promise<UploadResponse> {
  // TODO: This will be integrated with the actual upload service
  // For now, simulate upload behavior
  try {
    logger.info(LogCategory.API, `Uploading ${files.length} files...`)
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const uploadedFiles = files.map(f => f.name)
    
    return {
      success: true,
      uploadedFiles
    }
  } catch (error) {
    logger.error(LogCategory.API, 'Upload failed:', error)
    throw error
  }
}

export interface UploadMutationOptions {
  onSuccess?: (data: UploadResponse) => void
  onError?: (error: Error) => void
  onSettled?: () => void
}

export function useC3DUploadMutation(options?: UploadMutationOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadFiles,
    
    onSuccess: (data) => {
      // Smart cache invalidation - invalidate related queries
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.c3dBrowser.files() 
      })
      
      // Also invalidate all c3d-browser queries to refresh dependent data
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.c3dBrowser.all 
      })
      
      logger.info(LogCategory.API, `Successfully uploaded ${data.uploadedFiles.length} files`)
      
      // Call custom success handler if provided
      options?.onSuccess?.(data)
    },
    
    onError: (error: Error) => {
      logger.error(LogCategory.API, 'Upload mutation failed:', error)
      
      // Call custom error handler if provided
      options?.onError?.(error)
    },
    
    onSettled: () => {
      // Call custom settled handler if provided
      options?.onSettled?.()
    }
  })
}

// Types are already exported above