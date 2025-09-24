-- Add height and weight fields to patient_medical_info table for automatic BMI calculation
-- Migration: 20250124_add_height_weight_to_patient_medical_info.sql

-- Add height field (in cm, as decimal for precision)
ALTER TABLE patient_medical_info 
ADD COLUMN height_cm DECIMAL(5,2);

-- Add weight field (in kg, as decimal for precision)  
ALTER TABLE patient_medical_info 
ADD COLUMN weight_kg DECIMAL(5,2);

-- Add comments for documentation
COMMENT ON COLUMN patient_medical_info.height_cm IS 'Patient height in centimeters (decimal for precision)';
COMMENT ON COLUMN patient_medical_info.weight_kg IS 'Patient weight in kilograms (decimal for precision)';
COMMENT ON COLUMN patient_medical_info.bmi_value IS 'Body Mass Index calculated from height and weight (kg/m²)';

-- Create a function to automatically calculate BMI when height or weight is updated
CREATE OR REPLACE FUNCTION calculate_bmi()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate BMI if both height and weight are provided
  IF NEW.height_cm IS NOT NULL AND NEW.weight_kg IS NOT NULL AND NEW.height_cm > 0 AND NEW.weight_kg > 0 THEN
    -- BMI = weight(kg) / height(m)²
    -- Convert cm to m by dividing by 100
    NEW.bmi_value = ROUND((NEW.weight_kg / POWER(NEW.height_cm / 100, 2))::DECIMAL, 1);
    
    -- Automatically set BMI status based on calculated BMI
    IF NEW.bmi_value < 18.5 THEN
      NEW.bmi_status = 'underweight';
    ELSIF NEW.bmi_value >= 18.5 AND NEW.bmi_value < 25 THEN
      NEW.bmi_status = 'normal';
    ELSIF NEW.bmi_value >= 25 AND NEW.bmi_value < 30 THEN
      NEW.bmi_status = 'overweight';
    ELSE
      NEW.bmi_status = 'obese';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically calculate BMI on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_bmi ON patient_medical_info;
CREATE TRIGGER trigger_calculate_bmi
  BEFORE INSERT OR UPDATE ON patient_medical_info
  FOR EACH ROW
  EXECUTE FUNCTION calculate_bmi();

-- Add RLS policies for the new columns (inherit from existing policies)
-- Note: These columns will be covered by existing RLS policies on the table
