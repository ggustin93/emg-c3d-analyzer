import { supabase } from '../lib/supabase'

export interface MuscleConfiguration {
  channel_1_muscle_name: string
  channel_2_muscle_name: string
}

export interface TrialConfiguration {
  id: string
  name: string
  active: boolean
  target_defaults: {
    channel_1_muscle_name: string
    channel_2_muscle_name: string
    [key: string]: any
  }
  parameters: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Get the current muscle configuration from trial settings
 * Returns default muscle names if configuration is not available
 */
export async function getMuscleConfiguration(): Promise<MuscleConfiguration> {
  try {
    const { data, error } = await supabase
      .from('scoring_configuration')
      .select('target_defaults')
      .eq('id', 'a0000000-0000-0000-0000-000000000001')
      .single()

    if (error) {
      console.warn('Failed to load muscle configuration:', error)
      return getDefaultMuscleConfiguration()
    }

    const config = data as { target_defaults: any }
    
    // Return configured muscle names or defaults
    return {
      channel_1_muscle_name: config.target_defaults?.channel_1_muscle_name || 'Left Quadriceps',
      channel_2_muscle_name: config.target_defaults?.channel_2_muscle_name || 'Right Quadriceps'
    }
  } catch (error) {
    console.error('Error fetching muscle configuration:', error)
    return getDefaultMuscleConfiguration()
  }
}

/**
 * Get the complete trial configuration
 */
export async function getTrialConfiguration(): Promise<TrialConfiguration | null> {
  try {
    const { data, error } = await supabase
      .from('scoring_configuration')
      .select('*')
      .eq('id', 'a0000000-0000-0000-0000-000000000001')
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching trial configuration:', error)
    return null
  }
}

/**
 * Get default muscle configuration
 */
export function getDefaultMuscleConfiguration(): MuscleConfiguration {
  return {
    channel_1_muscle_name: 'Left Quadriceps',
    channel_2_muscle_name: 'Right Quadriceps'
  }
}
