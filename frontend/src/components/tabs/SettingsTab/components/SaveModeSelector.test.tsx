import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveModeSelector from './SaveModeSelector';

describe('SaveModeSelector', () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
  });

  describe('Role-based access control', () => {
    it('should show all three save modes for researchers', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={true}
          currentSaveState="default"
          therapistId="therapist-123"
          patientId="patient-456"
        />
      );

      expect(screen.getByText('Apply to Session')).toBeInTheDocument();
      expect(screen.getByText('Save for Patient')).toBeInTheDocument();
      expect(screen.getByText('Save for All Users')).toBeInTheDocument();
    });

    it('should show all three save modes for admins', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="admin"
          hasUnsavedChanges={true}
          currentSaveState="default"
          therapistId="therapist-123"
          patientId="patient-456"
        />
      );

      expect(screen.getByText('Apply to Session')).toBeInTheDocument();
      expect(screen.getByText('Save for Patient')).toBeInTheDocument();
      expect(screen.getByText('Save for All Users')).toBeInTheDocument();
    });

    it('should show locked save modes for therapists during trial', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="therapist"
          hasUnsavedChanges={true}
          currentSaveState="default"
          therapistId="therapist-123"
          patientId="patient-456"
        />
      );

      // Should show trial mode notice
      expect(screen.getByText(/Trial Mode:/)).toBeInTheDocument();
      expect(screen.getByText(/only researchers can modify global scoring weights/)).toBeInTheDocument();

      // Session save should be available
      expect(screen.getByText('Apply to Session')).toBeInTheDocument();
      
      // Patient and global saves should be locked
      expect(screen.getByText('Locked for Trial')).toBeInTheDocument();
      expect(screen.getByText('Researcher Only')).toBeInTheDocument();
    });

    it('should disable buttons when no unsaved changes', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={false}
          currentSaveState="default"
          therapistId="therapist-123"
          patientId="patient-456"
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        if (button.textContent?.includes('Apply to Session') || 
            button.textContent?.includes('Save for Patient') || 
            button.textContent?.includes('Save for All Users')) {
          expect(button).toBeDisabled();
        }
      });
    });
  });

  describe('Save state indicators', () => {
    it('should show correct indicator for default state', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={false}
          currentSaveState="default"
        />
      );

      expect(screen.getByText('Using Defaults')).toBeInTheDocument();
    });

    it('should show correct indicator for session state', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={false}
          currentSaveState="session"
        />
      );

      expect(screen.getByText('Session Only')).toBeInTheDocument();
    });

    it('should show correct indicator for patient state', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={false}
          currentSaveState="patient"
        />
      );

      expect(screen.getByText('Patient Specific')).toBeInTheDocument();
    });

    it('should show correct indicator for global state', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={false}
          currentSaveState="global"
        />
      );

      expect(screen.getByText('Global Settings')).toBeInTheDocument();
    });

    it('should show unsaved changes badge when changes exist', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={true}
          currentSaveState="default"
        />
      );

      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    });
  });

  describe('Confirmation dialogs', () => {
    it('should show session confirmation dialog when clicking Apply to Session', async () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={true}
          currentSaveState="default"
        />
      );

      const sessionButton = screen.getByText('Apply to Session').closest('button');
      fireEvent.click(sessionButton!);

      await waitFor(() => {
        expect(screen.getByText('Confirm Apply to Session')).toBeInTheDocument();
        expect(screen.getByText(/Changes will be lost when you reload the page/)).toBeInTheDocument();
      });
    });

    it('should show patient confirmation dialog when clicking Save for Patient', async () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={true}
          currentSaveState="default"
          therapistId="therapist-123"
          patientId="patient-456"
        />
      );

      const patientButton = screen.getByText('Save for Patient').closest('button');
      fireEvent.click(patientButton!);

      await waitFor(() => {
        expect(screen.getByText('Confirm Save for Patient')).toBeInTheDocument();
        expect(screen.getByText(/Therapist: therapist-123/)).toBeInTheDocument();
        expect(screen.getByText(/Patient: patient-456/)).toBeInTheDocument();
      });
    });

    it('should show global confirmation dialog with warning for Save for All Users', async () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={true}
          currentSaveState="default"
        />
      );

      const globalButton = screen.getByText('Save for All Users').closest('button');
      fireEvent.click(globalButton!);

      await waitFor(() => {
        expect(screen.getByText('Confirm Save for All Users')).toBeInTheDocument();
        expect(screen.getByText(/This will update the default weights for ALL users/)).toBeInTheDocument();
        expect(screen.getByText(/This action affects all therapists and patients/)).toBeInTheDocument();
      });
    });

    it('should call onSave with correct mode when confirming', async () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={true}
          currentSaveState="default"
        />
      );

      // Click session save
      const sessionButton = screen.getByText('Apply to Session').closest('button');
      fireEvent.click(sessionButton!);

      // Confirm
      await waitFor(() => {
        const confirmButton = screen.getByText('Confirm Apply to Session');
        fireEvent.click(confirmButton);
      });

      expect(mockOnSave).toHaveBeenCalledWith('session');
    });

    it('should close dialog when canceling', async () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={true}
          currentSaveState="default"
        />
      );

      // Open dialog
      const sessionButton = screen.getByText('Apply to Session').closest('button');
      fireEvent.click(sessionButton!);

      await waitFor(() => {
        expect(screen.getByText('Confirm Apply to Session')).toBeInTheDocument();
      });

      // Cancel
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Confirm Apply to Session')).not.toBeInTheDocument();
      });
    });
  });

  describe('Therapist mode', () => {
    it('should hide trial notice when in therapist mode', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="therapist"
          hasUnsavedChanges={true}
          currentSaveState="default"
          isTherapistMode={true}
        />
      );

      // Should not show trial mode notice when therapist mode is active
      expect(screen.queryByText(/Trial Mode:/)).not.toBeInTheDocument();
    });
  });

  describe('Disabled state', () => {
    it('should disable all buttons when disabled prop is true', () => {
      render(
        <SaveModeSelector
          onSave={mockOnSave}
          userRole="researcher"
          hasUnsavedChanges={true}
          currentSaveState="default"
          disabled={true}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        if (button.textContent?.includes('Apply to Session') || 
            button.textContent?.includes('Save for Patient') || 
            button.textContent?.includes('Save for All Users')) {
          expect(button).toBeDisabled();
        }
      });
    });
  });
});