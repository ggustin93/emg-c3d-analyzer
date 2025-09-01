-- Minimal Seed Data for EMG C3D Analyzer
-- ========================================
-- This file contains ONLY essential seed data required for the application to function.
-- For full test data population, use scripts/database/population/
-- ========================================

BEGIN;

-- 1. Admin User Profile (Essential for initial access)
INSERT INTO public.user_profiles (
    id,
    role,
    first_name,
    last_name,
    institution,
    department,
    access_level,
    created_at,
    active
) VALUES (
    'bfb10d7f-b538-4cea-a1dc-461485e5f050',
    'admin',
    'System',
    'Administrator',
    'GHOSTLY+ Research',
    'System Administration',
    'full',
    NOW(),
    true
) ON CONFLICT (id) DO NOTHING;

-- 2. Global Scoring Configuration (Required for EMG analysis)
INSERT INTO public.scoring_configuration (
    config_name,
    is_global,
    weights,
    thresholds,
    parameters,
    active,
    created_at
) VALUES (
    'GHOSTLY+ Global Scoring v2.0',
    true,
    jsonb_build_object(
        'compliance', 0.35,
        'strength', 0.25,
        'endurance', 0.25,
        'consistency', 0.15
    ),
    jsonb_build_object(
        'min_compliance', 70,
        'min_strength', 60,
        'min_endurance', 50,
        'target_score', 75
    ),
    jsonb_build_object(
        'scoring_algorithm', 'weighted_average_v2',
        'outlier_handling', 'winsorize',
        'confidence_intervals', true,
        'mvc_threshold_percentage', 0.15,
        'sampling_rate', 1500,
        'filter_settings', jsonb_build_object(
            'butterworth_order', 4,
            'lowpass_cutoff', 500,
            'highpass_cutoff', 20,
            'notch_frequency', 60
        )
    ),
    true,
    NOW()
) ON CONFLICT (config_name) DO NOTHING;

COMMIT;

-- Verification
SELECT 
    'Seed data loaded' as status,
    (SELECT COUNT(*) FROM user_profiles WHERE role = 'admin') as admin_users,
    (SELECT COUNT(*) FROM scoring_configuration WHERE is_global = true) as global_configs;