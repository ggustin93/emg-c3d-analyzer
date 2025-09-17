import React, { useState, useEffect } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { 
  ActivityLogIcon, 
  LightningBoltIcon, 
  PersonIcon, 
  ComponentInstanceIcon, 
  HomeIcon,
  ChatBubbleIcon,
  ReloadIcon,
  InfoCircledIcon
} from '@radix-ui/react-icons'

// Map section IDs to icons - semantically appropriate for medical/research content
const iconMap: Record<string, React.ReactNode> = {
  'clinical-trial': <ActivityLogIcon className="w-4 h-4 text-blue-600" />, // Clinical data/trials
  'research-problem': <LightningBoltIcon className="w-4 h-4 text-blue-600" />, // Innovation/breakthrough
  'research-team': <PersonIcon className="w-4 h-4 text-blue-600" />, // Team/consortium - using PersonIcon (reliable)
  'technology': <ComponentInstanceIcon className="w-4 h-4 text-blue-600" />, // Technology/EMG components
  'institution': <HomeIcon className="w-4 h-4 text-blue-600" />, // Institution/university
  'contact': <ChatBubbleIcon className="w-4 h-4 text-blue-600" /> // Contact/communication
}

interface AboutSection {
  id: string
  title: string
  content: string
  subsections?: {
    title: string
    content: string
  }[]
}

// Parse markdown content into structured sections
function parseMarkdownContent(markdown: string): {
  hero: string
  sections: AboutSection[]
} {
  const lines = markdown.split('\n')
  let hero = ''
  const sections: AboutSection[] = []
  let currentSection: AboutSection | null = null
  let currentSubsection: { title: string; content: string } | null = null
  let contentBuffer: string[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Skip the main title
    if (line.startsWith('# ')) continue
    
    // Section header (## level)
    if (line.startsWith('## ')) {
      // Save previous content
      if (currentSubsection) {
        currentSubsection.content = contentBuffer.join('\n').trim()
        contentBuffer = []
        currentSubsection = null
      } else if (currentSection && contentBuffer.length > 0) {
        currentSection.content = contentBuffer.join('\n').trim()
        contentBuffer = []
      }
      
      const sectionId = line.slice(3).trim()
      
      // Handle hero section specially
      if (sectionId === 'hero') {
        // Read until next section
        i++
        while (i < lines.length && !lines[i].startsWith('##')) {
          contentBuffer.push(lines[i])
          i++
        }
        hero = contentBuffer.join('\n').trim()
        contentBuffer = []
        i-- // Back up one line
        continue
      }
      
      // Start new section
      currentSection = {
        id: sectionId,
        title: '',
        content: '',
        subsections: []
      }
      sections.push(currentSection)
    }
    // Section title (### level)
    else if (line.startsWith('### ') && currentSection) {
      // Save previous subsection if exists
      if (currentSubsection) {
        currentSubsection.content = contentBuffer.join('\n').trim()
        contentBuffer = []
      } else if (contentBuffer.length > 0) {
        currentSection.content = contentBuffer.join('\n').trim()
        contentBuffer = []
      }
      
      currentSection.title = line.slice(4).trim()
      currentSubsection = null
    }
    // Subsection (#### level)
    else if (line.startsWith('#### ') && currentSection) {
      // Save previous subsection
      if (currentSubsection) {
        currentSubsection.content = contentBuffer.join('\n').trim()
        contentBuffer = []
      }
      
      currentSubsection = {
        title: line.slice(5).trim(),
        content: ''
      }
      currentSection.subsections!.push(currentSubsection)
    }
    // Regular content
    else {
      contentBuffer.push(line)
    }
  }
  
  // Save final content
  if (currentSubsection) {
    currentSubsection.content = contentBuffer.join('\n').trim()
  } else if (currentSection && contentBuffer.length > 0) {
    currentSection.content = contentBuffer.join('\n').trim()
  }
  
  return { hero, sections }
}

