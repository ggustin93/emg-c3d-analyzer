/**
 * FAQ Content Data
 * Uses markdown format for answers to allow non-technical users to update easily
 */

import { FAQItem, FAQCategory, FAQCategoryInfo } from './types'
import { 
  FAQ_CONFIG,
  getBrowserRequirements, 
  getScreenResolution,
  getEMGMetrics,
  getUserRolesDescription,
  getSecurityFeatures
} from './faqConfig'

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

// FAQ items with markdown-formatted answers
export const faqItems: FAQItem[] = [
  // Getting Started
  {
    id: 'gs-1',
    question: 'What is the EMG C3D Analyzer?',
    answer: `The **EMG C3D Analyzer** is a rehabilitation technology platform designed to process C3D files from the GHOSTLY+ game.

Key Features:
- **EMG Data Extraction**: Automatically extracts electromyography data from C3D files
- **Clinical Analysis**: Provides detailed analysis for therapeutic assessment
- **Patient Management**: Track patient progress over multiple sessions
- **Export Capabilities**: Export data in CSV format for further analysis`,
    category: 'getting-started',
    roles: ['all'],
    keywords: ['introduction', 'overview', 'about', 'platform'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },
  {
    id: 'gs-2',
    question: 'How do I log in to the system?',
    answer: `To access the EMG C3D Analyzer:
1. Navigate to the login page
2. Enter your **email address** and **password**
3. Click the **"Sign in"** button

${getUserRolesDescription()}`,
    category: 'getting-started',
    roles: ['all'],
    keywords: ['login', 'sign in', 'access', 'authentication'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },

  // Patient Management
  {
    id: 'pm-1',
    question: 'How do I add a new patient?',
    answer: `To add a new patient:
1. Navigate to the **Patients** tab
2. Click the **"Add Patient"** button
3. Fill in the required information
4. Click **"Save"**`,
    category: 'patients',
    roles: ['therapist'],
    keywords: ['add', 'create', 'new', 'patient', 'registration'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },
  {
    id: 'pm-2',
    question: 'What do the different patient avatar colors mean?',
    answer: `The patient avatar colors are automatically assigned to help visually distinguish between different patients. Colors are generated based on the patient's name and have no clinical meaning - they're simply a visual aid for easier navigation.`,
    category: 'patients',
    roles: ['therapist'],
    keywords: ['avatar', 'colors', 'identification', 'visual'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },

  // Session Analysis
  {
    id: 'sa-1',
    question: 'How do I upload and analyze a C3D file?',
    answer: `To upload and analyze a C3D file:
1. Go to the **Sessions** tab
2. Click **"Upload C3D File"** button
3. Select your C3D file from your computer
4. The system automatically processes the file

The system supports up to ${FAQ_CONFIG.emg.maxChannels} EMG channels and automatically identifies muscle contractions.`,
    category: 'sessions',
    roles: ['all'],
    keywords: ['upload', 'c3d', 'file', 'analysis', 'process'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },
  {
    id: 'sa-2',
    question: 'What EMG metrics are calculated?',
    answer: `The system calculates:
${getEMGMetrics()}`,
    category: 'sessions',
    roles: ['all'],
    keywords: ['metrics', 'emg', 'analysis', 'calculations', 'measurements'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },

  // Data Export
  {
    id: 'de-1',
    question: 'How do I export session data?',
    answer: `To export session data:
1. Navigate to the session you want to export
2. Click the **"Export"** button
3. Choose your export format (${FAQ_CONFIG.exportFormats.csvDetailed} or ${FAQ_CONFIG.exportFormats.csvSummary})

The export includes patient information (anonymized for researchers), session metadata, EMG channel data, and calculated metrics.`,
    category: 'export',
    roles: ['all'],
    keywords: ['export', 'csv', 'download', 'data', 'report'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },

  // Technical Support
  {
    id: 'ts-1',
    question: 'What browsers are supported?',
    answer: `${getBrowserRequirements()}

Internet Explorer is not supported. For best experience, keep your browser updated and use a screen resolution of ${getScreenResolution()} or higher.`,
    category: 'technical',
    roles: ['all'],
    keywords: ['browser', 'compatibility', 'chrome', 'firefox', 'safari'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },
  {
    id: 'ts-2',
    question: 'How is patient data protected?',
    answer: getSecurityFeatures(),
    category: 'technical',
    roles: ['all'],
    keywords: ['security', 'privacy', 'data protection', 'encryption', 'gdpr', 'hipaa'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },

  // Researcher-specific
  {
    id: 'rs-1',
    question: 'Why can\'t I see patient names?',
    answer: `As a researcher, you have access to anonymized data only to protect patient privacy. You can see patient codes and session data, but personal identifying information is hidden for privacy compliance.`,
    category: 'patients',
    roles: ['researcher'],
    keywords: ['anonymized', 'privacy', 'researcher', 'names'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },

  // Therapist-specific
  {
    id: 'th-1',
    question: 'How do I add clinical notes to a patient?',
    answer: `To add clinical notes:
1. Go to **Patients** tab
2. Click on a patient to open their profile
3. Click **Add Clinical Note** button
4. Enter your observations
5. Click **Save**`,
    category: 'patients',
    roles: ['therapist'],
    keywords: ['clinical', 'notes', 'therapist'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  },

  // Admin-specific
  {
    id: 'ad-1',
    question: 'How do I manage user accounts?',
    answer: `As an admin, you can:
1. Go to **Admin Dashboard**
2. Click **Users** tab
3. Create new users, edit roles, reset passwords, or deactivate accounts`,
    category: 'technical',
    roles: ['admin'],
    keywords: ['admin', 'users', 'accounts', 'management'],
    lastUpdated: FAQ_CONFIG.defaultUpdateDate
  }
]

// Helper function to search FAQ items
export function searchFAQ(query: string): FAQItem[] {
  const lowercaseQuery = query.toLowerCase()
  
  return faqItems.filter(item => 
    item.question.toLowerCase().includes(lowercaseQuery) ||
    item.answer.toLowerCase().includes(lowercaseQuery) ||
    item.keywords.some(keyword => keyword.toLowerCase().includes(lowercaseQuery)) ||
    item.category.toLowerCase().includes(lowercaseQuery)
  )
}

// Helper function to get FAQ items by category
export function getFAQByCategory(category: FAQCategory): FAQItem[] {
  return faqItems.filter(item => item.category === category)
}

// Helper function to get category info
export function getCategoryInfo(category: FAQCategory): FAQCategoryInfo | undefined {
  return faqCategories.find(cat => cat.id === category)
}