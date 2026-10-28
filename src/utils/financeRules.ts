export interface AccountRecord {
  id: number;
  name: string;
  accountType: 'bank' | 'cash' | 'wallet';
  openingBalance: string;
  currency: string;
  institution: string;
  isArchived: boolean;
}

export interface CategoryRecord {
  id: number;
  name: string;
  categoryType: 'income' | 'expense';
  color: string;
  icon: string;
  isSystem?: boolean;
}

export interface TransactionRecord {
  id: number;
  accountId: number;
  destinationAccountId?: number | null;
  categoryId?: number | null;
  transactionType: 'income' | 'expense' | 'transfer';
  amount: string;
  description: string;
  transactionDate: string; // YYYY-MM-DD
  notes?: string;
  recurringRuleId?: number | null;
  externalHash?: string | null;
}

export interface BudgetRecord {
  id: number;
  categoryId: number;
  month: string; // YYYY-MM
  amountLimit: string;
  alertThresholdPct: number;
}

export interface SavingsGoalRecord {
  id: number;
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string; // YYYY-MM-DD
  accountId?: number | null;
  color: string;
  status: 'active' | 'completed' | 'paused';
}

export interface RecurringRuleRecord {
  id: number;
  accountId: number;
  categoryId?: number | null;
  transactionType: 'income' | 'expense';
  amount: string;
  description: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  nextDueDate: string; // YYYY-MM-DD
  lastProcessedDate?: string | null;
  isActive: boolean;
  reminderDaysBefore: number;
}

/**
 * Decimal-safe conversion from string/number to integer cents.
 */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Converts integer cents back to a normalized 2-decimal string.
 */
export function fromCents(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = safeCents < 0 ? '-' : '';
  const abs = Math.abs(safeCents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${dollars}.${String(rem).padStart(2, '0')}`;
}

/**
 * Formats cents or decimal string into a currency display string.
 */
export function formatCurrency(
  value: string | number,
  currency = 'USD'
): string {
  const cents = typeof value === 'number' ? Math.round(value * 100) : toCents(value);
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${fromCents(cents)}`;
  }
}

/**
 * Validates a monetary amount string. Must be > 0 and max 2 decimal places.
 */
export function validateMonetaryAmount(raw: string | number): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const str = String(raw ?? '').trim();
  if (!str) {
    return { valid: false, normalized: '0.00', error: 'Amount is required.' };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    return {
      valid: false,
      normalized: '0.00',
      error: 'Amount must be a positive number with up to 2 decimal places.',
    };
  }
  const cents = toCents(str);
  if (cents <= 0) {
    return {
      valid: false,
      normalized: '0.00',
      error: 'Amount must be greater than zero.',
    };
  }
  if (cents > 99999999900) {
    return {
      valid: false,
      normalized: '0.00',
      error: 'Amount exceeds maximum supported limit.',
    };
  }
  return { valid: true, normalized: fromCents(cents) };
}

/**
 * Validates YYYY-MM-DD calendar date string.
 */
export function isValidIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Calculates current balance for each account and total net balance.
 * Transfers move funds from source to destination without inflating income/expense.
 */
export function calculateAccountBalances(
  accounts: AccountRecord[],
  transactions: TransactionRecord[]
): {
  byAccountId: Record<number, { balanceCents: number; balance: string; txCount: number }>;
  totalBalanceCents: number;
  totalBalance: string;
} {
  const byAccountId: Record<
    number,
    { balanceCents: number; balance: string; txCount: number }
  > = {};

  for (const acc of accounts) {
    const opening = toCents(acc.openingBalance);
    byAccountId[acc.id] = {
      balanceCents: opening,
      balance: fromCents(opening),
      txCount: 0,
    };
  }

  for (const tx of transactions) {
    const amt = toCents(tx.amount);
    if (tx.transactionType === 'income') {
      if (byAccountId[tx.accountId]) {
        byAccountId[tx.accountId].balanceCents += amt;
        byAccountId[tx.accountId].txCount += 1;
      }
    } else if (tx.transactionType === 'expense') {
      if (byAccountId[tx.accountId]) {
        byAccountId[tx.accountId].balanceCents -= amt;
        byAccountId[tx.accountId].txCount += 1;
      }
    } else if (tx.transactionType === 'transfer') {
      if (byAccountId[tx.accountId]) {
        byAccountId[tx.accountId].balanceCents -= amt;
        byAccountId[tx.accountId].txCount += 1;
      }
      if (
        tx.destinationAccountId &&
        tx.destinationAccountId !== tx.accountId &&
        byAccountId[tx.destinationAccountId]
      ) {
        byAccountId[tx.destinationAccountId].balanceCents += amt;
        byAccountId[tx.destinationAccountId].txCount += 1;
      }
    }
  }

  let totalBalanceCents = 0;
  for (const acc of accounts) {
    const entry = byAccountId[acc.id];
    entry.balance = fromCents(entry.balanceCents);
    if (!acc.isArchived) {
      totalBalanceCents += entry.balanceCents;
    }
  }

  return {
    byAccountId,
    totalBalanceCents,
    totalBalance: fromCents(totalBalanceCents),
  };
}

