import { SimulationParams, SimulationResult } from '../types/engine';

export function simulatePayment(params: SimulationParams): SimulationResult {
  const { currentDebt, minimumPayment, customPayment, interestRate } = params;

  // Use custom payment if provided, otherwise fallback to minimum payment
  const paymentAmount = customPayment > 0 ? customPayment : minimumPayment;
  
  const remainingDebt = Math.max(0, currentDebt - paymentAmount);
  
  // Calculate projected interest for the next cycle
  // Assuming interestRate is Annual Percentage Rate (APR) in percentage (e.g., 45 for 45%)
  const monthlyInterestRate = (interestRate / 100) / 12;
  const projectedInterest = remainingDebt * monthlyInterestRate;
  
  const nextCycleEstimate = remainingDebt + projectedInterest;

  // Utilization change requires credit limit, which isn't in SimulationParams currently.
  // We will return 0 for now or calculate a rough estimate based on debt difference.
  // In a full implementation, creditLimit should be passed into SimulationParams.
  const utilizationChange = currentDebt > 0 ? ((remainingDebt - currentDebt) / currentDebt) * 100 : 0;

  return {
    remainingDebt,
    projectedInterest,
    utilizationChange, // Percentage points change (approximate relative to current debt)
    nextCycleEstimate
  };
}
