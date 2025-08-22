import { useState, useEffect, useCallback } from 'react';
import { ScoringWeights } from '@/types/emg';

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
  refetchConfiguration: () => Promise<void>;
  saveCustomWeights: (weights: ScoringWeights, therapistId?: string, patientId?: string) => Promise<void>;
}

// Fallback weights matching metricsDefinitions.md specification exactly
const FALLBACK_WEIGHTS: ScoringWeights = {
  compliance: 0.40,        // 40% - Therapeutic Compliance
  symmetry: 0.25,         // 25% - Muscle Symmetry
  effort: 0.20,           // 20% - Subjective Effort (RPE)
  gameScore: 0.15,        // 15% - Game Performance
  
  // Sub-component weights for compliance (must sum to 1.0)
  compliance_completion: 0.333,  // 33.3% - Completion rate
  compliance_intensity: 0.333,   // 33.3% - Intensity rate (≥75% MVC)
  compliance_duration: 0.334,    // 33.4% - Duration rate (muscle-specific threshold)
};

/**
 * Hook to fetch and manage scoring configuration from the database
 * 
 * Single Source of Truth Implementation:
 * 1. Primary: Therapist/Patient-specific configuration (if exists)
 * 2. Secondary: Global active configuration (scoring_configuration table)
 * 3. Fallback: FALLBACK_WEIGHTS (matching metricsDefinitions.md exactly)
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

  const fetchConfiguration = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to fetch therapist/patient-specific configuration first
      let response: Response;
      let configSource = 'global';

      if (therapistId && patientId) {
        // Try therapist+patient specific
        response = await fetch(`/api/scoring/configurations/custom?therapist_id=${therapistId}&patient_id=${patientId}`);
        if (response.ok) {
          configSource = 'therapist-patient-specific';
        } else if (therapistId) {
          // Fallback to therapist-specific only
          response = await fetch(`/api/scoring/configurations/custom?therapist_id=${therapistId}`);
          if (response.ok) {
            configSource = 'therapist-specific';
          }
        }
      } else if (therapistId) {
        // Try therapist-specific only
        response = await fetch(`/api/scoring/configurations/custom?therapist_id=${therapistId}`);
        if (response.ok) {
          configSource = 'therapist-specific';
        }
      }

      // If no custom configuration found, use global active configuration
      if (!response || !response.ok) {
        response = await fetch('/api/scoring/configurations/active');
        configSource = 'global';
      }
      
      if (!response.ok) {
        if (response.status === 404) {
          // No configuration found - use fallback
          console.info('No scoring configuration found in database, using fallback weights from metricsDefinitions.md');
          setWeights(FALLBACK_WEIGHTS);
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
        console.warn('Database weights validation failed, using fallback', {
          mainSum,
          subSum,
          fetchedWeights
        });
        setWeights(FALLBACK_WEIGHTS);
        return;
      }

      console.info('Successfully loaded scoring configuration from database:', {
        configName: config.configuration_name,
        configSource,
        weights: fetchedWeights
      });
      
      setWeights(fetchedWeights);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch scoring configuration:', errorMessage);
      
      // Use fallback weights on error
      setError(errorMessage);
      setWeights(FALLBACK_WEIGHTS);
      
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

      const response = await fetch('/api/scoring/configurations/custom', {
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

  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration]);

  return {
    weights,
    isLoading,
    error,
    refetchConfiguration,
    saveCustomWeights
  };
};

export default useScoringConfiguration;