/**
 * Calculates income, expenses, net savings, and savings rate for a given period.
 * Transfers are strictly excluded from income and expense totals.
 */
export function calculateCashFlowSummary(
  transactions: TransactionRecord[],
  monthPrefix?: string
): {
  incomeCents: number;
  expenseCents: number;
  netSavingsCents: number;
  income: string;
  expense: string;
  netSavings: string;
  savingsRatePct: number;
} {
  let incomeCents = 0;
  let expenseCents = 0;

  for (const tx of transactions) {
    if (monthPrefix && !tx.transactionDate.startsWith(monthPrefix)) {
      continue;
    }
    const amt = toCents(tx.amount);
    if (tx.transactionType === 'income') {
      incomeCents += amt;
    } else if (tx.transactionType === 'expense') {
      expenseCents += amt;
    }
  }

  const netSavingsCents = incomeCents - expenseCents;
  const savingsRatePct =
    incomeCents > 0
      ? Math.round(((incomeCents - expenseCents) / incomeCents) * 1000) / 10
      : 0;

  return {
    incomeCents,
    expenseCents,
    netSavingsCents,
    income: fromCents(incomeCents),
    expense: fromCents(expenseCents),
    netSavings: fromCents(netSavingsCents),
    savingsRatePct,
  };
}

/**
 * Aggregates category breakdown for income or expense transactions.
 */
export function calculateCategoryBreakdown(
  transactions: TransactionRecord[],
  categories: CategoryRecord[],
  type: 'income' | 'expense' = 'expense',
  monthPrefix?: string
): Array<{
  categoryId: number | null;
  categoryName: string;
  color: string;
  amountCents: number;
  amount: string;
  percentage: number;
  transactionCount: number;
}> {
  const catMap = new Map<number, CategoryRecord>();
  for (const c of categories) {
    catMap.set(c.id, c);
  }

  const totals = new Map<
    number | null,
    { amountCents: number; count: number }
  >();
  let grandTotalCents = 0;

  for (const tx of transactions) {
    if (tx.transactionType !== type) continue;
    if (monthPrefix && !tx.transactionDate.startsWith(monthPrefix)) continue;

    const amt = toCents(tx.amount);
    const key = tx.categoryId ?? null;
    const prev = totals.get(key) || { amountCents: 0, count: 0 };
    prev.amountCents += amt;
    prev.count += 1;
    totals.set(key, prev);
    grandTotalCents += amt;
  }

  const results: Array<{
    categoryId: number | null;
    categoryName: string;
    color: string;
    amountCents: number;
    amount: string;
    percentage: number;
    transactionCount: number;
  }> = [];

  for (const [categoryId, info] of totals.entries()) {
    const cat = categoryId ? catMap.get(categoryId) : undefined;
    const pct =
      grandTotalCents > 0
        ? Math.round((info.amountCents / grandTotalCents) * 1000) / 10
        : 0;
    results.push({
      categoryId,
      categoryName: cat ? cat.name : 'Uncategorized',
      color: cat ? cat.color : '#64748b',
      amountCents: info.amountCents,
      amount: fromCents(info.amountCents),
      percentage: pct,
      transactionCount: info.count,
    });
  }

  return results.sort((a, b) => b.amountCents - a.amountCents);
}

