-- Create default scoring configuration for GHOSTLY+ clinical trial
-- All patients and therapists use the same configuration during the trial

-- Insert the single trial configuration
INSERT INTO public.scoring_configuration (
    id,
    configuration_name,
    description,
    -- Main component weights (from config.py GHOSTLYScoringConfig)
    weight_compliance,    -- 50%
    weight_symmetry,      -- 25%
    weight_effort,        -- 25%
    weight_game,          -- 0%
    -- Sub-component weights for compliance
    weight_completion,    -- 33.3%
    weight_intensity,     -- 33.3%
    weight_duration,      -- 33.4%
    -- Configuration flags
    active,
    is_global,
    -- RPE mapping from config.py
    rpe_mapping,
    -- Timestamps
    created_at,
    updated_at
) VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,  -- Fixed UUID for trial config
    'GHOSTLY-TRIAL-DEFAULT',
    'Default scoring configuration for GHOSTLY+ clinical trial. All patients use this configuration.',
    -- Main weights from config.py
    0.50,  -- weight_compliance
    0.25,  -- weight_symmetry  
    0.25,  -- weight_effort
    0.00,  -- weight_game
    -- Sub-weights
    0.333,  -- weight_completion
    0.333,  -- weight_intensity
    0.334,  -- weight_duration (adjusted for sum = 1.0)
    -- Flags
    true,   -- active
    true,   -- is_global (available to all)
    -- RPE mapping (matching config.py DEFAULT_RPE_MAPPING)
    '{
        "0": {"score": 10, "category": "no_exertion", "clinical": "concerning_lack_of_effort"},
        "1": {"score": 25, "category": "very_light", "clinical": "below_therapeutic_minimum"},
        "2": {"score": 50, "category": "light", "clinical": "warm_up_intensity"},
        "3": {"score": 85, "category": "moderate_low", "clinical": "therapeutic_entry_range"},
        "4": {"score": 100, "category": "optimal_moderate", "clinical": "ideal_therapeutic_intensity"},
        "5": {"score": 100, "category": "optimal_moderate", "clinical": "peak_therapeutic_intensity"},
        "6": {"score": 75, "category": "somewhat_hard", "clinical": "approaching_upper_limit"},
        "7": {"score": 50, "category": "hard", "clinical": "excessive_for_elderly"},
        "8": {"score": 25, "category": "very_hard", "clinical": "dangerous_overexertion"},
        "9": {"score": 15, "category": "extremely_hard", "clinical": "immediate_intervention_needed"},
        "10": {"score": 10, "category": "maximum", "clinical": "emergency_stop_protocol"}
    }'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    -- Update existing record if it exists
    configuration_name = EXCLUDED.configuration_name,
    description = EXCLUDED.description,
    weight_compliance = EXCLUDED.weight_compliance,
    weight_symmetry = EXCLUDED.weight_symmetry,
    weight_effort = EXCLUDED.weight_effort,
    weight_game = EXCLUDED.weight_game,
    weight_completion = EXCLUDED.weight_completion,
    weight_intensity = EXCLUDED.weight_intensity,
    weight_duration = EXCLUDED.weight_duration,
    active = EXCLUDED.active,
    is_global = EXCLUDED.is_global,
    rpe_mapping = EXCLUDED.rpe_mapping,
    updated_at = NOW();

-- Ensure no other configuration is active (only one can be active at a time)
UPDATE public.scoring_configuration
SET active = false
WHERE id != 'a0000000-0000-0000-0000-000000000001'::uuid
  AND active = true;

-- Update any existing therapy sessions that don't have a scoring_config_id
-- to use the default trial configuration
UPDATE public.therapy_sessions
SET scoring_config_id = 'a0000000-0000-0000-0000-000000000001'::uuid
WHERE scoring_config_id IS NULL;

-- Update any existing patients that don't have a scoring config
-- to use the default trial configuration  
UPDATE public.patients
SET current_scoring_config_id = 'a0000000-0000-0000-0000-000000000001'::uuid
WHERE current_scoring_config_id IS NULL;