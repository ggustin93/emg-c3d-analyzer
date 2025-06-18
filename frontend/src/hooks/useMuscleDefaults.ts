import { useCallback } from 'react';
import { GameSessionParameters } from '../types/emg';

/**
 * Hook to manage default muscle groups when uploading C3D files
 */
export const useMuscleDefaults = () => {
  /**
   * Ensures that muscle groups are set to Quadriceps by default
   * @param channels Available channels from the C3D file
   * @param currentParams Current session parameters
   * @returns Updated session parameters with default muscle groups
   */
  const ensureDefaultMuscleGroups = useCallback((
    channels: string[],
    currentParams: GameSessionParameters
  ): GameSessionParameters => {
    // Ensure channels is an array
    if (!channels || !Array.isArray(channels)) {
      console.warn('No channels provided for muscle defaults initialization');
      return currentParams;
    }
    
    // Initialize mapping objects with safe defaults
    const channelMuscleMapping = currentParams.channel_muscle_mapping ? 
      { ...currentParams.channel_muscle_mapping } : {};
    const muscleColorMapping = currentParams.muscle_color_mapping ? 
      { ...currentParams.muscle_color_mapping } : {};
    
    let needsUpdate = false;
    
    // Set default muscle name and color for first channel
    if (channels.length > 0 && !channelMuscleMapping[channels[0]]) {
      const leftQuadName = "Left Quadriceps";
      channelMuscleMapping[channels[0]] = leftQuadName;
      
      // Set blue color for Left Quadriceps if not already set
      if (!muscleColorMapping[leftQuadName]) {
        muscleColorMapping[leftQuadName] = '#3b82f6'; // Blue
      }
      
      needsUpdate = true;
    }
    
    // Set default muscle name and color for second channel
    if (channels.length > 1 && !channelMuscleMapping[channels[1]]) {
      const rightQuadName = "Right Quadriceps";
      channelMuscleMapping[channels[1]] = rightQuadName;
      
      // Set red color for Right Quadriceps if not already set
      if (!muscleColorMapping[rightQuadName]) {
        muscleColorMapping[rightQuadName] = '#ef4444'; // Red
      }
      
      needsUpdate = true;
    }
    
    // Set generic names for additional channels
    if (channels.length > 2) {
      for (let i = 2; i < channels.length; i++) {
        if (!channelMuscleMapping[channels[i]]) {
          const muscleName = `Muscle ${i + 1}`;
          channelMuscleMapping[channels[i]] = muscleName;
          
          // Assign a color from a predefined set
          if (!muscleColorMapping[muscleName]) {
            const colorOptions = ['#8b5cf6', '#06b6d4', '#059669', '#f97316', '#ec4899'];
            muscleColorMapping[muscleName] = colorOptions[(i - 2) % colorOptions.length];
          }
          
          needsUpdate = true;
        }
      }
    }
    
    if (needsUpdate) {
      return {
        ...currentParams,
        channel_muscle_mapping: channelMuscleMapping,
        muscle_color_mapping: muscleColorMapping
      };
    }
    
    return currentParams;
  }, []);
  
  return { ensureDefaultMuscleGroups };
}; 