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
      // Build absolute URL for production
      const baseUrl = window.location.origin
      const url = `${baseUrl}/content/faq/${filePath}`
      console.log(`Loading FAQ from: ${url}`)
      
      const response = await fetch(url)
      
      if (response.ok) {
        const content = await response.text()
        console.log(`Loaded content for ${filePath}:`, content.substring(0, 100))
        const faq = parseFAQFile(content, filePath)
        faqs.push(faq)
      } else {
        console.error(`Failed to load FAQ file: ${filePath} (${response.status})`)
        // Add a fallback FAQ item so the UI doesn't break
        faqs.push({
          id: filePath.replace('.md', '').split('/').pop() || 'unknown',
          question: `Failed to load: ${filePath}`,
          answer: 'Content could not be loaded. Please try refreshing the page.',
          category: 'technical' as FAQCategory,
          roles: ['all'],
          keywords: []
        })
      }
    } catch (error) {
      console.error(`Error loading FAQ file: ${filePath}`, error)
      // Add a fallback FAQ item
      faqs.push({
        id: filePath.replace('.md', '').split('/').pop() || 'unknown',
        question: `Error loading: ${filePath}`,
        answer: 'An error occurred while loading this content.',
        category: 'technical' as FAQCategory,
        roles: ['all'],
        keywords: []
      })
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