/**
 * Evaluates monthly budgets against actual category expenses.
 */
export function evaluateBudgetProgress(
  budgets: BudgetRecord[],
  transactions: TransactionRecord[],
  categories: CategoryRecord[],
  month: string
): Array<{
  budgetId: number;
  categoryId: number;
  categoryName: string;
  color: string;
  month: string;
  limitCents: number;
  spentCents: number;
  remainingCents: number;
  limit: string;
  spent: string;
  remaining: string;
  percentage: number;
  alertThresholdPct: number;
  status: 'healthy' | 'warning' | 'exceeded';
}> {
  const catMap = new Map<number, CategoryRecord>();
  for (const c of categories) {
    catMap.set(c.id, c);
  }

  const monthBudgets = budgets.filter((b) => b.month === month);

  return monthBudgets.map((b) => {
    const limitCents = toCents(b.amountLimit);
    let spentCents = 0;

    for (const tx of transactions) {
      if (
        tx.transactionType === 'expense' &&
        tx.categoryId === b.categoryId &&
        tx.transactionDate.startsWith(month)
      ) {
        spentCents += toCents(tx.amount);
      }
    }

    const remainingCents = limitCents - spentCents;
    let percentage = 0;
    if (limitCents > 0) {
      percentage = Math.round((spentCents / limitCents) * 1000) / 10;
    } else if (spentCents > 0) {
      percentage = 100;
    }

    let status: 'healthy' | 'warning' | 'exceeded' = 'healthy';
    if (spentCents > limitCents || (limitCents === 0 && spentCents > 0)) {
      status = 'exceeded';
    } else if (percentage >= b.alertThresholdPct) {
      status = 'warning';
    }

    const cat = catMap.get(b.categoryId);

    return {
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: cat ? cat.name : 'Category',
      color: cat ? cat.color : '#059669',
      month: b.month,
      limitCents,
      spentCents,
      remainingCents,
      limit: fromCents(limitCents),
      spent: fromCents(spentCents),
      remaining: fromCents(remainingCents),
      percentage,
      alertThresholdPct: b.alertThresholdPct,
      status,
    };
  });
}

/**
 * Evaluates savings goal progress and deadline status.
 */
export function evaluateSavingsGoal(
  goal: SavingsGoalRecord,
  referenceDateStr = new Date().toISOString().slice(0, 10)
): {
  targetCents: number;
  currentCents: number;
  remainingCents: number;
  progressPct: number;
  daysRemaining: number;
  isCompleted: boolean;
  isOverdue: boolean;
} {
  const targetCents = toCents(goal.targetAmount);
  const currentCents = toCents(goal.currentAmount);
  const remainingCents = Math.max(0, targetCents - currentCents);
  const progressPct =
    targetCents > 0
      ? Math.min(100, Math.round((currentCents / targetCents) * 1000) / 10)
      : currentCents > 0
        ? 100
        : 0;

  const refTime = Date.parse(`${referenceDateStr}T00:00:00Z`);
  const targetTime = Date.parse(`${goal.targetDate}T00:00:00Z`);
  const daysRemaining =
    Number.isFinite(refTime) && Number.isFinite(targetTime)
      ? Math.ceil((targetTime - refTime) / (1000 * 60 * 60 * 24))
      : 0;

  const isCompleted = currentCents >= targetCents && targetCents > 0;
  const isOverdue = !isCompleted && daysRemaining < 0;

  return {
    targetCents,
    currentCents,
    remainingCents,
    progressPct,
    daysRemaining,
    isCompleted,
    isOverdue,
  };
}

/**
 * Advances a YYYY-MM-DD date string according to recurrence frequency.
 */
