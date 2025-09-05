-- Manual Test Data Cleanup Script
-- =================================
-- Use this script to clean up test data from the database
-- when you need to reset to a clean state for testing
-- 
-- IMPORTANT: This will DELETE all therapy sessions and related data!
-- Only the default scoring configuration will be preserved.

-- Step 1: Delete all performance scores (child table)
DELETE FROM performance_scores;

-- Step 2: Delete all EMG statistics (child table)  
DELETE FROM emg_statistics;

-- Step 3: Delete all BFR monitoring data (child table)
DELETE FROM bfr_monitoring;

-- Step 4: Delete all session settings (child table)
DELETE FROM session_settings;

-- Step 5: Delete all therapy sessions (parent table)
DELETE FROM therapy_sessions;

-- Step 6: Clean up test scoring configurations
-- Keep only the default GHOSTLY-TRIAL-DEFAULT configuration
DELETE FROM scoring_configuration 
WHERE id != 'a0000000-0000-0000-0000-000000000001';

-- Step 7: Ensure the default trial configuration is active
UPDATE scoring_configuration 
SET active = true 
WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Step 8: Show remaining data counts
SELECT 
    'Summary after cleanup:' as message,
    (SELECT COUNT(*) FROM therapy_sessions) as therapy_sessions_count,
    (SELECT COUNT(*) FROM emg_statistics) as emg_statistics_count,
    (SELECT COUNT(*) FROM performance_scores) as performance_scores_count,
    (SELECT COUNT(*) FROM bfr_monitoring) as bfr_monitoring_count,
    (SELECT COUNT(*) FROM session_settings) as session_settings_count,
    (SELECT COUNT(*) FROM scoring_configuration) as scoring_config_count;