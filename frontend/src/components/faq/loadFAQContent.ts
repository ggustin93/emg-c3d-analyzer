import { parse } from 'yaml'
import { FAQItem, FAQCategory, UserRole } from './types'

// FAQ content files configuration
const FAQ_CATEGORIES = [
  'getting-started',
  'patients', 
  'sessions',
  'export',
  'technical'
] as const

// Known FAQ files structure
const FAQ_FILES = [
  'getting-started/what-is-platform.md',
  'getting-started/how-to-login.md',
  'patients/add-patient.md',
  'sessions/upload-c3d.md',
  'export/export-data.md'
] as const

export interface ParsedFAQ extends Omit<FAQItem, 'answer'> {
  answer: string
  id: string
}

function parseFrontmatter(content: string) {
  const frontmatterRegex = /^---\r?\n(.*?)\r?\n---\r?\n(.*)$/s
  const match = content.match(frontmatterRegex)
  
  if (!match) {
    return { data: {}, content }
  }
  
  const [, yamlStr, markdownContent] = match
  try {
    const data = parse(yamlStr)
    return { data, content: markdownContent.trim() }
  } catch {
    return { data: {}, content }
  }
}

function parseFAQFile(content: string, filePath: string): ParsedFAQ {
  const { data, content: markdownContent } = parseFrontmatter(content)
  
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

// Cache for loaded FAQs
let cachedFAQs: ParsedFAQ[] | null = null

export async function loadAllFAQs(): Promise<ParsedFAQ[]> {
  // Return cached data if available
  if (cachedFAQs) {
    return cachedFAQs
  }

  const faqs: ParsedFAQ[] = []
  
  // Load each FAQ file
  for (const filePath of FAQ_FILES) {
    try {
      const response = await fetch(`/content/faq/${filePath}`)
      
      if (response.ok) {
        const content = await response.text()
        const faq = parseFAQFile(content, filePath)
        faqs.push(faq)
      } else {
        console.warn(`Failed to load FAQ file: ${filePath} (${response.status})`)
      }
    } catch (error) {
      console.warn(`Error loading FAQ file: ${filePath}`, error)
    }
  }
  
  // Sort by category, then by question
  const sortedFAQs = faqs.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category)
    }
    return a.question.localeCompare(b.question)
  })

  // Cache the results
  cachedFAQs = sortedFAQs
  
  return sortedFAQs
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