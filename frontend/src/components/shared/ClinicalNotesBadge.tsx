import React, { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useNoteBadgeClick } from '@/hooks/useNoteBadgeClick'
import type { NoteBadgeProps } from '../../types/clinical-notes'

// Constants for better maintainability and consistency
const BADGE_CONSTANTS = {
  MIN_WIDTH: 'min-w-[1.25rem]',
  HEIGHT: 'h-5',
  ICON_SIZE: 'w-3 h-3',
  LOADING_DOT_SIZE: 'w-2 h-2',
  ANIMATION_DURATION: 'duration-200',
  HOVER_SCALE: 'hover:scale-105',
  ACTIVE_SCALE: 'active:scale-95',
  DISABLED_OPACITY: 'opacity-50',
} as const

// Type-specific styling configuration
const TYPE_STYLES = {
  file: {
    background: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    hover: 'hover:bg-blue-100',
  },
  patient: {
    background: 'bg-emerald-50',
    border: 'border-emerald-200', 
    text: 'text-emerald-700',
    hover: 'hover:bg-emerald-100',
  },
} as const

/**
 * Clinical Notes Badge Component (Enhanced with Performance & Accessibility)
 * 
 * Features:
 * - Memoized for optimal re-render performance
 * - Enhanced accessibility with keyboard navigation
 * - Improved loading states and micro-interactions
 * - Type-safe styling system
 * - WCAG 2.1 AA compliant
 */
export const ClinicalNotesBadge: React.FC<NoteBadgeProps> = memo(({
  count,
  type,
  onClick,
  className,
  disabled = false,
  loading = false
}) => {
  const { handleClick } = useNoteBadgeClick({ onClick, disabled, loading })

  // Performance: Memoize expensive computations
  const { badgeStyles, title, ariaLabel } = useMemo(() => {
    const typeConfig = TYPE_STYLES[type]
    
    const styles = cn(
      // Base layout
      'inline-flex items-center justify-center gap-1',
      BADGE_CONSTANTS.MIN_WIDTH,
      BADGE_CONSTANTS.HEIGHT,
      'px-1.5 py-0.5',
      
      // Typography
      'text-xs font-medium rounded-full border',
      'transition-all',
      BADGE_CONSTANTS.ANIMATION_DURATION,
      'select-none',
      
      // Focus and accessibility
      'focus:outline-none focus:ring-2 focus:ring-offset-1',
      type === 'file' 
        ? 'focus:ring-blue-300' 
        : 'focus:ring-emerald-300',
      
      // Interactive states (only when not disabled/loading)
      !disabled && !loading && [
        'cursor-pointer',
        BADGE_CONSTANTS.HOVER_SCALE,
        BADGE_CONSTANTS.ACTIVE_SCALE,
        'hover:shadow-sm',
      ],
      
      // Type-specific colors
      !loading && [
        typeConfig.background,
        typeConfig.border,
        typeConfig.text,
        !disabled && typeConfig.hover,
      ],
      
      // Loading state
      loading && [
        'bg-slate-100',
        'border-slate-200', 
        'text-slate-500',
        'animate-pulse',
      ],
      
      // Disabled state
      disabled && [
        BADGE_CONSTANTS.DISABLED_OPACITY,
        'cursor-not-allowed',
      ],
      
      className
    )

    const titleText = loading 
      ? 'Loading notes...'
      : count === 1 
        ? `1 clinical note (${type})`
        : `${count} clinical notes (${type})`

    const ariaLabelText = loading 
      ? 'Loading clinical notes'
      : `${count} clinical ${type} note${count !== 1 ? 's' : ''}, click to view`

    return {
      badgeStyles: styles,
      title: titleText,
      ariaLabel: ariaLabelText,
    }
  }, [count, type, disabled, loading, className])

  // Early return for empty state (performance optimization)
  if (count === 0 && !loading) {
    return null
  }

  // Memoized note icon for better performance
  const NoteIcon = useMemo(() => (
    <svg 
      className={BADGE_CONSTANTS.ICON_SIZE} 
      viewBox="0 0 16 16" 
      fill="currentColor" 
      aria-hidden="true"
      role="img"
    >
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h5.586a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V12.5A1.5 1.5 0 0 1 12.5 14h-8A1.5 1.5 0 0 1 3 12.5v-9zM4.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V6.414a.5.5 0 0 0-.146-.353L10.439 3.146A.5.5 0 0 0 10.086 3H4.5z"/>
      <path d="M5 7h6v1H5V7zm0 2h6v1H5V9z"/>
    </svg>
  ), [])

  // Enhanced loading indicator
  const LoadingIndicator = useMemo(() => (
    <div className="flex items-center gap-1" role="status" aria-label="Loading">
      <div 
        className={cn(
          BADGE_CONSTANTS.LOADING_DOT_SIZE,
          'bg-current rounded-full',
          'animate-pulse'
        )} 
        aria-hidden="true"
      />
      <span aria-hidden="true">...</span>
    </div>
  ), [])

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={badgeStyles}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={false}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        // Enhanced keyboard navigation
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (!disabled && !loading) {
            handleClick(e as unknown as React.MouseEvent)
          }
        }
      }}
    >
      {loading ? LoadingIndicator : (
        <>
          {NoteIcon}
          <span>{count}</span>
        </>
      )}
    </button>
  )
})

export default ClinicalNotesBadge