export function computeNextDueDate(
  currentDueDate: string,
  frequency: RecurringRuleRecord['frequency']
): string {
  const [y, m, d] = currentDueDate.split('-').map(Number);
  if (frequency === 'weekly') {
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    return dt.toISOString().slice(0, 10);
  }
  if (frequency === 'biweekly') {
    const dt = new Date(Date.UTC(y, m - 1, d + 14));
    return dt.toISOString().slice(0, 10);
  }

  let monthsToAdd = 1;
  if (frequency === 'quarterly') monthsToAdd = 3;
  if (frequency === 'yearly') monthsToAdd = 12;

  const targetMonthIndex = m - 1 + monthsToAdd;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Clamp day to end of target month (e.g. Jan 31 -> Feb 28)
  const maxDayInMonth = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(d, maxDayInMonth);

  const result = new Date(Date.UTC(targetYear, normalizedMonth, clampedDay));
  return result.toISOString().slice(0, 10);
}

/**
 * Determines which recurring rules are due for idempotent execution.
 */
export function getDueRecurringRules(
  rules: RecurringRuleRecord[],
  asOfDate: string
): RecurringRuleRecord[] {
  return rules.filter(
    (rule) =>
      rule.isActive &&
      rule.nextDueDate <= asOfDate &&
      rule.lastProcessedDate !== rule.nextDueDate
  );
}

/**
 * Creates a deterministic fingerprint hash for duplicate transaction detection.
 */
export function buildTransactionHash(input: {
  transactionDate: string;
  description: string;
  transactionType: string;
  amount: string;
  accountNameOrId: string | number;
}): string {
  const normalizedAmt = fromCents(toCents(input.amount));
  const normalizedDesc = input.description.trim().toLowerCase().replace(/\s+/g, ' ');
  const normalizedType = input.transactionType.trim().toLowerCase();
  const normalizedAcc = String(input.accountNameOrId).trim().toLowerCase();
  return `${input.transactionDate.trim()}|${normalizedDesc}|${normalizedType}|${normalizedAmt}|${normalizedAcc}`;
}

export interface CsvImportRow {
  transactionDate: string;
  description: string;
  transactionType: 'income' | 'expense' | 'transfer';
  amount: string;
  accountId: number;
  categoryId: number | null;
  notes: string;
  externalHash: string;
}

export interface CsvValidationResult {
  validHeader: boolean;
  headerError?: string;
  totalRows: number;
  validRows: CsvImportRow[];
  duplicatesSkipped: number;
  errors: Array<{ line: number; message: string; raw: string }>;
}

/**
 * Parses a single CSV line respecting quoted fields.
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Validates and parses CSV content for transaction imports.
 * Expected headers: date,description,type,amount,account,category,notes
 */
