import React from 'react'
import { cn } from '@/lib/utils'

interface FormattingToolbarProps {
  onFormat: (format: string, wrapper?: string) => void
  className?: string
  disabled?: boolean
}

interface FormatButton {
  name: string
  icon: React.ReactNode
  format: string
  wrapper?: string
  title: string
  shortcut?: string
}

export const FormattingToolbar: React.FC<FormattingToolbarProps> = ({
  onFormat,
  className,
  disabled = false
}) => {
  const formatButtons: FormatButton[] = [
    {
      name: 'bold',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h8a4 4 0 0 1 4 4 3.5 3.5 0 0 1-1.27 2.68A4 4 0 0 1 14 19H6V4zm2 2v4h6a2 2 0 1 0 0-4H8zm0 6v5h6a2 2 0 1 0 0-4H8z"/></svg>,
      format: '**',
      wrapper: '**',
      title: 'Bold',
      shortcut: 'Ctrl+B'
    },
    {
      name: 'italic',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4h-8z"/></svg>,
      format: '*',
      wrapper: '*',
      title: 'Italic',
      shortcut: 'Ctrl+I'
    },
    {
      name: 'heading',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4v3h5.5v12h3V7H19V4H5z"/></svg>,
      format: '## ',
      title: 'Heading',
      shortcut: 'Ctrl+H'
    },
    {
      name: 'list',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h14v2H7V5zm0 8v-2h14v2H7zM4 4.5A1.5 1.5 0 1 1 4 7.5 1.5 1.5 0 0 1 4 4.5zM4 10.5A1.5 1.5 0 1 1 4 13.5 1.5 1.5 0 0 1 4 10.5zM7 19h14v-2H7v2zM4 16.5A1.5 1.5 0 1 1 4 19.5 1.5 1.5 0 0 1 4 16.5z"/></svg>,
      format: '- ',
      title: 'Bullet List',
      shortcut: 'Ctrl+L'
    },
    {
      name: 'quote',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M14 17h3l2-4V7h-6v6h3M6 17h3l2-4V7H5v6h3"/></svg>,
      format: '> ',
      title: 'Quote',
      shortcut: 'Ctrl+Q'
    },
    {
      name: 'code',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="m7.375 16.781 1.25-1.562L4.601 12l4.024-3.219-1.25-1.562-5 4a1 1 0 0 0 0 1.562l5 4zm9.25-9.562-1.25 1.562L19.399 12l-4.024 3.219 1.25 1.562 5-4a1 1 0 0 0 0-1.562l-5-4z"/></svg>,
      format: '`',
      wrapper: '`',
      title: 'Inline Code',
      shortcut: 'Ctrl+`'
    },
    {
      name: 'link',
      icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>,
      format: '[',
      wrapper: '](url)',
      title: 'Link',
      shortcut: 'Ctrl+K'
    }
  ]

  const handleButtonClick = (button: FormatButton) => {
    if (disabled) return
    onFormat(button.format, button.wrapper)
  }

  return (
    <div className={cn(
      'flex items-center gap-1 p-2 border-b border-slate-200 bg-slate-50',
      className
    )}>
      <div className="flex items-center gap-0.5">
        {formatButtons.map((button) => (
          <button
            key={button.name}
            type="button"
            onClick={() => handleButtonClick(button)}
            disabled={disabled}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg',
              'text-slate-600 hover:text-slate-800 hover:bg-slate-200',
              'transition-colors duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
            )}
            title={`${button.title}${button.shortcut ? ` (${button.shortcut})` : ''}`}
            aria-label={button.title}
          >
            {button.icon}
          </button>
        ))}
      </div>
      
      {/* Preview Toggle */}
      <div className="flex items-center ml-auto">
        <div className="w-px h-6 bg-slate-300 mx-2" />
        <span className="text-xs text-slate-500 font-medium">Markdown</span>
      </div>
    </div>
  )
}

export default FormattingToolbar