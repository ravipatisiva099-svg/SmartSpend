import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toCents,
  fromCents,
  validateMonetaryAmount,
  calculateAccountBalances,
  calculateCashFlowSummary,
  evaluateBudgetProgress,
  evaluateSavingsGoal,
  computeNextDueDate,
  getDueRecurringRules,
  validateAndParseTransactionsCsv,
  generateTransactionsCsv,
  AccountRecord,
  CategoryRecord,
  TransactionRecord,
  BudgetRecord,
  RecurringRuleRecord,
} from './financeRules';

const mockAccounts: AccountRecord[] = [
  {
    id: 1,
    name: 'Primary Checking',
    accountType: 'bank',
    openingBalance: '2500.00',
    currency: 'USD',
    institution: 'Chase',
    isArchived: false,
  },
  {
    id: 2,
    name: 'High-Yield Savings',
    accountType: 'bank',
    openingBalance: '10000.00',
    currency: 'USD',
    institution: 'Ally',
    isArchived: false,
  },
  {
    id: 3,
    name: 'Cash Wallet',
    accountType: 'cash',
    openingBalance: '150.00',
    currency: 'USD',
    institution: 'Personal',
    isArchived: false,
  },
];

const mockCategories: CategoryRecord[] = [
  { id: 10, name: 'Salary', categoryType: 'income', color: '#059669', icon: 'briefcase' },
  { id: 11, name: 'Groceries', categoryType: 'expense', color: '#d97706', icon: 'shopping-bag' },
  { id: 12, name: 'Housing', categoryType: 'expense', color: '#2563eb', icon: 'home' },
];

test('decimal-safe monetary math avoids floating point drift', () => {
  assert.equal(toCents('19.99') + toCents('0.01'), 2000);
  assert.equal(fromCents(toCents('0.10') + toCents('0.20')), '0.30');
  assert.equal(validateMonetaryAmount('125.50').valid, true);
  assert.equal(validateMonetaryAmount('-10.00').valid, false);
  assert.equal(validateMonetaryAmount('0').valid, false);
  assert.equal(validateMonetaryAmount('12.345').valid, false);
});

test('account balances and transfers do not double-count net worth or cash flow', () => {
  const txs: TransactionRecord[] = [
    {
      id: 1,
      accountId: 1,
      categoryId: 10,
      transactionType: 'income',
      amount: '4200.00',
      description: 'Monthly Payroll',
      transactionDate: '2026-10-01',
    },
    {
      id: 2,
      accountId: 1,
      categoryId: 11,
      transactionType: 'expense',
      amount: '245.75',
      description: 'Whole Foods Market',
      transactionDate: '2026-10-05',
    },
    {
      id: 3,
      accountId: 1,
      destinationAccountId: 2,
      categoryId: null,
      transactionType: 'transfer',
      amount: '1000.00',
      description: 'Monthly Savings Transfer',
      transactionDate: '2026-10-10',
    },
  ];

  const balances = calculateAccountBalances(mockAccounts, txs);
  // Checking: 2500 + 4200 - 245.75 - 1000 = 5454.25
  assert.equal(balances.byAccountId[1].balance, '5454.25');
  // Savings: 10000 + 1000 = 11000.00
  assert.equal(balances.byAccountId[2].balance, '11000.00');
  // Total: 5454.25 + 11000.00 + 150.00 = 16604.25
  assert.equal(balances.totalBalance, '16604.25');

  const cashFlow = calculateCashFlowSummary(txs, '2026-10');
  // Transfer of 1000.00 must NOT be counted in income or expense
  assert.equal(cashFlow.income, '4200.00');
  assert.equal(cashFlow.expense, '245.75');
  assert.equal(cashFlow.netSavings, '3954.25');
});

