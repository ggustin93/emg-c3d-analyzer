import matter from 'gray-matter'
import { FAQItem, FAQCategory, UserRole } from './types'

// Import all markdown files using Vite's import.meta.glob
const faqModules = import.meta.glob('/content/faq/**/*.md', { 
  eager: true,
  query: '?raw',
  import: 'default' 
})

export interface ParsedFAQ extends Omit<FAQItem, 'answer'> {
  answer: string
  id: string
}

function parseFAQFile(content: string, filePath: string): ParsedFAQ {
  const { data, content: markdownContent } = matter(content)
  
  // Generate ID from file path
  const id = filePath
    .split('/')
    .pop()
    ?.replace('.md', '') || ''
  
  return {
    id,
    question: data.question || 'Untitled Question',
    answer: markdownContent,
    category: data.category as FAQCategory || 'technical',
    roles: (data.roles as UserRole[]) || ['all'],
    keywords: (data.keywords as string[]) || [],
    lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toISOString().split('T')[0] : undefined
  }
}

export function loadAllFAQs(): ParsedFAQ[] {
  const faqs: ParsedFAQ[] = []
  
  for (const [path, module] of Object.entries(faqModules)) {
    if (typeof module === 'string') {
      try {
        const faq = parseFAQFile(module, path)
        faqs.push(faq)
      } catch (error) {
        console.warn(`Failed to parse FAQ file: ${path}`, error)
      }
    }
  }
  
  return faqs.sort((a, b) => {
    // Sort by category, then by question
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category)
    }
    return a.question.localeCompare(b.question)
  })
}

export function searchFAQs(faqs: ParsedFAQ[], query: string): ParsedFAQ[] {
  const lowercaseQuery = query.toLowerCase()
  
  return faqs.filter(item => 
    item.question.toLowerCase().includes(lowercaseQuery) ||
    item.answer.toLowerCase().includes(lowercaseQuery) ||
    item.keywords.some(keyword => keyword.toLowerCase().includes(lowercaseQuery)) ||
    item.category.toLowerCase().includes(lowercaseQuery)
  )
}

export function filterFAQsByRole(faqs: ParsedFAQ[], userRole: string): ParsedFAQ[] {
  const role = userRole.toLowerCase() as UserRole
  return faqs.filter(faq => 
    faq.roles.includes('all') || faq.roles.includes(role)
  )
}