import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface CodeValidation {
  isValid: boolean
  message: string
}

/**
 * Custom hook for patient code generation and validation
 * Provides automatic code generation, format enforcement, and uniqueness validation
 * Follows P### format (P001, P002, etc.)
 */
export function usePatientCodeGeneration() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [validation, setValidation] = useState<CodeValidation | null>(null)
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Generate the next available patient code
   * Finds the first available number in sequence (P001, P002, etc.)
   */
  const generateCode = useCallback(async (): Promise<string> => {
    setIsGenerating(true)
    try {
      // Get existing patient codes to find next available
      const { data: existingPatients, error } = await supabase
        .from('patients')
        .select('patient_code')
        .order('patient_code')
      
      if (error) throw error
      
      // Extract numbers from existing codes (P001, P002, etc.)
      const existingNumbers = existingPatients
        .map(p => {
          const match = p.patient_code.match(/^P(\d{3})$/)
          return match ? parseInt(match[1]) : 0
        })
        .filter(n => n > 0)
        .sort((a, b) => a - b)
      
      // Find first available number
      let nextNumber = 1
      for (const num of existingNumbers) {
        if (num === nextNumber) {
          nextNumber++
        } else {
          break
        }
      }
      
      const newCode = `P${nextNumber.toString().padStart(3, '0')}`
      
      // Validate the new code immediately
      await validateCodeImmediate(newCode)
      
      return newCode
      
    } catch (error) {
      console.error('Failed to generate patient code:', error)
      throw error
    } finally {
      setIsGenerating(false)
    }
  }, [])

  /**
   * Validate patient code format and uniqueness immediately (no debouncing)
   */
  const validateCodeImmediate = useCallback(async (code: string) => {
    if (!code) {
      setValidation(null)
      return
    }
    
    // Check format (P### pattern - exactly P followed by 3 digits)
    const formatValid = /^P\d{3}$/.test(code)
    if (!formatValid) {
      if (code.length < 4) {
        setValidation({ 
          isValid: false, 
          message: 'Code must be P followed by 3 digits (e.g., P001)' 
        })
      } else {
        setValidation({ 
          isValid: false, 
          message: 'Invalid format. Must be exactly P### (e.g., P001, P123)' 
        })
      }
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('patient_code')
        .eq('patient_code', code)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }
      
      if (data) {
        setValidation({ 
          isValid: false, 
          message: 'This patient code already exists' 
        })
      } else {
        setValidation({ 
          isValid: true, 
          message: 'Patient code is available' 
        })
      }
    } catch (error) {
      console.error('Error validating patient code:', error)
      setValidation({ 
        isValid: false, 
        message: 'Error validating code' 
      })
    }
  }, [])

  /**
   * Validate patient code with debouncing (for user input)
   * Delays validation by 500ms to avoid excessive API calls
   */
  const validateCode = useCallback((code: string) => {
    // Clear any pending validation
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
    }
    
    if (!code) {
      setValidation(null)
      return
    }
    
    // Show format validation immediately (no API call needed)
    const formatValid = /^P\d{3}$/.test(code)
    if (!formatValid) {
      if (code.length < 4) {
        setValidation({ 
          isValid: false, 
          message: 'Code must be P followed by 3 digits (e.g., P001)' 
        })
      } else {
        setValidation({ 
          isValid: false, 
          message: 'Invalid format. Must be exactly P### (e.g., P001, P123)' 
        })
      }
      return
    }
    
    // Show pending state while waiting for validation
    setValidation({ 
      isValid: false, 
      message: 'Checking availability...' 
    })
    
    // Debounce the uniqueness check
    validationTimeoutRef.current = setTimeout(async () => {
      await validateCodeImmediate(code)
    }, 500)
  }, [validateCodeImmediate])

  /**
   * Format user input to enforce P### pattern
   * Automatically adds 'P' prefix and filters non-digits
   */
  const formatCode = useCallback((input: string): string => {
    let code = input.toUpperCase()
    
    // Enforce P### format as user types
    if (code && !code.startsWith('P')) {
      code = 'P' + code.replace(/[^0-9]/g, '')
    } else if (code.length > 1) {
      // Keep P and only digits, max 3 digits
      code = 'P' + code.slice(1).replace(/[^0-9]/g, '').slice(0, 3)
    }
    
    return code
  }, [])

  /**
   * Cleanup function to clear pending timeouts
   */
  const cleanup = useCallback(() => {
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
      validationTimeoutRef.current = null
    }
  }, [])

  return {
    isGenerating,
    validation,
    generateCode,
    validateCode,
    validateCodeImmediate,
    formatCode,
    cleanup
  }
}