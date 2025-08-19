import { EMGAnalysisResult, GameSessionParameters } from '../types/emg';

/**
 * Formats MVC value to have at most 6 significant digits and uses scientific notation when appropriate
 * @param value The MVC value to format
 * @returns Formatted MVC value
 */
const formatMVCValue = (value: number | null): number | null => {
  if (value === null || value === undefined) return null;
  return Number(value.toPrecision(6));
};

/**
 * Initializes MVC values from the backend data.
 * This is a pure utility function, not a hook.
 * @param data The analysis result from the backend
 * @param currentParams The current session parameters
 * @returns Updated session parameters with initialized MVC values
 */
export const initializeMvcValuesFromAnalysis = (
  data: EMGAnalysisResult,
  currentParams: GameSessionParameters
): GameSessionParameters => {
  if (!data || !data.analytics) {
    console.warn('No analytics data available for MVC initialization');
    return currentParams;
  }

  const availableChannels = Object.keys(data.analytics);
  const sessionParamsUsed = data.metadata?.session_parameters_used || {} as GameSessionParameters;
  const newSessionMVCValues = { ...(currentParams.session_mvc_values || {}) };
  const newSessionMVCThresholdPercentages = { ...(currentParams.session_mvc_threshold_percentages || {}) };

  if (availableChannels.length > 0) {
    availableChannels.forEach((channel) => {
      if (newSessionMVCValues[channel] === undefined || newSessionMVCValues[channel] === null) {
        if (sessionParamsUsed.session_mvc_values &&
            sessionParamsUsed.session_mvc_values[channel] !== undefined &&
            sessionParamsUsed.session_mvc_values[channel] !== null) {
          const mvcValue = formatMVCValue(sessionParamsUsed.session_mvc_values[channel]);
          console.log(`✅ Using backend-provided MVC for ${channel}: ${mvcValue}`);
          newSessionMVCValues[channel] = mvcValue;
        } else if (sessionParamsUsed.session_mvc_value !== undefined && sessionParamsUsed.session_mvc_value !== null) {
          const mvcValue = formatMVCValue(sessionParamsUsed.session_mvc_value);
          console.log(`✅ Using provided global MVC for ${channel}: ${mvcValue}`);
          newSessionMVCValues[channel] = mvcValue;
        } else {
          console.log(`⚠️ No MVC estimation available for ${channel} - quality assessment will be limited to duration only`);
          newSessionMVCValues[channel] = null;
        }
      }

      if (newSessionMVCThresholdPercentages[channel] === undefined) {
        newSessionMVCThresholdPercentages[channel] = sessionParamsUsed.session_mvc_threshold_percentage !== undefined
          ? sessionParamsUsed.session_mvc_threshold_percentage
          : 75;
      }
    });
  }

  return {
    ...currentParams,
    session_mvc_values: newSessionMVCValues,
    session_mvc_threshold_percentages: newSessionMVCThresholdPercentages
  };
};
