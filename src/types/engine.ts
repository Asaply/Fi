export type AccountType = 'debit' | 'credit';

export type BankType = 'BBVA' | 'BANAMEX' | 'SANTANDER' | 'AMEX' | 'UNKNOWN';

export interface StatementMetadata {
  bankName: BankType;
  accountType: AccountType;
  currency: string;
  accountLast4: string;
  statementDate: string; // ISO format YYYY-MM-DD
  dueDate?: string; // ISO format YYYY-MM-DD
  closingDate?: string; // ISO format YYYY-MM-DD
}

export interface CreditCardMetrics {
  currentBalance: number;
  statementBalance: number;
  minimumPayment: number;
  availableCredit: number;
  creditLimit: number;
  utilizationPercentage: number;
  interestRate: number;
  annualFee: number;
  lateFee: number;
}

export type TransactionType = 'charge' | 'payment' | 'refund' | 'interest' | 'fee' | 'transfer';

export interface Transaction {
  id: string;
  date: string; // ISO format
  postDate?: string; // ISO format
  rawDescription: string;
  normalizedMerchant: string;
  amount: number;
  currency: string;
  type: TransactionType;
  category: string;
  installments?: {
    currentMonth: number;
    totalMonths: number;
  };
  metadata?: Record<string, any>;
}

export interface ParsedStatement {
  metadata: StatementMetadata;
  creditMetrics?: CreditCardMetrics;
  transactions: Transaction[];
}

export interface BankParser {
  parse(text: string): ParsedStatement;
}

export interface SimulationParams {
  currentDebt: number;
  minimumPayment: number;
  customPayment: number;
  interestRate: number;
}

export interface SimulationResult {
  remainingDebt: number;
  projectedInterest: number;
  utilizationChange: number;
  nextCycleEstimate: number;
}

export interface Recommendation {
  id: string;
  type: 'action' | 'alert' | 'insight';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Insight {
  id: string;
  category: 'spending' | 'debt' | 'anomaly';
  message: string;
}
