import React from 'react'
import Markdown from 'react-markdown'
import { 
  AccordionItem,
  AccordionTrigger,
  AccordionContent 
} from '../ui/accordion'
import { Badge } from '../ui/badge'
import { FAQItem as FAQItemType } from './types'
import { getCategoryInfo } from './faqData'

interface FAQItemProps {
  item: FAQItemType
  value: string
}

export function FAQItem({ item, value }: FAQItemProps) {
  const categoryInfo = getCategoryInfo(item.category)
  
  return (
    <AccordionItem value={value} className="border-b">
      <AccordionTrigger className="hover:no-underline py-4">
        <div className="flex items-center justify-between w-full pr-4">
          <span className="text-left font-medium text-blue-600 hover:text-blue-700">{item.question}</span>
          <Badge variant="secondary" className="ml-2 shrink-0">
            {categoryInfo?.label || item.category}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="prose prose-slate prose-sm max-w-none">
          <Markdown
            components={{
              // Override default styles for better readability
              h3: ({children}) => (
                <h3 className="text-base font-semibold text-slate-900 mt-4 mb-2">{children}</h3>
              ),
              p: ({children}) => (
                <p className="text-slate-700 leading-relaxed mb-3">{children}</p>
              ),
              ul: ({children}) => (
                <ul className="list-disc list-inside space-y-1 mb-3 text-slate-700">{children}</ul>
              ),
              ol: ({children}) => (
                <ol className="list-decimal list-inside space-y-1 mb-3 text-slate-700">{children}</ol>
              ),
              li: ({children}) => (
                <li className="text-slate-700">{children}</li>
              ),
              strong: ({children}) => (
                <strong className="font-semibold text-slate-900">{children}</strong>
              ),
              code: ({children}) => (
                <code className="px-1 py-0.5 bg-slate-100 rounded text-sm text-slate-800">{children}</code>
              ),
              blockquote: ({children}) => (
                <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-3">
                  {children}
                </blockquote>
              )
            }}
          >
            {item.answer}
          </Markdown>
          {item.lastUpdated && (
            <p className="text-xs text-muted-foreground mt-4 border-t pt-2">
              Last updated: {item.lastUpdated}
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}