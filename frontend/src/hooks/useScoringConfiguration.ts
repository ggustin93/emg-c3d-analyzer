import { useState, useEffect, useCallback } from 'react';
import { ScoringWeights } from '@/types/emg';
import { API_CONFIG } from '@/config/apiConfig';

interface ScoringConfigurationResponse {
  id: string;
  configuration_name: string;
  description?: string;
  
  weight_compliance: number;
  weight_symmetry: number;
  weight_effort: number;
  weight_game: number;
  
  weight_completion: number;
  weight_intensity: number;
  weight_duration: number;
  
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface ScoringConfigurationHook {
  weights: ScoringWeights | null;
  isLoading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  currentSaveState: 'default' | 'session' | 'patient' | 'global';
  refetchConfiguration: () => Promise<void>;
  saveCustomWeights: (weights: ScoringWeights, therapistId?: string, patientId?: string) => Promise<void>;
  saveGlobalWeights: (weights: ScoringWeights) => Promise<void>;
  clearLocalChanges: () => void;
}

// NOTE: All scoring weights are fetched from database only
// Single source of truth: GHOSTLY-TRIAL-DEFAULT configuration in database

/**
 * Hook to fetch and manage scoring configuration from the database
 * 
 * Single Source of Truth Implementation:
 * 1. Primary: Therapist/Patient-specific configuration (if exists)
 * 2. Secondary: Global active configuration (scoring_configuration table)
 * 3. Fallback: Backend defaults from config.py (fetched via API)
 * 
 * This ensures consistency between frontend and backend scoring calculations
 * while supporting therapist and patient-specific customization.
 */
export const useScoringConfiguration = (
  therapistId?: string,
  patientId?: string
): ScoringConfigurationHook => {
  const [weights, setWeights] = useState<ScoringWeights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalWeights, setOriginalWeights] = useState<ScoringWeights | null>(null);
  const [currentSaveState, setCurrentSaveState] = useState<'default' | 'session' | 'patient' | 'global'>('default');
  
  // No longer using backend defaults - database is the single source of truth

  const fetchConfiguration = useCallback(async () => {
    // No need to wait for backend defaults anymore
    
    try {
      setIsLoading(true);
      setError(null);

      // Try to fetch therapist/patient-specific configuration first
      let response: Response | undefined = undefined;
      let configSource = 'global';

      if (therapistId && patientId) {
        // Try therapist+patient specific
        response = await fetch(`${API_CONFIG.baseUrl}/scoring/configurations/custom?therapist_id=${therapistId}&patient_id=${patientId}`);
        if (response.ok) {
          configSource = 'therapist-patient-specific';
        } else if (therapistId) {
          // Fallback to therapist-specific only
          response = await fetch(`${API_CONFIG.baseUrl}/scoring/configurations/custom?therapist_id=${therapistId}`);
          if (response.ok) {
            configSource = 'therapist-specific';
          }
        }
      } else if (therapistId) {
        // Try therapist-specific only
        response = await fetch(`${API_CONFIG.baseUrl}/scoring/configurations/custom?therapist_id=${therapistId}`);
        if (response.ok) {
          configSource = 'therapist-specific';
        }
      }

      // If no custom configuration found, use global active configuration
      if (!response || !response.ok) {
        response = await fetch(`${API_CONFIG.baseUrl}/scoring/configurations/active`);
        configSource = 'global';
      }
      
      if (!response.ok) {
        if (response.status === 404) {
          // No configuration found - this is now an error state
          console.error('No scoring configuration found in database. GHOSTLY-TRIAL-DEFAULT should always exist.');
          setError('No scoring configuration found. Please contact support.');
          setWeights(null);
          return;
        }
        throw new Error(`Failed to fetch scoring configuration: ${response.statusText}`);
      }

      const config: ScoringConfigurationResponse = await response.json();
      
      // Convert database format to ScoringWeights format
      const fetchedWeights: ScoringWeights = {
        compliance: config.weight_compliance,
        symmetry: config.weight_symmetry,
        effort: config.weight_effort,
        gameScore: config.weight_game,
        
        compliance_completion: config.weight_completion,
        compliance_intensity: config.weight_intensity,
        compliance_duration: config.weight_duration,
      };

      // Validate weights sum to 1.0 (within tolerance)
      const mainSum = fetchedWeights.compliance + fetchedWeights.symmetry + 
                      fetchedWeights.effort + fetchedWeights.gameScore;
      const subSum = fetchedWeights.compliance_completion + 
                     fetchedWeights.compliance_intensity + 
                     fetchedWeights.compliance_duration;

      if (Math.abs(mainSum - 1.0) > 0.01 || Math.abs(subSum - 1.0) > 0.01) {
        console.error('Database weights validation failed', {
          mainSum,
          subSum,
          fetchedWeights
        });
        setError('Invalid scoring configuration. Please contact support.');
        setWeights(null);
        return;
      }

      console.info('Successfully loaded scoring configuration from database:', {
        configName: config.configuration_name,
        configSource,
        weights: fetchedWeights
      });
      
      setWeights(fetchedWeights);
      setOriginalWeights(fetchedWeights);
      setCurrentSaveState(configSource === 'therapist-patient-specific' ? 'patient' : 
                         configSource === 'therapist-specific' ? 'patient' : 'global');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch scoring configuration:', errorMessage);
      
      // Error state - no fallback weights
      setError(errorMessage);
      setWeights(null);
      setOriginalWeights(null);
      setCurrentSaveState('default');
      
    } finally {
      setIsLoading(false);
    }
  }, [therapistId, patientId]);