test('budget threshold warnings and exceeded statuses calculate accurately', () => {
  const budgets: BudgetRecord[] = [
    { id: 1, categoryId: 11, month: '2026-10', amountLimit: '500.00', alertThresholdPct: 80 },
    { id: 2, categoryId: 12, month: '2026-10', amountLimit: '1500.00', alertThresholdPct: 80 },
  ];

  const txs: TransactionRecord[] = [
    {
      id: 1,
      accountId: 1,
      categoryId: 11,
      transactionType: 'expense',
      amount: '425.00',
      description: 'Groceries Week 1-3',
      transactionDate: '2026-10-15',
    },
    {
      id: 2,
      accountId: 1,
      categoryId: 12,
      transactionType: 'expense',
      amount: '1650.00',
      description: 'Apartment Rent',
      transactionDate: '2026-10-01',
    },
  ];

  const progress = evaluateBudgetProgress(budgets, txs, mockCategories, '2026-10');
  const groceriesBudget = progress.find((b) => b.categoryId === 11)!;
  const housingBudget = progress.find((b) => b.categoryId === 12)!;

  assert.equal(groceriesBudget.percentage, 85);
  assert.equal(groceriesBudget.status, 'warning');
  assert.equal(groceriesBudget.remaining, '75.00');

  assert.equal(housingBudget.percentage, 110);
  assert.equal(housingBudget.status, 'exceeded');
  assert.equal(housingBudget.remaining, '-150.00');
});

test('savings goal evaluation and idempotent recurring rule processing', () => {
  const goalEval = evaluateSavingsGoal(
    {
      id: 1,
      name: 'Emergency Fund',
      targetAmount: '10000.00',
      currentAmount: '7500.00',
      targetDate: '2026-12-31',
      color: '#059669',
      status: 'active',
    },
    '2026-10-28'
  );
  assert.equal(goalEval.progressPct, 75);
  assert.equal(goalEval.remainingCents, 250000);
  assert.equal(goalEval.isCompleted, false);

  assert.equal(computeNextDueDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(computeNextDueDate('2026-10-15', 'weekly'), '2026-10-22');

  const rules: RecurringRuleRecord[] = [
    {
      id: 1,
      accountId: 1,
      categoryId: 12,
      transactionType: 'expense',
      amount: '1500.00',
      description: 'Monthly Rent',
      frequency: 'monthly',
      nextDueDate: '2026-10-01',
      lastProcessedDate: null,
      isActive: true,
      reminderDaysBefore: 3,
    },
    {
      id: 2,
      accountId: 1,
      categoryId: 12,
      transactionType: 'expense',
      amount: '85.00',
      description: 'Fiber Internet',
      frequency: 'monthly',
      nextDueDate: '2026-10-01',
      lastProcessedDate: '2026-10-01', // Already processed for this due date!
      isActive: true,
      reminderDaysBefore: 3,
    },
  ];

  const due = getDueRecurringRules(rules, '2026-10-28');
  assert.equal(due.length, 1);
  assert.equal(due[0].id, 1);
});

test('CSV import validator catches invalid headers, malformed rows, invalid amounts, and duplicates', () => {
  const existing: TransactionRecord[] = [
    {
      id: 100,
      accountId: 1,
      categoryId: 11,
      transactionType: 'expense',
      amount: '54.20',
      description: 'Trader Joes',
      transactionDate: '2026-10-12',
    },
  ];

  const csvContent = [
    'date,description,type,amount,account,category,notes',
    '2026-10-12,Trader Joes,expense,54.20,Primary Checking,Groceries,Duplicate row',
    '2026-10-18,Tech Salary,income,3200.00,Primary Checking,Salary,Direct deposit',
    '2026-02-30,Invalid Date Item,expense,25.00,Primary Checking,Groceries,Bad date',
    '2026-10-19,Negative Expense,expense,-45.00,Primary Checking,Groceries,Bad amount',
  ].join('\n');

  const result = validateAndParseTransactionsCsv(
    csvContent,
    existing,
    mockAccounts,
    mockCategories
  );

  assert.equal(result.validHeader, true);
  assert.equal(result.totalRows, 4);
  assert.equal(result.duplicatesSkipped, 1);
  assert.equal(result.validRows.length, 1);
  assert.equal(result.validRows[0].description, 'Tech Salary');
  assert.equal(result.errors.length, 2);

  const exported = generateTransactionsCsv(existing, mockAccounts, mockCategories);
  assert.equal(exported.includes('2026-10-12,Trader Joes,expense,54.20,Primary Checking,Groceries,'), true);
});
