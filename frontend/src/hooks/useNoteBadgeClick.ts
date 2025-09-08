/**
 * Shared hook for clinical notes badge click handling
 * Implements DRY principle by centralizing common click behavior
 */
import { useCallback } from 'react'

interface UseNoteBadgeClickProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

export const useNoteBadgeClick = ({ onClick, disabled = false, loading = false }: UseNoteBadgeClickProps) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!disabled && !loading) {
      onClick()
    }
  }, [onClick, disabled, loading])

  return { handleClick }
}