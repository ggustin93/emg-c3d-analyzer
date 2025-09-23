-- Protection for GHOSTLY-TRIAL-DEFAULT configuration during clinical trial
-- This ensures the trial configuration remains active and cannot be accidentally deactivated

-- First, ensure GHOSTLY-TRIAL-DEFAULT is active (in case this migration runs on a fresh database)
UPDATE scoring_configuration 
SET active = false 
WHERE configuration_name != 'GHOSTLY-TRIAL-DEFAULT';

UPDATE scoring_configuration 
SET active = true 
WHERE configuration_name = 'GHOSTLY-TRIAL-DEFAULT' 
  AND id = 'a0000000-0000-0000-0000-000000000001';

-- Create function to protect GHOSTLY-TRIAL-DEFAULT from being deactivated
CREATE OR REPLACE FUNCTION protect_ghostly_trial_default()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent deactivation of GHOSTLY-TRIAL-DEFAULT during clinical trial
    IF OLD.configuration_name = 'GHOSTLY-TRIAL-DEFAULT' 
       AND OLD.active = true 
       AND NEW.active = false THEN
        RAISE EXCEPTION 'Cannot deactivate GHOSTLY-TRIAL-DEFAULT during clinical trial. This is the required configuration for all trial patients.';
    END IF;
    
    -- If activating a non-trial configuration, warn but allow (for testing purposes)
    -- In production, you might want to prevent this entirely
    IF NEW.active = true AND NEW.configuration_name != 'GHOSTLY-TRIAL-DEFAULT' THEN
        -- Log a warning (this will appear in Supabase logs)
        RAISE NOTICE 'Warning: Activating % while GHOSTLY-TRIAL-DEFAULT should be used for trial', NEW.configuration_name;
        
        -- Optionally, you could prevent this entirely during the trial:
        -- RAISE EXCEPTION 'Only GHOSTLY-TRIAL-DEFAULT can be active during the clinical trial';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce the protection
DROP TRIGGER IF EXISTS protect_trial_config ON scoring_configuration;
CREATE TRIGGER protect_trial_config
BEFORE UPDATE ON scoring_configuration
FOR EACH ROW
EXECUTE FUNCTION protect_ghostly_trial_default();

-- Add comment to document this protection
COMMENT ON TRIGGER protect_trial_config ON scoring_configuration IS 
'Protects GHOSTLY-TRIAL-DEFAULT from accidental deactivation during the GHOSTLY+ clinical trial. This ensures consistent scoring across all trial participants.';

-- Add comment on the function
COMMENT ON FUNCTION protect_ghostly_trial_default() IS 
'Trigger function that prevents deactivation of GHOSTLY-TRIAL-DEFAULT configuration during clinical trial and warns when other configurations are activated.';

-- Verify the protection is in place
DO $$
DECLARE
    v_active_count INTEGER;
    v_trial_active BOOLEAN;
BEGIN
    -- Check that GHOSTLY-TRIAL-DEFAULT is active
    SELECT active INTO v_trial_active
    FROM scoring_configuration
    WHERE configuration_name = 'GHOSTLY-TRIAL-DEFAULT';
    
    IF NOT v_trial_active THEN
        RAISE WARNING 'GHOSTLY-TRIAL-DEFAULT is not active after migration!';
    END IF;
    
    -- Check that only one configuration is active
    SELECT COUNT(*) INTO v_active_count
    FROM scoring_configuration
    WHERE active = true;
    
    IF v_active_count != 1 THEN
        RAISE WARNING 'Multiple configurations are active: %', v_active_count;
    END IF;
    
    RAISE NOTICE 'Trial configuration protection successfully applied. GHOSTLY-TRIAL-DEFAULT is protected.';
END $$;