  const refetchConfiguration = useCallback(async () => {
    await fetchConfiguration();
  }, [fetchConfiguration]);

  const saveCustomWeights = useCallback(async (
    weights: ScoringWeights,
    customTherapistId?: string,
    customPatientId?: string
  ) => {
    try {
      const targetTherapistId = customTherapistId || therapistId;
      const targetPatientId = customPatientId || patientId;

      // Create configuration data
      const configData = {
        configuration_name: `Custom - ${targetTherapistId}${targetPatientId ? ` - ${targetPatientId}` : ''}`,
        description: `Personnalisation des poids pour thérapeute ${targetTherapistId}${targetPatientId ? ` et patient ${targetPatientId}` : ''}`,
        
        weight_compliance: weights.compliance,
        weight_symmetry: weights.symmetry,
        weight_effort: weights.effort,
        weight_game: weights.gameScore,
        
        weight_completion: weights.compliance_completion,
        weight_intensity: weights.compliance_intensity,
        weight_duration: weights.compliance_duration,

        // Add custom fields for therapist/patient association
        therapist_id: targetTherapistId,
        patient_id: targetPatientId
      };

      const response = await fetch(`${API_CONFIG.baseUrl}/scoring/configurations/custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save custom scoring configuration: ${response.statusText}`);
      }

      console.info('Successfully saved custom scoring configuration:', {
        therapistId: targetTherapistId,
        patientId: targetPatientId,
        weights
      });

      // Refresh configuration after saving
      await fetchConfiguration();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save custom scoring configuration:', errorMessage);
      throw err;
    }
  }, [therapistId, patientId, fetchConfiguration]);

  const saveGlobalWeights = useCallback(async (
    weights: ScoringWeights
  ) => {
    try {
      // Update GHOSTLY-TRIAL-DEFAULT configuration
      const configData = {
        configuration_name: 'GHOSTLY-TRIAL-DEFAULT', // Always use this name
        description: 'Default scoring configuration for GHOSTLY+ clinical trial. All patients use this configuration.',
        
        weight_compliance: weights.compliance,
        weight_symmetry: weights.symmetry,
        weight_effort: weights.effort,
        weight_game: weights.gameScore,
        
        weight_completion: weights.compliance_completion,
        weight_intensity: weights.compliance_intensity,
        weight_duration: weights.compliance_duration,
      };

      const response = await fetch(`${API_CONFIG.baseUrl}/scoring/configurations/default`, {
        method: 'PUT', // PUT to update existing default
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update default scoring configuration: ${response.statusText}`);
      }

      console.info('Successfully updated GHOSTLY-TRIAL-DEFAULT configuration:', weights);
      
      // Update local state
      setOriginalWeights(weights);
      setCurrentSaveState('global');

      // Refresh configuration after saving
      await fetchConfiguration();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to update default scoring configuration:', errorMessage);
      throw err;
    }
  }, [fetchConfiguration]);

  const clearLocalChanges = useCallback(() => {
    if (originalWeights) {
      setWeights(originalWeights);
    }
  }, [originalWeights]);

  // Calculate if there are unsaved changes
  const hasUnsavedChanges = weights !== null && originalWeights !== null && 
    JSON.stringify(weights) !== JSON.stringify(originalWeights);

  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration]);

  return {
    weights,
    isLoading,
    error,
    hasUnsavedChanges,
    currentSaveState,
    refetchConfiguration,
    saveCustomWeights,
    saveGlobalWeights,
    clearLocalChanges
  };
};

export default useScoringConfiguration;