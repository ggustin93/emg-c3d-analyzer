import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ScoringWeightsSettings from './ScoringWeightsSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionStore } from '@/store/sessionStore';
import { useScoringConfiguration } from '@/hooks/useScoringConfiguration';

// Mock dependencies
vi.mock('@/contexts/AuthContext');
vi.mock('@/store/sessionStore');
vi.mock('@/hooks/useScoringConfiguration');

describe('ScoringWeightsSettings - Role-based Access', () => {
  const mockSetSessionParams = vi.fn();
  const mockSaveCustomWeights = vi.fn();
  const mockSaveGlobalWeights = vi.fn();
  const mockClearLocalChanges = vi.fn();

  const defaultWeights = {
    compliance: 0.50,  // 50% - from metricsDefinitions.md
    symmetry: 0.25,    // 25% - from metricsDefinitions.md
    effort: 0.25,      // 25% - from metricsDefinitions.md
    gameScore: 0.00,   // 0% - from metricsDefinitions.md
    compliance_completion: 0.333,
    compliance_intensity: 0.333,
    compliance_duration: 0.334,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    (useSessionStore as any).mockReturnValue({
      sessionParams: {
        enhanced_scoring: {
          enabled: true,
          weights: defaultWeights
        }
      },
      setSessionParams: mockSetSessionParams
    });

    (useScoringConfiguration as any).mockReturnValue({
      weights: defaultWeights,
      hasUnsavedChanges: false,
      currentSaveState: 'default',
      saveCustomWeights: mockSaveCustomWeights,
      saveGlobalWeights: mockSaveGlobalWeights,
      clearLocalChanges: mockClearLocalChanges
    });
  });

  describe('Therapist role', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({
        authState: {
          user: { id: 'therapist-123' },
          profile: {
            role: 'therapist',
            full_name: 'Dr. Smith'
          }
        }
      });
    });

    it('should allow therapists to edit weights locally', () => {
      render(<ScoringWeightsSettings />);

      // Find the Performance Scoring System section
      const performanceSection = screen.getByText('Performance Scoring System').closest('div');
      expect(performanceSection).toBeInTheDocument();

      // Check that sliders are enabled for therapists
      const sliders = screen.getAllByRole('slider');
      sliders.forEach(slider => {
        expect(slider).not.toBeDisabled();
      });
    });

    it('should show trial mode notice for therapists in SaveModeSelector', () => {
      (useScoringConfiguration as any).mockReturnValue({
        weights: defaultWeights,
        hasUnsavedChanges: true, // Enable save buttons
        currentSaveState: 'default',
        saveCustomWeights: mockSaveCustomWeights,
        saveGlobalWeights: mockSaveGlobalWeights,
        clearLocalChanges: mockClearLocalChanges
      });

      render(<ScoringWeightsSettings />);

      // Should show trial mode notice
      expect(screen.getByText(/Trial Mode:/)).toBeInTheDocument();
      expect(screen.getByText(/only researchers can modify global scoring weights/)).toBeInTheDocument();
    });

    it('should show locked badges for therapists', () => {
      render(<ScoringWeightsSettings />);

      // Should show locked badges
      const lockedBadges = screen.getAllByText('Locked for Trial');
      expect(lockedBadges.length).toBeGreaterThan(0);
    });

    it('should disable global save for therapists in RPE mapping', () => {
      render(<ScoringWeightsSettings />);

      // Find and click on RPE Mapping Configuration to expand it
      const rpeSection = screen.getByText('RPE Mapping Configuration').closest('button');
      if (rpeSection) fireEvent.click(rpeSection);

      // Check for trial mode notice in RPE section
      const rpeNotices = screen.getAllByText(/only researchers can modify RPE mapping globally/);
      expect(rpeNotices.length).toBeGreaterThan(0);

      // Check that save button is disabled or shows locked text
      const saveButton = screen.getByText(/Save Configuration \(Locked\)/);
      expect(saveButton).toBeInTheDocument();
      expect(saveButton.closest('button')).toBeDisabled();
    });
  });

  describe('Researcher role', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({
        authState: {
          user: { id: 'researcher-123' },
          profile: {
            role: 'researcher',
            full_name: 'Dr. Jones'
          }
        }
      });
    });

    it('should allow researchers to access all save modes', () => {
      (useScoringConfiguration as any).mockReturnValue({
        weights: defaultWeights,
        hasUnsavedChanges: true, // Enable save buttons
        currentSaveState: 'default',
        saveCustomWeights: mockSaveCustomWeights,
        saveGlobalWeights: mockSaveGlobalWeights,
        clearLocalChanges: mockClearLocalChanges
      });

      render(<ScoringWeightsSettings />);

      // Should NOT show trial mode notice for researchers
      expect(screen.queryByText(/Trial Mode:/)).not.toBeInTheDocument();

      // All save modes should be available
      expect(screen.getByText('Apply to Session')).toBeInTheDocument();
      expect(screen.getByText('Save for Patient')).toBeInTheDocument();
      expect(screen.getByText('Save for All Users')).toBeInTheDocument();

      // Should not show locked badges
      expect(screen.queryByText('Locked for Trial')).not.toBeInTheDocument();
    });

    it('should enable global save for researchers in RPE mapping', () => {
      render(<ScoringWeightsSettings />);

      // Find and click on RPE Mapping Configuration to expand it
      const rpeSection = screen.getByText('RPE Mapping Configuration').closest('button');
      if (rpeSection) fireEvent.click(rpeSection);

      // Should not show trial mode notice for researchers
      const rpeNotices = screen.queryAllByText(/only researchers can modify RPE mapping globally/);
      expect(rpeNotices.length).toBe(0);

      // Save button should show "Save for All Users" and be enabled
      const saveButton = screen.getByText('Save for All Users');
      expect(saveButton).toBeInTheDocument();
      expect(saveButton.closest('button')).not.toBeDisabled();
    });

    it('should allow researchers to modify all weight sliders', () => {
      render(<ScoringWeightsSettings />);

      // All sliders should be enabled
      const sliders = screen.getAllByRole('slider');
      sliders.forEach(slider => {
        expect(slider).not.toBeDisabled();
      });

      // Can modify compliance weight
      const complianceSlider = sliders[0];
      fireEvent.change(complianceSlider, { target: { value: '60' } });
      expect(mockSetSessionParams).toHaveBeenCalled();
    });
  });

  describe('Admin role', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({
        authState: {
          user: { id: 'admin-123' },
          profile: {
            role: 'admin',
            full_name: 'Admin User'
          }
        }
      });
    });

    it('should treat admins like researchers with full access', () => {
      (useScoringConfiguration as any).mockReturnValue({
        weights: defaultWeights,
        hasUnsavedChanges: true,
        currentSaveState: 'default',
        saveCustomWeights: mockSaveCustomWeights,
        saveGlobalWeights: mockSaveGlobalWeights,
        clearLocalChanges: mockClearLocalChanges
      });

      render(<ScoringWeightsSettings />);

      // Should NOT show trial mode notice
      expect(screen.queryByText(/Trial Mode:/)).not.toBeInTheDocument();

      // All save modes should be available
      expect(screen.getByText('Apply to Session')).toBeInTheDocument();
      expect(screen.getByText('Save for Patient')).toBeInTheDocument();
      expect(screen.getByText('Save for All Users')).toBeInTheDocument();

      // Should not show locked badges
      expect(screen.queryByText('Locked for Trial')).not.toBeInTheDocument();
    });

    it('should enable all features for admins', () => {
      render(<ScoringWeightsSettings />);

      // All sliders should be enabled
      const sliders = screen.getAllByRole('slider');
      sliders.forEach(slider => {
        expect(slider).not.toBeDisabled();
      });

      // Find and click on RPE Mapping Configuration
      const rpeSection = screen.getByText('RPE Mapping Configuration').closest('button');
      if (rpeSection) fireEvent.click(rpeSection);

      // Save button should be enabled for admins
      const saveButton = screen.getByText('Save for All Users');
      expect(saveButton).toBeInTheDocument();
      expect(saveButton.closest('button')).not.toBeDisabled();
    });
  });

  describe('Therapist Debug Mode', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({
        authState: {
          user: { id: 'therapist-123' },
          profile: {
            role: 'therapist',
            full_name: 'Dr. Smith'
          }
        }
      });
    });

    it('should enable editing when therapist mode is active', () => {
      render(<ScoringWeightsSettings isTherapistMode={true} />);

      // Sliders should be enabled in therapist mode
      const sliders = screen.getAllByRole('slider');
      sliders.forEach(slider => {
        expect(slider).not.toBeDisabled();
      });

      // Should show Demo badge
      const demoBadges = screen.getAllByText('Demo (C3D)');
      expect(demoBadges.length).toBeGreaterThan(0);
    });

    it('should still restrict database saves in therapist mode', () => {
      (useScoringConfiguration as any).mockReturnValue({
        weights: defaultWeights,
        hasUnsavedChanges: true,
        currentSaveState: 'default',
        saveCustomWeights: mockSaveCustomWeights,
        saveGlobalWeights: mockSaveGlobalWeights,
        clearLocalChanges: mockClearLocalChanges
      });

      render(<ScoringWeightsSettings isTherapistMode={true} />);

      // Trial mode notice should not appear in therapist mode
      // but save restrictions still apply
      const researcherOnlyBadge = screen.getByText('Researcher Only');
      expect(researcherOnlyBadge).toBeInTheDocument();
    });
  });

  describe('Weight presets', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({
        authState: {
          user: { id: 'researcher-123' },
          profile: {
            role: 'researcher',
            full_name: 'Dr. Jones'
          }
        }
      });
    });

    it('should apply research default preset', () => {
      render(<ScoringWeightsSettings />);

      // Find preset selector
      const presetSelector = screen.getByRole('combobox');
      fireEvent.click(presetSelector);

      // Select Research Default
      const defaultOption = screen.getByText('Research Default');
      fireEvent.click(defaultOption);

      // Should update weights
      expect(mockSetSessionParams).toHaveBeenCalled();
    });

    it('should apply compliance focused preset', () => {
      render(<ScoringWeightsSettings />);

      // Click Quality Focus button
      const qualityButton = screen.getByText('Quality Focus');
      fireEvent.click(qualityButton);

      // Should update weights
      expect(mockSetSessionParams).toHaveBeenCalled();
    });

    it('should reset to defaults', () => {
      render(<ScoringWeightsSettings />);

      // Click Reset to Default button
      const resetButton = screen.getByText('Reset to Default');
      fireEvent.click(resetButton);

      // Should reset weights
      expect(mockSetSessionParams).toHaveBeenCalled();
    });
  });

  describe('Disabled state', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({
        authState: {
          user: { id: 'researcher-123' },
          profile: {
            role: 'researcher',
            full_name: 'Dr. Jones'
          }
        }
      });
    });

    it('should disable all controls when disabled prop is true', () => {
      render(<ScoringWeightsSettings disabled={true} />);

      // All sliders should be disabled
      const sliders = screen.getAllByRole('slider');
      sliders.forEach(slider => {
        expect(slider).toBeDisabled();
      });

      // All buttons should be disabled
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Except for the collapsible triggers
        if (!button.className.includes('cursor-pointer')) {
          expect(button).toBeDisabled();
        }
      });
    });
  });
});