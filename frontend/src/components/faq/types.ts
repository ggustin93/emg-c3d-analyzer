/**
 * Type definitions for FAQ components
 */

export type FAQCategory = 
  | 'getting-started' 
  | 'patients' 
  | 'sessions' 
  | 'export' 
  | 'technical'

export type UserRole = 'all' | 'therapist' | 'researcher' | 'admin'

export interface FAQItem {
  id: string
  question: string
  answer: string  // Markdown format supported
  category: FAQCategory
  roles: UserRole[]  // Which roles can see this FAQ
  keywords: string[]
  lastUpdated?: string
}

export interface FAQCategoryInfo {
  id: FAQCategory
  label: string
  description: string
  icon?: string
}