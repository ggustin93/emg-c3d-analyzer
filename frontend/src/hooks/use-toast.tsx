/**
 * Toast hook using Sonner for proper toast notifications
 * 
 * Purpose: Provide user feedback for admin operations
 * Implementation: Uses Sonner library for actual toast display
 */

import { toast as sonnerToast } from "sonner"

interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    const { title, description, variant = 'default' } = options
    
    if (variant === 'destructive') {
      sonnerToast.error(title, {
        description: description
      })
    } else if (variant === 'success') {
      sonnerToast.success(title, {
        description: description
      })
    } else {
      sonnerToast(title, {
        description: description
      })
    }
  }
  
  return { toast }
}