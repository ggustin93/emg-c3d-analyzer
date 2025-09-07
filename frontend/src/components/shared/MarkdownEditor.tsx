import React, { useRef, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import FormattingToolbar from './FormattingToolbar'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  rows?: number
  maxLength?: number
  showToolbar?: boolean
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your note...',
  disabled = false,
  className,
  rows = 6,
  maxLength,
  showToolbar = true
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Handle formatting operations from toolbar
  const handleFormat = useCallback((format: string, wrapper?: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const { selectionStart, selectionEnd, value: currentValue } = textarea
    const selectedText = currentValue.substring(selectionStart, selectionEnd)
    
    let newText = ''
    let newCursorPos = selectionStart

    if (wrapper) {
      // Wrapping format (bold, italic, code, link)
      if (format === '[' && wrapper === '](url)') {
        // Special case for links
        newText = selectedText ? `[${selectedText}](url)` : '[Link text](url)'
        newCursorPos = selectionStart + (selectedText ? selectedText.length + 3 : 11) // Position after 'url' or at 'Link text'
      } else {
        // Standard wrapping (bold, italic, code)
        newText = `${format}${selectedText || 'text'}${wrapper}`
        newCursorPos = selectedText 
          ? selectionStart + format.length + selectedText.length + wrapper.length
          : selectionStart + format.length + 4 // Position after 'text'
      }
    } else {
      // Prefix format (heading, list, quote)
      const lines = currentValue.split('\n')
      const startLine = currentValue.substring(0, selectionStart).split('\n').length - 1
      const endLine = currentValue.substring(0, selectionEnd).split('\n').length - 1
      
      // Apply format to selected lines
      for (let i = startLine; i <= endLine; i++) {
        if (lines[i] !== undefined) {
          // Remove existing format if present
          const trimmedLine = lines[i].replace(/^(#{1,6}\s|>\s|-\s|\*\s|\+\s|\d+\.\s)/, '')
          lines[i] = format + trimmedLine
        }
      }
      
      newText = lines.join('\n')
      onChange(newText)
      
      // Set cursor position after formatting
      setTimeout(() => {
        const newLinePos = lines.slice(0, startLine).join('\n').length + (startLine > 0 ? 1 : 0)
        const newCursor = newLinePos + format.length
        textarea.setSelectionRange(newCursor, newCursor)
        textarea.focus()
      }, 0)
      
      return
    }

    // Apply the formatting
    const before = currentValue.substring(0, selectionStart)
    const after = currentValue.substring(selectionEnd)
    const result = before + newText + after

    onChange(result)

    // Set cursor position
    setTimeout(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos)
      textarea.focus()
    }, 0)
  }, [onChange])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.ctrlKey && !e.metaKey) return

    switch (e.key) {
      case 'b':
        e.preventDefault()
        handleFormat('**', '**')
        break
      case 'i':
        e.preventDefault()
        handleFormat('*', '*')
        break
      case 'k':
        e.preventDefault()
        handleFormat('[', '](url)')
        break
      case '`':
        e.preventDefault()
        handleFormat('`', '`')
        break
      case 'h':
        e.preventDefault()
        handleFormat('## ')
        break
      case 'l':
        e.preventDefault()
        handleFormat('- ')
        break
      case 'q':
        e.preventDefault()
        handleFormat('> ')
        break
    }
  }, [handleFormat])

  // Character count for display
  const characterCount = useMemo(() => {
    if (!maxLength) return null
    const count = value.length
    const remaining = maxLength - count
    return { count, remaining, isNearLimit: remaining < 100 }
  }, [value, maxLength])

  return (
    <div className={cn('flex flex-col', className)}>
      {showToolbar && (
        <FormattingToolbar 
          onFormat={handleFormat} 
          disabled={disabled}
        />
      )}
      
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          className={cn(
            'w-full p-3 text-sm font-mono resize-none',
            'border-0 focus:outline-none focus:ring-0',
            'bg-white text-slate-800 placeholder-slate-400',
            'leading-relaxed',
            disabled && 'bg-slate-50 text-slate-500 cursor-not-allowed'
          )}
          style={{ 
            lineHeight: '1.6',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          }}
        />
        
        {/* Character count */}
        {characterCount && (
          <div className={cn(
            'absolute bottom-2 right-3 text-xs',
            characterCount.isNearLimit ? 'text-red-500' : 'text-slate-400'
          )}>
            {characterCount.count}{maxLength && `/${maxLength}`}
          </div>
        )}
      </div>
      
      {/* Markdown tips */}
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>**bold**</span>
            <span>*italic*</span>
            <span>`code`</span>
            <span>[link](url)</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10h6v4H9v-4z"/>
            </svg>
            <span>Markdown supported</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MarkdownEditor