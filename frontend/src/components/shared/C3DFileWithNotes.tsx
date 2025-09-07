import React from 'react'
import { cn } from '@/lib/utils'
import { ClinicalNotesBadge, AddNoteBadge } from './ClinicalNotesBadge'
import { ClinicalNotesModal } from './ClinicalNotesModal'
import { useC3DFileNotes } from '../../hooks/useC3DFileNotes'
import { PatientCodeUtils } from '../../lib/patientCodeUtils'

/**
 * C3D File with Clinical Notes Integration
 * 
 * Example component showing how to easily add Clinical Notes to existing C3D file displays.
 * This can serve as a template for integrating notes into any file component.
 */

interface C3DFileWithNotesProps {
  filePath: string
  fileName?: string
  patientCode?: string
  className?: string
  children?: React.ReactNode
  
  // Optional: existing file component props
  fileSize?: number
  lastModified?: string
  processingStatus?: 'pending' | 'processing' | 'completed' | 'error'
  
  // Optional: disable notes feature
  notesEnabled?: boolean
}

export const C3DFileWithNotes: React.FC<C3DFileWithNotesProps> = ({
  filePath,
  fileName,
  patientCode,
  className,
  children,
  fileSize,
  lastModified,
  processingStatus = 'completed',
  notesEnabled = true
}) => {
  const {
    notesCount,
    hasNotes,
    loading,
    error,
    displayName,
    patientInfo,
    badgeProps,
    modalProps
  } = useC3DFileNotes({
    filePath,
    fileName,
    patientCode,
    enabled: notesEnabled,
    autoLoad: true
  })

  // Format file size
  const formatFileSize = (bytes: number = 0): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  // Status badge styling
  const getStatusBadge = (status: typeof processingStatus) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      processing: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      error: 'bg-red-100 text-red-800 border-red-200'
    }

    return (
      <span className={cn('px-2 py-1 text-xs font-medium rounded-full border', styles[status])}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className={cn('bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow', className)}>
      {/* File Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* File Name & Path */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 0h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z"/>
                  <path d="M4 2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM4 4.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM4 6.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5z"/>
                </svg>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-slate-800 truncate">
                  {fileName || filePath.split('/').pop()}
                </h3>
                {patientInfo.hasCode && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">Patient:</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                      {PatientCodeUtils.safeDisplay(patientInfo.code)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* File Info */}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {fileSize && (
                <span>{formatFileSize(fileSize)}</span>
              )}
              {lastModified && (
                <span>Modified {new Date(lastModified).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Actions & Status */}
          <div className="flex items-center gap-2 ml-4">
            {getStatusBadge(processingStatus)}
            
            {/* Clinical Notes Integration */}
            {notesEnabled && (
              <div className="flex items-center gap-2">
                {hasNotes ? (
                  <ClinicalNotesBadge {...badgeProps} />
                ) : (
                  !loading && (
                    <AddNoteBadge
                      type="file"
                      onClick={badgeProps.onClick}
                      disabled={badgeProps.disabled}
                      label="Add clinical note"
                    />
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">Notes error: {error}</p>
          </div>
        )}
      </div>

      {/* File Content */}
      {children && (
        <div className="p-4">
          {children}
        </div>
      )}

      {/* Clinical Notes Modal */}
      {notesEnabled && <ClinicalNotesModal {...modalProps} />}
    </div>
  )
}

/**
 * Simple File List Item with Notes
 * 
 * Minimal file list item component with notes integration
 */
interface SimpleFileWithNotesProps {
  filePath: string
  fileName: string
  patientCode?: string
  onClick?: () => void
  className?: string
}

export const SimpleFileWithNotes: React.FC<SimpleFileWithNotesProps> = ({
  filePath,
  fileName,
  patientCode,
  onClick,
  className
}) => {
  const { hasNotes, badgeProps, modalProps } = useC3DFileNotes({
    filePath,
    fileName,
    patientCode,
    enabled: true,
    autoLoad: false // Don't auto-load for list items
  })

  const resolvedPatientCode = patientCode || PatientCodeUtils.quickExtract(filePath)

  return (
    <div className={cn(
      'flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors',
      onClick && 'cursor-pointer',
      className
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0" onClick={onClick}>
        <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
          <svg className="w-3 h-3 text-blue-600" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 0h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z"/>
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">{fileName}</div>
          {resolvedPatientCode && (
            <div className="text-xs text-slate-500">
              Patient {PatientCodeUtils.safeDisplay(resolvedPatientCode)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasNotes ? (
          <ClinicalNotesBadge {...badgeProps} />
        ) : (
          <AddNoteBadge
            type="file"
            onClick={badgeProps.onClick}
            className="w-4 h-4"
          />
        )}
      </div>

      <ClinicalNotesModal {...modalProps} />
    </div>
  )
}

/**
 * File Grid Item with Notes
 * 
 * Grid-style file display with notes integration
 */
interface FileGridItemWithNotesProps {
  filePath: string
  fileName: string
  patientCode?: string
  thumbnail?: string
  processingStatus?: 'pending' | 'processing' | 'completed' | 'error'
  onClick?: () => void
  className?: string
}

export const FileGridItemWithNotes: React.FC<FileGridItemWithNotesProps> = ({
  filePath,
  fileName,
  patientCode,
  thumbnail,
  processingStatus = 'completed',
  onClick,
  className
}) => {
  const { hasNotes, loading, badgeProps, modalProps } = useC3DFileNotes({
    filePath,
    fileName,
    patientCode,
    enabled: true,
    autoLoad: false
  })

  const resolvedPatientCode = patientCode || PatientCodeUtils.quickExtract(filePath)

  return (
    <div className={cn(
      'bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all group',
      onClick && 'cursor-pointer',
      className
    )}>
      {/* Thumbnail/Icon */}
      <div className="aspect-square bg-slate-100 rounded-t-lg flex items-center justify-center relative overflow-hidden">
        {thumbnail ? (
          <img src={thumbnail} alt={fileName} className="w-full h-full object-cover" />
        ) : (
          <svg className="w-12 h-12 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 0h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z"/>
            <path d="M4 2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM4 4.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5z"/>
          </svg>
        )}

        {/* Notes Badge Overlay */}
        <div className="absolute top-2 right-2">
          {hasNotes ? (
            <ClinicalNotesBadge {...badgeProps} className="shadow-lg" />
          ) : (
            !loading && (
              <AddNoteBadge
                type="file"
                onClick={badgeProps.onClick}
                className="opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              />
            )
          )}
        </div>

        {/* Status Badge */}
        {processingStatus !== 'completed' && (
          <div className="absolute top-2 left-2">
            <span className={cn(
              'px-2 py-1 text-xs font-medium rounded-full',
              processingStatus === 'pending' && 'bg-yellow-100 text-yellow-800',
              processingStatus === 'processing' && 'bg-blue-100 text-blue-800',
              processingStatus === 'error' && 'bg-red-100 text-red-800'
            )}>
              {processingStatus}
            </span>
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="p-3" onClick={onClick}>
        <h3 className="text-sm font-medium text-slate-800 truncate mb-1">{fileName}</h3>
        
        {resolvedPatientCode && (
          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs text-slate-500">Patient</span>
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
              {PatientCodeUtils.safeDisplay(resolvedPatientCode)}
            </span>
          </div>
        )}

        <p className="text-xs text-slate-500 truncate">{filePath}</p>
      </div>

      <ClinicalNotesModal {...modalProps} />
    </div>
  )
}

export default {
  C3DFileWithNotes,
  SimpleFileWithNotes,
  FileGridItemWithNotes
}