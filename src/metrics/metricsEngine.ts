import { Transaction, ParsedStatement, CreditCardMetrics } from '../types/engine';

export interface DebitMetrics {
  income: number;
  expenses: number;
  savingsRate: number;
  netCashflow: number;
  categoryDistribution: Record<string, number>;
}

export interface AdvancedCreditMetrics extends CreditCardMetrics {
  totalPaid: number;
  debtTrend: 'increasing' | 'decreasing' | 'stable';
  paymentHealth: 'excellent' | 'good' | 'at_risk' | 'poor';
  interestExposure: number;
}

export class MetricsEngine {
  calculateDebitMetrics(transactions: Transaction[]): DebitMetrics {
    let income = 0;
    let expenses = 0;
    const categoryDistribution: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.type === 'payment' || tx.type === 'refund') {
        income += tx.amount;
      } else if (tx.type === 'charge' || tx.type === 'fee' || tx.type === 'interest') {
        expenses += tx.amount;
        categoryDistribution[tx.category] = (categoryDistribution[tx.category] || 0) + tx.amount;
      }
    });

    const netCashflow = income - expenses;
    const savingsRate = income > 0 ? Math.max(0, netCashflow / income) : 0;

    return {
      income,
      expenses,
      savingsRate,
      netCashflow,
      categoryDistribution,
    };
  }

  calculateCreditMetrics(
    transactions: Transaction[],
    baseMetrics: CreditCardMetrics,
    previousBalance?: number
  ): AdvancedCreditMetrics {
    let totalPaid = 0;

    transactions.forEach(tx => {
      if (tx.type === 'payment') {
        totalPaid += tx.amount;
      }
    });

    let debtTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (previousBalance !== undefined) {
      if (baseMetrics.currentBalance > previousBalance * 1.05) debtTrend = 'increasing';
      else if (baseMetrics.currentBalance < previousBalance * 0.95) debtTrend = 'decreasing';
    }

    let paymentHealth: 'excellent' | 'good' | 'at_risk' | 'poor' = 'good';
    if (totalPaid >= baseMetrics.statementBalance) {
      paymentHealth = 'excellent';
    } else if (totalPaid > baseMetrics.minimumPayment) {
      paymentHealth = 'good';
    } else if (totalPaid === baseMetrics.minimumPayment) {
      paymentHealth = 'at_risk';
    } else {
      paymentHealth = 'poor';
    }

    // Rough calculation of interest exposure if only minimum payment is made
    const remainingDebt = Math.max(0, baseMetrics.statementBalance - totalPaid);
    const monthlyRate = baseMetrics.interestRate / 12 / 100;
    const interestExposure = remainingDebt * monthlyRate;

    return {
      ...baseMetrics,
      totalPaid,
      debtTrend,
      paymentHealth,
      interestExposure,
    };
  }
}
