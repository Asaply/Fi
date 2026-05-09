import { ParserEngine } from './parsers/parserEngine';
import { BBVAParser } from './banks/bbvaParser';
import { MetricsEngine, AdvancedCreditMetrics, DebitMetrics } from './metrics/metricsEngine';
import { RecommendationEngine } from './recommendations/recommendationEngine';
import { InsightsEngine } from './insights/insightsEngine';
import { simulatePayment } from './simulation/paymentSimulator';
import { SimulationParams, ParsedStatement, Recommendation, Insight, SimulationResult } from './types/engine';

export class NVAEngine {
  private parserEngine: ParserEngine;
  private metricsEngine: MetricsEngine;
  private recommendationEngine: RecommendationEngine;
  private insightsEngine: InsightsEngine;

  constructor() {
    this.parserEngine = new ParserEngine();
    this.metricsEngine = new MetricsEngine();
    this.recommendationEngine = new RecommendationEngine();
    this.insightsEngine = new InsightsEngine();

    // Register supported bank parsers
    this.parserEngine.registerParser('BBVA', new BBVAParser());
    // Future: Register BANAMEX, SANTANDER, AMEX
  }

  /**
   * Process a raw statement text and return a complete financial intelligence report
   */
  processStatement(rawText: string, previousMetrics?: AdvancedCreditMetrics) {
    // 1. Parse and extract
    const parsedStatement = this.parserEngine.parse(rawText);

    let metrics: DebitMetrics | AdvancedCreditMetrics;
    let recommendations: Recommendation[] = [];
    let insights: Insight[] = [];

    // 2. Metrics & Intelligence Generation
    if (parsedStatement.metadata.accountType === 'credit' && parsedStatement.creditMetrics) {
      const advancedMetrics = this.metricsEngine.calculateCreditMetrics(
        parsedStatement.transactions,
        parsedStatement.creditMetrics,
        previousMetrics?.currentBalance
      );
      
      metrics = advancedMetrics;
      
      recommendations = this.recommendationEngine.generateCreditRecommendations(
        advancedMetrics, 
        parsedStatement.metadata.dueDate
      );
      
      insights = this.insightsEngine.generateCreditInsights(
        advancedMetrics, 
        previousMetrics, 
        parsedStatement.transactions
      );
    } else {
      const debitMetrics = this.metricsEngine.calculateDebitMetrics(parsedStatement.transactions);
      metrics = debitMetrics;
      
      recommendations = this.recommendationEngine.generateDebitRecommendations(debitMetrics);
      // Insights for debit could be added here
    }

    // 3. Return structured API output
    return {
      statement: parsedStatement,
      metrics,
      recommendations,
      insights
    };
  }

  /**
   * Process pre-parsed transactions (e.g. from Claude LLM fallback) to generate intelligence
   */
  processParsedTransactions(transactions: import('./types/engine').Transaction[], isCreditCard: boolean, creditMetrics?: AdvancedCreditMetrics) {
    let metrics;
    let recommendations: Recommendation[] = [];
    let insights: Insight[] = [];

    if (isCreditCard) {
      // Mock base credit metrics if not provided by the parser
      const baseMetrics = creditMetrics || {
        currentBalance: 0,
        statementBalance: 0,
        minimumPayment: 0,
        availableCredit: 0,
        creditLimit: 0,
        utilizationPercentage: 0,
        interestRate: 0,
        annualFee: 0,
        lateFee: 0,
        totalPaid: 0,
        debtTrend: 'stable',
        paymentHealth: 'good',
        interestExposure: 0,
      } as AdvancedCreditMetrics;

      metrics = this.metricsEngine.calculateCreditMetrics(transactions, baseMetrics);
      recommendations = this.recommendationEngine.generateCreditRecommendations(metrics);
      insights = this.insightsEngine.generateCreditInsights(metrics, undefined, transactions);
    } else {
      metrics = this.metricsEngine.calculateDebitMetrics(transactions);
      recommendations = this.recommendationEngine.generateDebitRecommendations(metrics);
    }

    return { metrics, recommendations, insights };
  }

  /**
   * Simulate a payment outcome independently
   */
  simulate(params: SimulationParams): SimulationResult {
    return simulatePayment(params);
  }
}

// Export singleton instance for easy usage
export const nvaEngine = new NVAEngine();
