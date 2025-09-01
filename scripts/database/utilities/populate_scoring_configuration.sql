-- Populate GHOSTLY+ Default Scoring Configuration
-- This script creates the default scoring configuration that the performance scoring service expects
-- Author: EMG C3D Analyzer Team
-- Date: 2025-09-01

-- Insert the GHOSTLY+ Default scoring configuration if it doesn't exist
INSERT INTO public.scoring_configuration (
    configuration_name,
    description,
    is_global,
    weight_compliance,
    weight_symmetry,
    weight_effort,
    weight_game,
    weight_completion,
    weight_intensity,
    weight_duration,
    created_by
) VALUES (
    'GHOSTLY+ Default',
    'Default scoring configuration for GHOSTLY+ protocol with balanced weights across all performance dimensions',
    true,
    0.40,  -- Compliance weight (40%)
    0.25,  -- Symmetry weight (25%)
    0.20,  -- Effort weight (20%)
    0.15,  -- Game performance weight (15%)
    0.333, -- Completion sub-weight (33.3%)
    0.333, -- Intensity sub-weight (33.3%)
    0.334, -- Duration sub-weight (33.4%)
    '00000000-0000-0000-0000-000000000000'  -- System user UUID
) ON CONFLICT (configuration_name, is_global) DO UPDATE SET
    description = EXCLUDED.description,
    weight_compliance = EXCLUDED.weight_compliance,
    weight_symmetry = EXCLUDED.weight_symmetry,
    weight_effort = EXCLUDED.weight_effort,
    weight_game = EXCLUDED.weight_game,
    weight_completion = EXCLUDED.weight_completion,
    weight_intensity = EXCLUDED.weight_intensity,
    weight_duration = EXCLUDED.weight_duration,
    updated_at = NOW();

-- Optional: Insert a researcher RPE mapping configuration (inactive by default)
INSERT INTO public.rpe_mapping_configuration (
    configuration_name,
    description,
    optimal_range,
    acceptable_range,
    suboptimal_range,
    poor_range,
    optimal_score,
    acceptable_score,
    suboptimal_score,
    poor_score,
    default_score,
    active,
    created_by
) VALUES (
    'GHOSTLY+ Default RPE',
    'Default RPE mapping for GHOSTLY+ protocol based on modified Borg scale',
    ARRAY[4, 5, 6],      -- Optimal range (moderate effort)
    ARRAY[3, 7],         -- Acceptable range
    ARRAY[2, 8],         -- Suboptimal range
    ARRAY[0, 1, 9, 10],  -- Poor range (too easy or too hard)
    100.0,  -- Optimal score
    80.0,   -- Acceptable score
    60.0,   -- Suboptimal score
    20.0,   -- Poor score
    50.0,   -- Default score when RPE is null
    false,  -- Inactive by default (can be activated by researchers)
    '00000000-0000-0000-0000-000000000000'  -- System user UUID
) ON CONFLICT (configuration_name) DO UPDATE SET
    description = EXCLUDED.description,
    optimal_range = EXCLUDED.optimal_range,
    acceptable_range = EXCLUDED.acceptable_range,
    suboptimal_range = EXCLUDED.suboptimal_range,
    poor_range = EXCLUDED.poor_range,
    optimal_score = EXCLUDED.optimal_score,
    acceptable_score = EXCLUDED.acceptable_score,
    suboptimal_score = EXCLUDED.suboptimal_score,
    poor_score = EXCLUDED.poor_score,
    default_score = EXCLUDED.default_score,
    updated_at = NOW();

-- Verify the insertion
SELECT 
    configuration_name,
    is_global,
    weight_compliance,
    weight_symmetry,
    weight_effort,
    weight_game
FROM public.scoring_configuration
WHERE configuration_name = 'GHOSTLY+ Default' AND is_global = true;