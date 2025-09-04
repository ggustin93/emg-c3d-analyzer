// Test script to verify improved logging captures console messages

console.log("=====================================");
console.log("Testing Improved Console Logging");
console.log("=====================================");

// Test basic strings
console.log("Test 1: Simple string message");
console.info("Test 2: Info message with multiple", "arguments", "combined");
console.warn("Test 3: Warning message!");
console.error("Test 4: Error message!");
console.debug("Test 5: Debug message");

// Test objects
const testObj = { 
  name: "TestUser", 
  id: 123, 
  settings: { 
    theme: "dark", 
    notifications: true 
  } 
};
console.log("Test 6: Object logging:", testObj);

// Test arrays
const testArray = [1, 2, 3, "four", { five: 5 }];
console.log("Test 7: Array logging:", testArray);

// Test mixed types
console.log("Test 8: Mixed types:", "String", 42, true, null, undefined, testObj);

// Test error objects
const testError = new Error("This is a test error");
console.error("Test 9: Error object:", testError);

// Test complex nested structure
const complexData = {
  session: {
    id: "abc-123",
    user: {
      name: "John Doe",
      roles: ["admin", "user"],
      preferences: {
        notifications: {
          email: true,
          push: false
        }
      }
    },
    metrics: [
      { type: "RMS", value: 0.45 },
      { type: "MAV", value: 0.38 }
    ]
  }
};
console.log("Test 10: Complex nested data:", complexData);

// Test rapid logging (should trigger auto-flush at 100 messages)
console.log("Test 11: Starting rapid logging test...");
for (let i = 0; i < 10; i++) {
  console.log(`Rapid log message ${i + 1}/10`);
}

// Test multiline strings
const multilineText = `This is a
multiline
text message
with line breaks`;
console.log("Test 12: Multiline text:", multilineText);

// Final message
console.log("=====================================");
console.log("Logging tests completed!");
console.log("Check frontend.log to verify all messages were captured with content");
console.log("=====================================");

// Force immediate flush to ensure all logs are saved
if (window.logger && window.logger.flush) {
  console.log("Forcing immediate flush of logs...");
  window.logger.flush();
}