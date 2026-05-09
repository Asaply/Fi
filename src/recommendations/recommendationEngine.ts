import { Recommendation, ParsedStatement, CreditCardMetrics } from '../types/engine';
import { AdvancedCreditMetrics, DebitMetrics } from '../metrics/metricsEngine';

export class RecommendationEngine {
  generateCreditRecommendations(metrics: AdvancedCreditMetrics, dueDate?: string): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Statement balance recommendation
    if (metrics.statementBalance > 0 && metrics.totalPaid < metrics.statementBalance) {
      const remainingStatement = metrics.statementBalance - metrics.totalPaid;
      recommendations.push({
        id: `rec_pay_statement_${Date.now()}`,
        type: 'action',
        message: `Pay $${remainingStatement.toFixed(2)} before ${dueDate || 'the due date'} to avoid interest.`,
        priority: 'high',
      });
    }

    // Utilization recommendation
    if (metrics.utilizationPercentage > 30) {
      recommendations.push({
        id: `rec_utilization_${Date.now()}`,
        type: 'alert',
        message: `Your credit utilization is at ${metrics.utilizationPercentage.toFixed(1)}%. Consider paying down your balance to improve your credit score.`,
        priority: metrics.utilizationPercentage > 50 ? 'high' : 'medium',
      });
    }

    // Minimum payment warning
    if (metrics.paymentHealth === 'at_risk' || metrics.paymentHealth === 'poor') {
      recommendations.push({
        id: `rec_min_payment_${Date.now()}`,
        type: 'alert',
        message: 'Paying only the minimum will result in high interest charges. Try to pay more if possible.',
        priority: 'high',
      });
    }

    // Liquidity recommendation (Placeholder for cross-referencing debit balance)
    if (metrics.paymentHealth === 'excellent') {
      recommendations.push({
        id: `rec_liquidity_${Date.now()}`,
        type: 'insight',
        message: 'You are on track to pay your statement balance without affecting liquidity.',
        priority: 'low',
      });
    }

    return recommendations;
  }

  generateDebitRecommendations(metrics: DebitMetrics): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (metrics.savingsRate < 0.1) {
      recommendations.push({
        id: `rec_savings_${Date.now()}`,
        type: 'alert',
        message: 'Your savings rate is below 10%. Consider reviewing your discretionary expenses.',
        priority: 'medium',
      });
    }

    return recommendations;
  }
}
