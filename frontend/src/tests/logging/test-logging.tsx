/**
 * Test component to demonstrate frontend logging capabilities
 * This can be imported and used temporarily to test logging
 */
import React, { useEffect } from 'react';
import { logger, LogCategory } from './services/logger';

export const TestLogging: React.FC = () => {
  useEffect(() => {
    // Test categorized logging
    logger.info(LogCategory.API, "Testing API logging", { endpoint: "/test", method: "GET" });
    logger.warn(LogCategory.AUTH, "Testing auth warning", { user: "test-user" });
    logger.error(LogCategory.DATA_PROCESSING, "Testing data processing error", new Error("Test error"));
    
    // Test console interception
    console.log("Standard console.log - should be captured");
    console.info("Console.info with object:", { test: true, nested: { value: 42 } });
    console.warn("Console.warn with array:", [1, 2, 3, "four"]);
    console.error("Console.error with error:", new Error("Test console error"));
    console.debug("Console.debug message");
    
    // Test complex objects
    const complexData = {
      session: {
        id: "test-123",
        timestamp: new Date().toISOString(),
        metrics: {
          rms: 0.45,
          mav: 0.38,
          frequency: { mpf: 85.2, mdf: 78.5 }
        },
        arrays: [[1, 2], [3, 4], [5, 6]],
        nested: {
          deeply: {
            nested: {
              value: "Found me!"
            }
          }
        }
      }
    };
    logger.info(LogCategory.DATA_PROCESSING, "Complex data structure:", complexData);
    
    // Test rapid logging (should trigger auto-flush)
    for (let i = 0; i < 10; i++) {
      console.log(`Rapid log ${i + 1}/10`);
    }
    
    // Force flush to ensure all logs are saved
    logger.flush();
    
    console.log("✅ Logging test completed - check logs/frontend.log");
  }, []);
  
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', margin: '10px', borderRadius: '5px' }}>
      <h3>Logging Test Component</h3>
      <p>Check the console and logs/frontend.log file for test output</p>
      <button onClick={() => {
        console.log("Button clicked at", new Date().toISOString());
        logger.info(LogCategory.USER_INTERACTION, "Test button clicked");
      }}>
        Test Manual Log
      </button>
    </div>
  );
};