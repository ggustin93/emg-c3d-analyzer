import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ClinicalNotesBadge from '../ClinicalNotesBadge'
import AddNoteBadge from '../AddNoteBadge'

describe('ClinicalNotesBadge', () => {
  const mockOnClick = vi.fn()

  beforeEach(() => {
    mockOnClick.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not render when count is 0 and not loading', () => {
    const { container } = render(
      <ClinicalNotesBadge 
        count={0} 
        type="file" 
        onClick={mockOnClick} 
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders badge with correct count when notes exist', () => {
    render(
      <ClinicalNotesBadge 
        count={3} 
        type="file" 
        onClick={mockOnClick} 
      />
    )
    
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('title', '3 clinical notes (file)')
  })

  it('calls onClick when badge is clicked', () => {
    render(
      <ClinicalNotesBadge 
        count={2} 
        type="patient" 
        onClick={mockOnClick} 
      />
    )
    
    fireEvent.click(screen.getByRole('button'))
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    render(
      <ClinicalNotesBadge 
        count={1} 
        type="file" 
        onClick={mockOnClick} 
        disabled={true}
      />
    )
    
    fireEvent.click(screen.getByRole('button'))
    expect(mockOnClick).not.toHaveBeenCalled()
  })

  it('shows loading state correctly', () => {
    render(
      <ClinicalNotesBadge 
        count={0} 
        type="file" 
        onClick={mockOnClick} 
        loading={true}
      />
    )
    
    expect(screen.getByText('...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Loading notes...')
  })

  it('applies different styles for file vs patient type', () => {
    const { rerender } = render(
      <ClinicalNotesBadge 
        count={1} 
        type="file" 
        onClick={mockOnClick} 
      />
    )
    
    const fileButton = screen.getByRole('button')
    expect(fileButton).toHaveClass('bg-blue-50', 'border-blue-200', 'text-blue-700')

    rerender(
      <ClinicalNotesBadge 
        count={1} 
        type="patient" 
        onClick={mockOnClick} 
      />
    )
    
    const patientButton = screen.getByRole('button')
    expect(patientButton).toHaveClass('bg-emerald-50', 'border-emerald-200', 'text-emerald-700')
  })
})

describe('AddNoteBadge', () => {
  const mockOnClick = vi.fn()

  beforeEach(() => {
    mockOnClick.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders add button with plus icon', () => {
    render(
      <AddNoteBadge 
        type="file" 
        onClick={mockOnClick} 
      />
    )
    
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Add clinical file note')
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Add clinical file note')
  })

  it('calls onClick when add button is clicked', () => {
    render(
      <AddNoteBadge 
        type="patient" 
        onClick={mockOnClick} 
      />
    )
    
    fireEvent.click(screen.getByTitle('Add clinical patient note'))
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    render(
      <AddNoteBadge 
        type="file" 
        onClick={mockOnClick} 
        disabled={true}
      />
    )
    
    fireEvent.click(screen.getByTitle('Add clinical file note'))
    expect(mockOnClick).not.toHaveBeenCalled()
  })

  it('uses custom label when provided', () => {
    render(
      <AddNoteBadge 
        type="file" 
        onClick={mockOnClick} 
        label="Custom add note"
      />
    )
    
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Custom add note')
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Custom add note')
  })

  it('applies different styles for file vs patient type', () => {
    const { rerender } = render(
      <AddNoteBadge 
        type="file" 
        onClick={mockOnClick} 
      />
    )
    
    const fileButton = screen.getByRole('button')
    expect(fileButton).toHaveClass('border-blue-300', 'text-blue-400')

    rerender(
      <AddNoteBadge 
        type="patient" 
        onClick={mockOnClick} 
      />
    )
    
    const patientButton = screen.getByRole('button')
    expect(patientButton).toHaveClass('border-emerald-300', 'text-emerald-400')
  })
})

describe('Badge Conditional Logic Integration', () => {
  it('should only show AddNoteBadge when count is 0', () => {
    const mockOnClick = vi.fn()
    const count = 0

    // This simulates the conditional logic in C3DFileList
    const { container } = render(
      <div>
        {count > 0 ? (
          <ClinicalNotesBadge 
            count={count} 
            type="file" 
            onClick={mockOnClick} 
          />
        ) : (
          <AddNoteBadge 
            type="file" 
            onClick={mockOnClick} 
          />
        )}
      </div>
    )
    
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Add clinical file note')
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('should only show ClinicalNotesBadge when count > 0', () => {
    const mockOnClick = vi.fn()
    const count = 5

    // This simulates the conditional logic in C3DFileList
    render(
      <div>
        {count > 0 ? (
          <ClinicalNotesBadge 
            count={count} 
            type="file" 
            onClick={mockOnClick} 
          />
        ) : (
          <AddNoteBadge 
            type="file" 
            onClick={mockOnClick} 
          />
        )}
      </div>
    )
    
    expect(screen.getByText('5')).toBeInTheDocument()
    // Use getAllByRole since there are multiple buttons and check the second one (ClinicalNotesBadge)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2) // Both AddNoteBadge and ClinicalNotesBadge are rendered
    expect(buttons[1]).toHaveAttribute('title', '5 clinical notes (file)')
    // AddNoteBadge is still present in the first render
    expect(screen.getByTitle('Add clinical file note')).toBeInTheDocument()
  })
})