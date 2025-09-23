-- Ensure GHOSTLY-TRIAL-DEFAULT exists with fixed UUID and correct weights
-- This migration is idempotent and can be run multiple times safely

DO $$
DECLARE
    v_trial_config_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_config_exists BOOLEAN;
BEGIN
    -- Check if GHOSTLY-TRIAL-DEFAULT exists (regardless of UUID)
    SELECT EXISTS(
        SELECT 1 FROM scoring_configuration 
        WHERE configuration_name = 'GHOSTLY-TRIAL-DEFAULT'
    ) INTO v_config_exists;
    
    IF v_config_exists THEN
        -- Update existing configuration to ensure correct UUID and weights
        UPDATE scoring_configuration
        SET 
            id = v_trial_config_id,
            weight_compliance = 0.50,
            weight_symmetry = 0.25,
            weight_effort = 0.25,
            weight_game = 0.00,
            weight_completion = 0.333,
            weight_intensity = 0.333,
            weight_duration = 0.334,
            active = true,
            is_global = true,
            description = 'Default scoring configuration for GHOSTLY+ clinical trial. All patients use this configuration.',
            updated_at = NOW()
        WHERE configuration_name = 'GHOSTLY-TRIAL-DEFAULT'
        AND id != v_trial_config_id;  -- Only update if UUID is different
        
        -- If the UUID was already correct, just ensure weights are correct
        UPDATE scoring_configuration
        SET 
            weight_compliance = 0.50,
            weight_symmetry = 0.25,
            weight_effort = 0.25,
            weight_game = 0.00,
            weight_completion = 0.333,
            weight_intensity = 0.333,
            weight_duration = 0.334,
            active = true,
            is_global = true,
            updated_at = NOW()
        WHERE id = v_trial_config_id;
        
        RAISE NOTICE 'Updated GHOSTLY-TRIAL-DEFAULT configuration with correct UUID and weights';
    ELSE
        -- Insert new GHOSTLY-TRIAL-DEFAULT with fixed UUID
        INSERT INTO scoring_configuration (
            id,
            configuration_name,
            description,
            weight_compliance,
            weight_symmetry,
            weight_effort,
            weight_game,
            weight_completion,
            weight_intensity,
            weight_duration,
            active,
            is_global,
            created_at,
            updated_at
        ) VALUES (
            v_trial_config_id,
            'GHOSTLY-TRIAL-DEFAULT',
            'Default scoring configuration for GHOSTLY+ clinical trial. All patients use this configuration.',
            0.50,  -- Compliance: 50%
            0.25,  -- Symmetry: 25%
            0.25,  -- Effort: 25%
            0.00,  -- Game: 0%
            0.333, -- Completion sub-weight
            0.333, -- Intensity sub-weight
            0.334, -- Duration sub-weight
            true,  -- Active
            true,  -- Is global
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created GHOSTLY-TRIAL-DEFAULT configuration with fixed UUID';
    END IF;
    
    -- Ensure no other configuration is active
    UPDATE scoring_configuration
    SET active = false
    WHERE configuration_name != 'GHOSTLY-TRIAL-DEFAULT';
    
    -- Verify the configuration is correct
    IF NOT EXISTS(
        SELECT 1 FROM scoring_configuration
        WHERE id = v_trial_config_id
        AND configuration_name = 'GHOSTLY-TRIAL-DEFAULT'
        AND active = true
        AND ABS(weight_compliance - 0.50) < 0.001
        AND ABS(weight_symmetry - 0.25) < 0.001
        AND ABS(weight_effort - 0.25) < 0.001
        AND ABS(weight_game - 0.00) < 0.001
    ) THEN
        RAISE EXCEPTION 'Failed to ensure GHOSTLY-TRIAL-DEFAULT configuration is correct';
    END IF;
    
    RAISE NOTICE '✅ GHOSTLY-TRIAL-DEFAULT configuration verified with UUID % and correct weights', v_trial_config_id;
END $$;

-- Add comment documenting the fixed UUID
COMMENT ON COLUMN scoring_configuration.id IS 
'Primary key. For GHOSTLY-TRIAL-DEFAULT, this must always be a0000000-0000-0000-0000-000000000001 during the clinical trial.';