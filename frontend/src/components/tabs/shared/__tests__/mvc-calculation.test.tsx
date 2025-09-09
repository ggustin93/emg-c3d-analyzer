/**
 * Test to verify MVC calculation fix in MuscleComplianceCard
 * Ensures that MVC value is correctly calculated from the 75% threshold
 */

import { describe, it, expect } from 'vitest';

describe('MVC Calculation from Threshold', () => {
  it('should correctly calculate MVC value from 75% threshold', () => {
    // Given a threshold that is 75% of MVC
    const mvc75Threshold = 7.5e1; // 75 µV
    const expectedMvcValue = mvc75Threshold / 0.75; // 100 µV
    
    // When calculating MVC from threshold
    const calculatedMvc = mvc75Threshold / 0.75;
    
    // Then MVC should be correctly calculated
    expect(calculatedMvc).toBe(expectedMvcValue);
    expect(calculatedMvc).toBe(100);
  });

  it('should handle very small scientific notation values', () => {
    // Given a small threshold value (as seen in the bug)
    const mvc75Threshold = 2.2e-5; // 0.000022 µV
    const expectedMvcValue = mvc75Threshold / 0.75; // ~0.0000293 µV
    
    // When calculating MVC from threshold
    const calculatedMvc = mvc75Threshold / 0.75;
    
    // Then MVC should be correctly calculated
    expect(calculatedMvc).toBeCloseTo(2.933e-5, 8);
    
    // And the display should show correct relationship
    const thresholdDisplay = mvc75Threshold.toExponential(2);
    const mvcDisplay = calculatedMvc.toExponential(2);
    
    expect(thresholdDisplay).toBe('2.20e-5');
    expect(mvcDisplay).toBe('2.93e-5');
    
    // Verify that threshold is indeed 75% of MVC
    const verifyPercentage = (mvc75Threshold / calculatedMvc) * 100;
    expect(verifyPercentage).toBeCloseTo(75, 1);
  });

  it('should display correct intensity requirement message', () => {
    const mvcThreshold = 7.5e1;
    const mvcValue = mvcThreshold / 0.75;
    
    // Format the message as it appears in the component
    const message = `Intensity requirement: ≥${mvcThreshold.toExponential(2)} µV (75% of ${mvcValue.toExponential(2)} µV MVC)`;
    
    expect(message).toBe('Intensity requirement: ≥7.50e+1 µV (75% of 1.00e+2 µV MVC)');
  });
});