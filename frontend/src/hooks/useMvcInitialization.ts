import { useCallback } from 'react';
import { EMGAnalysisResult, GameSessionParameters } from '../types/emg';

/**
 * Formats MVC value to have at most 6 significant digits and uses scientific notation when appropriate
 * @param value The MVC value to format
 * @returns Formatted MVC value
 */
const formatMVCValue = (value: number | null): number | null => {
  if (value === null || value === undefined) return null;
  
  // Format to 6 significant digits
  // For very small values, this will automatically use scientific notation
  return Number(value.toPrecision(6));
};

/**
 * Hook to handle MVC value initialization from backend data
 */
export const useMvcInitialization = () => {
  /**
   * Initialize MVC values from the backend data
   * @param data The analysis result from the backend
   * @param currentParams The current session parameters
   * @returns Updated session parameters with initialized MVC values
   */
  const initializeMvcValues = useCallback((
    data: EMGAnalysisResult, 
    currentParams: GameSessionParameters
  ): GameSessionParameters => {
    // Ensure data and analytics exist before proceeding
    if (!data || !data.analytics) {
      console.warn('No analytics data available for MVC initialization');
      return currentParams;
    }
    
    // Get the available channels from the data
    const availableChannels = Object.keys(data.analytics);
    
    // Initialize MVC values and thresholds if not present
    const sessionParamsUsed = data.metadata?.session_parameters_used || {} as GameSessionParameters;
    const newSessionMVCValues = { ...(currentParams.session_mvc_values || {}) };
    const newSessionMVCThresholdPercentages = { ...(currentParams.session_mvc_threshold_percentages || {}) };
    
    // Ensure all available channels have MVC values
    if (availableChannels.length > 0) {
      availableChannels.forEach((channel) => {
        // MVC VALUE PRIORITY: Backend estimation > User provided > Limited assessment
        if (newSessionMVCValues[channel] === undefined || newSessionMVCValues[channel] === null) {
          const channelAnalytics = data.analytics[channel];
          
          // Priority 1: Use backend-estimated MVC values (clinical estimation from signal)
          if (sessionParamsUsed.session_mvc_values && 
              sessionParamsUsed.session_mvc_values[channel] !== undefined &&
              sessionParamsUsed.session_mvc_values[channel] !== null &&
              channelAnalytics?.mvc_estimation_method === 'backend_estimation') {
            const mvcValue = formatMVCValue(sessionParamsUsed.session_mvc_values[channel]);
            console.log(`✅ Using backend-estimated MVC for ${channel}: ${mvcValue} (95th percentile method)`);
            newSessionMVCValues[channel] = mvcValue;
          }
          // Priority 2: Use explicitly provided MVC values
          else if (sessionParamsUsed.session_mvc_value !== undefined && sessionParamsUsed.session_mvc_value !== null) {
            const mvcValue = formatMVCValue(sessionParamsUsed.session_mvc_value);
            console.log(`✅ Using provided global MVC for ${channel}: ${mvcValue}`);
            newSessionMVCValues[channel] = mvcValue;
          } 
          // Priority 3: Limited assessment without MVC
          else {
            console.log(`⚠️ No MVC estimation available for ${channel} - quality assessment will be limited to duration only`);
            newSessionMVCValues[channel] = null;
          }
        }
        
        // Initialize MVC threshold percentages if not present
        if (newSessionMVCThresholdPercentages[channel] === undefined) {
          // Use global threshold percentage as fallback if available
          newSessionMVCThresholdPercentages[channel] = sessionParamsUsed.session_mvc_threshold_percentage !== undefined ?
            sessionParamsUsed.session_mvc_threshold_percentage : 75;
        }
      });
    }
    
    // Return updated session parameters
    return {
      ...currentParams,
      session_mvc_values: newSessionMVCValues,
      session_mvc_threshold_percentages: newSessionMVCThresholdPercentages
    };
  }, []);
  
  return { initializeMvcValues };
}; 