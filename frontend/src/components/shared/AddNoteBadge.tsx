import React from 'react'
import { cn } from '@/lib/utils'
import { useNoteBadgeClick } from '@/hooks/useNoteBadgeClick'

/**
 * Add Note Badge Component (KISS/DRY/SOLID Refactored)
 * 
 * Single responsibility: Show "+" button to add notes when count is 0
 * Uses shared hook for DRY click handling
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
  const { handleClick } = useNoteBadgeClick({ onClick, disabled })

  // Simplified styling following KISS principle
  const badgeStyles = cn(
    'inline-flex items-center justify-center w-5 h-5',
    'rounded-full border border-dashed transition-all duration-200',
    
    // Interactive states - simplified
    !disabled && 'cursor-pointer hover:scale-110 active:scale-95',
    
    // Type-specific colors - simplified
    type === 'file' && 'border-blue-300 text-blue-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50',
    type === 'patient' && 'border-emerald-300 text-emerald-400 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50',
    
    // State styles
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
        className="w-3 h-3"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
      </svg>
    </button>
  )
}

export default AddNoteBadge