import { Insight, Transaction } from '../types/engine';
import { AdvancedCreditMetrics } from '../metrics/metricsEngine';

export class InsightsEngine {
  generateCreditInsights(
    currentMetrics: AdvancedCreditMetrics, 
    previousMetrics?: AdvancedCreditMetrics,
    transactions: Transaction[] = []
  ): Insight[] {
    const insights: Insight[] = [];

    // Utilization trend
    if (previousMetrics) {
      const utilDiff = currentMetrics.utilizationPercentage - previousMetrics.utilizationPercentage;
      if (Math.abs(utilDiff) >= 5) {
        const direction = utilDiff > 0 ? 'increased' : 'decreased';
        insights.push({
          id: `insight_util_${Date.now()}`,
          category: 'debt',
          message: `Your utilization ${direction} ${Math.abs(utilDiff).toFixed(1)}% vs last cycle.`,
        });
      }
    }

    // Anomaly detection: Multiple charges from same merchant in same day
    const merchantCounts: Record<string, number> = {};
    transactions.forEach(tx => {
      if (tx.type === 'charge') {
        const key = `${tx.normalizedMerchant}_${tx.date}`;
        merchantCounts[key] = (merchantCounts[key] || 0) + 1;
      }
    });

    for (const [key, count] of Object.entries(merchantCounts)) {
      if (count >= 2) {
        const merchant = key.split('_')[0];
        insights.push({
          id: `insight_anomaly_${merchant}_${Date.now()}`,
          category: 'anomaly',
          message: `${merchant} charged ${count} times on the same day.`,
        });
      }
    }

    // Projection insight
    if (currentMetrics.debtTrend === 'increasing') {
      insights.push({
        id: `insight_proj_${Date.now()}`,
        category: 'debt',
        message: `You are projected to close the cycle at $${(currentMetrics.currentBalance * 1.1).toFixed(2)}.`,
      });
    }

    return insights;
  }
}