// Render markdown content with proper formatting
const renderContent = (section: AboutSection) => {
  const lines = section.content.split('\n').filter(line => line.trim())
  const subsections = section.subsections || []
  
  return (
    <div className="space-y-6 text-gray-600">
      {/* Main section content if exists */}
      {lines.length > 0 && lines.some(line => 
        line.startsWith('**Primary Goal:') || 
        line.startsWith('**GHOSTLY+') ||
        line.startsWith('**Funding:') ||
        line.startsWith('**Project ID:') ||
        line.startsWith('**Duration:') ||
        line.startsWith('**ETRO')
      ) && (
        <div>
          {lines.map((line, idx) => {
            // Special formatting for highlighted content
            if (line.startsWith('**Primary Goal:') || line.startsWith('**GHOSTLY+')) {
              return (
                <div key={idx} className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-amber-800 text-sm" dangerouslySetInnerHTML={{ 
                    __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                  }} />
                </div>
              )
            }
            
            // Institution section special formatting
            if (section.id === 'institution' && line.includes('ETRO')) {
              return (
                <div key={idx}>
                  <h4 className="font-semibold text-gray-800 mb-3">ETRO - Electronics and Informatics</h4>
                  <p>Vrije Universiteit Brussel (VUB)</p>
                </div>
              )
            }
            
            if (section.id === 'institution' && line.includes('Leading research')) {
              return <p key={idx} className="mt-2">{line}</p>
            }
            
            // Contact section special formatting for funding info
            if (section.id === 'contact' && (
              line.includes('Funding') || 
              line.includes('Project ID') || 
              line.includes('Duration')
            )) {
              return null // Will be rendered in the footer section
            }
            
            return null
          })}
        </div>
      )}
      
      {/* Render subsections */}
      {subsections.map((sub, idx) => (
        <div key={idx}>
          <h4 className="font-semibold text-gray-800 mb-3">{sub.title}</h4>
          
          {/* Technology stack style (pipe-separated) */}
          {sub.content.includes('|') && !sub.content.includes('\n') ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {sub.content.split('|').map((item, i) => (
                <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  {item.trim()}
                </span>
              ))}
            </div>
          ) : (
            // List style content or paragraph
            sub.content.includes('- ') ? (
              <ul className="space-y-2">
                {sub.content.split('\n').filter(line => line.trim()).map((line, i) => {
                  const cleanLine = line.replace(/^- /, '').trim()
                  if (!cleanLine) return null
                  
                  // Handle bold text and special formatting
                  const formattedLine = cleanLine.replace(/\*\*(.*?):\*\*/g, '<strong>$1:</strong>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  
                  return (
                    <li key={i} dangerouslySetInnerHTML={{ __html: `• ${formattedLine}` }} />
                  )
                })}
              </ul>
            ) : (
              // Paragraph content
              <div>
                {sub.content.split('\n').filter(line => line.trim()).map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''} dangerouslySetInnerHTML={{
                    __html: line.replace(/\*\*(.*?):\*\*/g, '<strong>$1:</strong>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  }} />
                ))}
              </div>
            )
          )}
        </div>
      ))}
      
      {/* Contact section footer with funding info */}
      {section.id === 'contact' && section.content.includes('Funding') && (
        <div className="pt-4 border-t">
          {section.content.split('\n')
            .filter(line => line.includes('Funding') || line.includes('Project ID') || line.includes('Duration'))
            .map((line, i) => {
              const formatted = line.replace(/\*\*(.*?):\*\*/g, '<strong>$1:</strong>')
              return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
            })}
        </div>
      )}
    </div>
  )
}

export const AboutPage: React.FC = () => {
  const [content, setContent] = useState<{ hero: string; sections: AboutSection[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load markdown content
    fetch('/src/content/about.md')
      .then(response => {
        if (!response.ok) throw new Error('Failed to load about content')
        return response.text()
      })
      .then(markdown => {
        const parsed = parseMarkdownContent(markdown)
        setContent(parsed)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading about content:', err)
        setError('Failed to load about content')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <ReloadIcon className="w-5 h-5 animate-spin" />
          <span>Loading content...</span>
        </div>
      </div>
    )
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">
          {error || 'No content available'}
        </div>
      </div>
    )
  }

  // Extract hero parts
  const heroLines = content.hero.split('\n')
  const heroTitle = heroLines[0]
  const heroHighlight = heroLines.slice(1).join(' ')

  return (
    <div className="p-6 space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <InfoCircledIcon className="h-6 w-6 text-blue-500" />
            <CardTitle className="text-2xl">Trial information</CardTitle>
          </div>
          <CardDescription className="mt-2">
            {heroTitle}
          </CardDescription>
        </CardHeader>
          {/* Key Highlight Card */}
      {heroHighlight && (
      
      
      <div className="bg-blue-50 border-l-4 border-blue-600 ml-6 mr-6 mb-6 p-6 rounded-r">
        <p className="text-blue-900" dangerouslySetInnerHTML={{
          __html: heroHighlight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        }} />
      </div>

)}
      </Card>

    

      {/* Accordion Sections */}
      <Card>
        <CardContent className="pt-6">
          <Accordion 
            type="multiple" 
            defaultValue={[]}
            className="space-y-3"
          >
            {content.sections.map((section) => (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <AccordionTrigger className="px-6 py-4 hover:bg-gray-50">
                  <span className="flex items-center gap-3 text-left font-semibold text-gray-900">
                    {iconMap[section.id] || <ComponentInstanceIcon className="w-4 h-4 text-blue-600" />}
                    {section.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  {renderContent(section)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Footer Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-center space-y-2">
            <img 
              src="/vub_etro_logo.png" 
              alt="VUB ETRO" 
              className="h-12 mx-auto mb-4 opacity-75"
            />
            <p className="text-sm text-muted-foreground">
              A collaborative research project advancing rehabilitation technology
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}