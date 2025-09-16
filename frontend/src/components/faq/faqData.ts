/**
 * FAQ Category Definitions
 * Only contains category metadata - actual FAQ content is in markdown files
 */

import { FAQCategoryInfo } from './types'

export const faqCategories: FAQCategoryInfo[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    description: 'Learn the basics of using the EMG C3D Analyzer platform',
  },
  {
    id: 'patients',
    label: 'Patient Management',
    description: 'Managing patient records and information',
  },
  {
    id: 'sessions',
    label: 'Session Analysis',
    description: 'Analyzing C3D files and EMG data',
  },
  {
    id: 'export',
    label: 'Data Export',
    description: 'Exporting and sharing analysis results',
  },
  {
    id: 'technical',
    label: 'Technical Support',
    description: 'Troubleshooting and technical questions',
  }
]

// Helper function to get category info
export function getCategoryInfo(category: string): FAQCategoryInfo | undefined {
  return faqCategories.find(cat => cat.id === category)
}