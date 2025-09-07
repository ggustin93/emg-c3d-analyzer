import React from 'react'
import { cn } from '@/lib/utils'
import type { NoteBadgeProps } from '../../types/clinical-notes'

/**
 * Clinical Notes Badge Component
 * 
 * Compact, unobtrusive indicator showing note count with click interaction.
 * Designed to be easily integrated into existing file/patient displays.
 */
export const ClinicalNotesBadge: React.FC<NoteBadgeProps> = ({
  count,
  type,
  onClick,
  className,
  disabled = false,
  loading = false
}) => {
  // Don't render if no notes and not loading
  if (count === 0 && !loading) {
    return null
  }

  // Handle click with disabled state
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!disabled && !loading) {
      onClick()
    }
  }

  // Dynamic styling based on type and state
  const badgeStyles = cn(
    // Base styles
    'inline-flex items-center justify-center',
    'min-w-[1.25rem] h-5 px-1.5 py-0.5',
    'text-xs font-medium rounded-full',
    'border shadow-sm',
    'transition-all duration-200',
    'select-none',
    
    // Interactive states
    !disabled && !loading && [
      'cursor-pointer',
      'hover:shadow-md hover:scale-105',
      'active:scale-95',
    ],
    
    // Type-specific colors
    type === 'file' && [
      'bg-gradient-to-r from-blue-50 to-indigo-50',
      'border-blue-200 text-blue-700',
      !disabled && !loading && 'hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300',
    ],
    
    type === 'patient' && [
      'bg-gradient-to-r from-emerald-50 to-green-50',
      'border-emerald-200 text-emerald-700',
      !disabled && !loading && 'hover:from-emerald-100 hover:to-green-100 hover:border-emerald-300',
    ],
    
    // Loading state
    loading && [
      'bg-gradient-to-r from-slate-100 to-slate-50',
      'border-slate-200 text-slate-500',
      'animate-pulse',
    ],
    
    // Disabled state
    disabled && [
      'opacity-50 cursor-not-allowed',
    ],
    
    className
  )

  // Icon for note type
  const NoteIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h5.586a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V12.5A1.5 1.5 0 0 1 12.5 14h-8A1.5 1.5 0 0 1 3 12.5v-9zM4.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V6.414a.5.5 0 0 0-.146-.353L10.439 3.146A.5.5 0 0 0 10.086 3H4.5z"/>
      <path d="M5 7h6v1H5V7zm0 2h6v1H5V9z"/>
    </svg>
  )

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={badgeStyles}
      title={
        loading 
          ? 'Loading notes...'
          : count === 1 
            ? `1 clinical note (${type})`
            : `${count} clinical notes (${type})`
      }
      aria-label={
        loading 
          ? 'Loading clinical notes'
          : `${count} clinical ${type} notes, click to view`
      }
    >
      {loading ? (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
          <span>...</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <NoteIcon className="w-3 h-3" />
          <span>{count}</span>
        </div>
      )}
    </button>
  )
}

/**
 * Simple Note Indicator (Icon Only)
 * 
 * Minimal icon-only indicator for very compact spaces.
 */
interface SimpleNoteIndicatorProps {
  hasNotes: boolean
  type: 'file' | 'patient'
  onClick: () => void
  className?: string
  disabled?: boolean
}

export const SimpleNoteIndicator: React.FC<SimpleNoteIndicatorProps> = ({
  hasNotes,
  type,
  onClick,
  className,
  disabled = false
}) => {
  if (!hasNotes) {
    return null
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!disabled) {
      onClick()
    }
  }

  const indicatorStyles = cn(
    'w-4 h-4 rounded-full',
    'border-2 shadow-sm',
    'transition-all duration-200',
    'flex items-center justify-center',
    
    !disabled && [
      'cursor-pointer',
      'hover:shadow-md hover:scale-110',
      'active:scale-95',
    ],
    
    type === 'file' && [
      'bg-blue-500 border-blue-600',
      !disabled && 'hover:bg-blue-600',
    ],
    
    type === 'patient' && [
      'bg-emerald-500 border-emerald-600', 
      !disabled && 'hover:bg-emerald-600',
    ],
    
    disabled && 'opacity-50 cursor-not-allowed',
    
    className
  )

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={indicatorStyles}
      title={`Clinical ${type} notes available`}
      aria-label={`View clinical ${type} notes`}
    >
      <svg
        className="w-2 h-2 text-white"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
      </svg>
    </button>
  )
}

/**
 * Plus Button for Adding Notes
 * 
 * Clean button to add new notes when none exist.
 */
interface AddNoteBadgeProps {
  type: 'file' | 'patient'
  onClick: () => void
  className?: string
  disabled?: boolean
  label?: string
}

export const AddNoteBadge: React.FC<AddNoteBadgeProps> = ({
  type,
  onClick,
  className,
  disabled = false,
  label
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!disabled) {
      onClick()
    }
  }

  const badgeStyles = cn(
    'inline-flex items-center justify-center',
    'w-5 h-5',
    'rounded-full border border-dashed',
    'transition-all duration-200',
    'group',
    
    !disabled && [
      'cursor-pointer',
      'hover:scale-110 hover:shadow-sm',
      'active:scale-95',
    ],
    
    type === 'file' && [
      'border-blue-300 text-blue-400',
      !disabled && 'hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50',
    ],
    
    type === 'patient' && [
      'border-emerald-300 text-emerald-400',
      !disabled && 'hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50',
    ],
    
    disabled && 'opacity-50 cursor-not-allowed',
    
    className
  )

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={badgeStyles}
      title={label || `Add clinical ${type} note`}
      aria-label={label || `Add clinical ${type} note`}
    >
      <svg
        className="w-3 h-3 transition-transform duration-200 group-hover:scale-110"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
      </svg>
    </button>
  )
}

export default {
  ClinicalNotesBadge,
  SimpleNoteIndicator,
  AddNoteBadge
}