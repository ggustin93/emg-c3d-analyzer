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
        // Initialize MVC values if not present
        if (newSessionMVCValues[channel] === undefined) {
          // Check if the analytics has max_amplitude value (directly from contraction analysis)
          const channelAnalytics = data.analytics[channel];
          if (channelAnalytics && 
              channelAnalytics.max_amplitude !== undefined && 
              channelAnalytics.max_amplitude !== null) {
            // Use the max_amplitude directly as the MVC value
            const mvcValue = formatMVCValue(channelAnalytics.max_amplitude);
            console.log(`Initializing MVC value for ${channel} from backend MAX amplitude: ${mvcValue}`);
            newSessionMVCValues[channel] = mvcValue;
          } else if (channelAnalytics && 
                    channelAnalytics.mvc_threshold_actual_value !== undefined && 
                    channelAnalytics.mvc_threshold_actual_value !== null) {
            // Fallback to deriving from threshold if max_amplitude is not available
            const thresholdPercentage = sessionParamsUsed.session_mvc_threshold_percentage || 70;
            const rawMvcValue = channelAnalytics.mvc_threshold_actual_value / (thresholdPercentage / 100);
            const mvcValue = formatMVCValue(rawMvcValue);
            console.log(`Initializing MVC value for ${channel} from threshold: ${mvcValue}`);
            newSessionMVCValues[channel] = mvcValue;
          } else {
            // Fallback to global MVC value if available
            const globalMVC = sessionParamsUsed.session_mvc_value !== undefined ? 
              sessionParamsUsed.session_mvc_value : null;
            newSessionMVCValues[channel] = formatMVCValue(globalMVC);
          }
        }
        
        // Initialize MVC threshold percentages if not present
        if (newSessionMVCThresholdPercentages[channel] === undefined) {
          // Use global threshold percentage as fallback if available
          newSessionMVCThresholdPercentages[channel] = sessionParamsUsed.session_mvc_threshold_percentage !== undefined ?
            sessionParamsUsed.session_mvc_threshold_percentage : 70;
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