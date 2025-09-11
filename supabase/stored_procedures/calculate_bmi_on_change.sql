-- Function: calculate_bmi_on_change
-- Purpose: Auto-calculates BMI and assigns BMI status when height/weight change
-- Type: TRIGGER function
-- Used on: patient_medical_info table
-- Returns: TRIGGER

CREATE OR REPLACE FUNCTION public.calculate_bmi_on_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Auto-calculate BMI if height and weight are provided
    IF NEW.height_cm IS NOT NULL AND NEW.weight_kg IS NOT NULL THEN
        NEW.bmi_value = ROUND((NEW.weight_kg / POWER(NEW.height_cm/100, 2))::numeric, 1);
        
        -- Auto-assign BMI status
        NEW.bmi_status = CASE
            WHEN NEW.bmi_value < 18.5 THEN 'underweight'
            WHEN NEW.bmi_value >= 18.5 AND NEW.bmi_value < 25 THEN 'normal'
            WHEN NEW.bmi_value >= 25 AND NEW.bmi_value < 30 THEN 'overweight'
            ELSE 'obese'
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Example trigger usage:
-- CREATE TRIGGER calculate_bmi_trigger
-- BEFORE INSERT OR UPDATE ON patient_medical_info
-- FOR EACH ROW EXECUTE FUNCTION calculate_bmi_on_change();