export function validateAndParseTransactionsCsv(
  csvText: string,
  existingTransactions: TransactionRecord[],
  accounts: AccountRecord[],
  categories: CategoryRecord[]
): CsvValidationResult {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return {
      validHeader: false,
      headerError: 'CSV file is empty.',
      totalRows: 0,
      validRows: [],
      duplicatesSkipped: 0,
      errors: [],
    };
  }

  const rawHeaders = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const requiredHeaders = ['date', 'description', 'type', 'amount'];
  const missingHeaders = requiredHeaders.filter((h) => !rawHeaders.includes(h));

  if (missingHeaders.length > 0) {
    return {
      validHeader: false,
      headerError: `Missing required CSV columns: ${missingHeaders.join(', ')}. Expected: date,description,type,amount,account,category,notes`,
      totalRows: Math.max(0, lines.length - 1),
      validRows: [],
      duplicatesSkipped: 0,
      errors: [],
    };
  }

  const idxDate = rawHeaders.indexOf('date');
  const idxDesc = rawHeaders.indexOf('description');
  const idxType = rawHeaders.indexOf('type');
  const idxAmount = rawHeaders.indexOf('amount');
  const idxAccount = rawHeaders.indexOf('account');
  const idxCategory = rawHeaders.indexOf('category');
  const idxNotes = rawHeaders.indexOf('notes');

  const existingHashes = new Set<string>();
  for (const tx of existingTransactions) {
    existingHashes.add(
      buildTransactionHash({
        transactionDate: tx.transactionDate,
        description: tx.description,
        transactionType: tx.transactionType,
        amount: tx.amount,
        accountNameOrId: tx.accountId,
      })
    );
  }

  const validRows: CsvImportRow[] = [];
  const errors: Array<{ line: number; message: string; raw: string }> = [];
  let duplicatesSkipped = 0;

  const defaultAccount = accounts[0];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = parseCsvLine(rawLine);
    const lineNum = i + 1;

    if (cols.length < requiredHeaders.length) {
      errors.push({
        line: lineNum,
        message: 'Malformed CSV record: insufficient columns.',
        raw: rawLine,
      });
      continue;
    }

    const dateVal = cols[idxDate] || '';
    const descVal = cols[idxDesc] || '';
    const typeVal = (cols[idxType] || '').toLowerCase();
    const amountVal = cols[idxAmount] || '';
    const accountName = idxAccount >= 0 ? cols[idxAccount] || '' : '';
    const categoryName = idxCategory >= 0 ? cols[idxCategory] || '' : '';
    const notesVal = idxNotes >= 0 ? cols[idxNotes] || '' : '';

    if (!isValidIsoDate(dateVal)) {
      errors.push({
        line: lineNum,
        message: `Invalid date "${dateVal}". Use YYYY-MM-DD format.`,
        raw: rawLine,
      });
      continue;
    }

    if (!descVal.trim()) {
      errors.push({
        line: lineNum,
        message: 'Description cannot be empty.',
        raw: rawLine,
      });
      continue;
    }

    if (!['income', 'expense', 'transfer'].includes(typeVal)) {
      errors.push({
        line: lineNum,
        message: `Invalid transaction type "${typeVal}". Must be income, expense, or transfer.`,
        raw: rawLine,
      });
      continue;
    }

    const amtValidation = validateMonetaryAmount(amountVal);
    if (!amtValidation.valid) {
      errors.push({
        line: lineNum,
        message: amtValidation.error || 'Invalid amount.',
        raw: rawLine,
      });
      continue;
    }

    let matchedAccount = accounts.find(
      (a) => a.name.toLowerCase() === accountName.toLowerCase()
    );
    if (!matchedAccount) {
      if (!accountName && defaultAccount) {
        matchedAccount = defaultAccount;
      } else if (defaultAccount && accounts.length > 0) {
        matchedAccount = defaultAccount;
      } else {
        errors.push({
          line: lineNum,
          message: `No matching account found for "${accountName}".`,
          raw: rawLine,
        });
        continue;
      }
    }

    let matchedCategoryId: number | null = null;
    if (categoryName) {
      const cat = categories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      if (cat) matchedCategoryId = cat.id;
    }

    const rowHash = buildTransactionHash({
      transactionDate: dateVal,
      description: descVal,
      transactionType: typeVal,
      amount: amtValidation.normalized,
      accountNameOrId: matchedAccount.id,
    });

    if (existingHashes.has(rowHash)) {
      duplicatesSkipped += 1;
      continue;
    }

    existingHashes.add(rowHash);
    validRows.push({
      transactionDate: dateVal,
      description: descVal.trim(),
      transactionType: typeVal as 'income' | 'expense' | 'transfer',
      amount: amtValidation.normalized,
      accountId: matchedAccount.id,
      categoryId: matchedCategoryId,
      notes: notesVal.trim(),
      externalHash: rowHash,
    });
  }

  return {
    validHeader: true,
    totalRows: lines.length - 1,
    validRows,
    duplicatesSkipped,
    errors,
  };
}

/**
 * Generates RFC-4180 compliant CSV string for transactions export.
 */
export function generateTransactionsCsv(
  transactions: TransactionRecord[],
  accounts: AccountRecord[],
  categories: CategoryRecord[]
): string {
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const escapeCsv = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = [
    ['date', 'description', 'type', 'amount', 'account', 'category', 'notes'].join(','),
  ];

  for (const tx of transactions) {
    const accName = accMap.get(tx.accountId) || 'Account';
    const catName = tx.categoryId ? catMap.get(tx.categoryId) || '' : '';
    rows.push(
      [
        escapeCsv(tx.transactionDate),
        escapeCsv(tx.description),
        escapeCsv(tx.transactionType),
        escapeCsv(fromCents(toCents(tx.amount))),
        escapeCsv(accName),
        escapeCsv(catName),
        escapeCsv(tx.notes || ''),
      ].join(',')
    );
  }

  return rows.join('\n');
}
