import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ClinicalNotesBadge from '../ClinicalNotesBadge'
import AddNoteBadge from '../AddNoteBadge'

describe('Clinical Notes Badge Unit Tests', () => {
  const mockOnClick = vi.fn()

  beforeEach(() => {
    mockOnClick.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Badge Count Logic', () => {
    it('should not render badge when count is 0', () => {
      const { container } = render(
        <ClinicalNotesBadge 
          count={0} 
          type="file" 
          onClick={mockOnClick} 
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should render badge when count > 0', () => {
      const { container } = render(
        <ClinicalNotesBadge 
          count={3} 
          type="file" 
          onClick={mockOnClick} 
        />
      )
      
      expect(container.textContent).toBe('3')
      expect(screen.getByRole('button')).toHaveAttribute('title', '3 clinical notes (file)')
    })

    it('should render loading state when loading=true even with count=0', () => {
      const { container } = render(
        <ClinicalNotesBadge 
          count={0} 
          type="file" 
          onClick={mockOnClick} 
          loading={true}
        />
      )
      
      expect(container.textContent).toBe('...')
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Loading notes...')
    })
  })

  describe('Add Badge Logic', () => {
    it('should render add button', () => {
      render(
        <AddNoteBadge 
          type="file" 
          onClick={mockOnClick} 
        />
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Add clinical file note')
      expect(button).toHaveAttribute('aria-label', 'Add clinical file note')
    })

    it('should call onClick when clicked', () => {
      render(
        <AddNoteBadge 
          type="patient" 
          onClick={mockOnClick} 
        />
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Add clinical patient note')
      
      fireEvent.click(button)
      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Badge Conditional Logic (Critical Test)', () => {
    it('should only show AddNoteBadge when count is 0', () => {
      const TestComponent = ({ count }: { count: number }) => (
        <div data-testid="badge-container">
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

      // Test with count = 0 (should show AddNoteBadge)
      const { rerender, container } = render(<TestComponent count={0} />)
      
      // Should show AddNoteBadge
      const addButton = screen.getByRole('button')
      expect(addButton).toHaveAttribute('title', 'Add clinical file note')
      expect(addButton).toHaveAttribute('aria-label', 'Add clinical file note')
      
      // Should not show count
      expect(container.textContent).not.toMatch(/^\d+$/)
      
      // Test with count > 0 (should show ClinicalNotesBadge)
      rerender(<TestComponent count={5} />)
      
      const countButton = screen.getByRole('button')
      expect(countButton).toHaveAttribute('title', '5 clinical notes (file)')
      expect(container.textContent).toMatch('5')
      
      // Should not show add text
      expect(countButton).not.toHaveAttribute('aria-label', 'Add clinical file note')
    })
  })
})