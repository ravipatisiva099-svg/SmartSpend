import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Download,
  Upload,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  AccountRecord,
  CategoryRecord,
  TransactionRecord,
  toCents,
  formatCurrency,
  validateAndParseTransactionsCsv,
  generateTransactionsCsv,
  CsvValidationResult,
  CsvImportRow,
} from '../utils/financeRules';

interface TransactionsViewProps {
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  transactions: TransactionRecord[];
  currency: string;
  onChangeCurrency?: (nextCurrency: string) => Promise<void>;
  showNewModalInitially?: boolean;
  onClearInitialModal?: () => void;
  onCreateTransaction: (payload: {
    accountId: number;
    destinationAccountId?: number | null;
    categoryId?: number | null;
    transactionType: 'income' | 'expense' | 'transfer';
    amount: string;
    description: string;
    transactionDate: string;
    notes: string;
  }) => Promise<void>;
  onUpdateTransaction: (
    id: number,
    payload: {
      accountId: number;
      destinationAccountId?: number | null;
      categoryId?: number | null;
      transactionType: 'income' | 'expense' | 'transfer';
      amount: string;
      description: string;
      transactionDate: string;
      notes: string;
    }
  ) => Promise<void>;
  onDeleteTransaction: (id: number) => Promise<void>;
  onImportTransactions: (rows: CsvImportRow[]) => Promise<void>;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  accounts,
  categories,
  transactions,
  currency,
  onChangeCurrency,
  showNewModalInitially = false,
  onClearInitialModal,
  onCreateTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onImportTransactions,
}) => {
  // Search, Filters, Sorting, Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>(
    'date-desc'
  );
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Create / Edit Form State
  const [isFormOpen, setIsFormOpen] = useState(showNewModalInitially);
  const [editingTx, setEditingTx] = useState<TransactionRecord | null>(null);
  const [txType, setTxType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [txAccountId, setTxAccountId] = useState<number>(accounts[0]?.id || 0);
  const [txDestAccountId, setTxDestAccountId] = useState<number>(accounts[1]?.id || 0);
  const [txCategoryId, setTxCategoryId] = useState<number | ''>(
    categories.find((c) => c.categoryType === 'expense')?.id || ''
  );
  const [txAmount, setTxAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState('2026-10-28');
  const [txNotes, setTxNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(null);

  // CSV Import State
  const [isCsvPanelOpen, setIsCsvPanelOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvValidation, setCsvValidation] = useState<CsvValidationResult | null>(null);
  const [csvImportSuccess, setCsvImportSuccess] = useState<string | null>(null);

  const openCreateForm = () => {
    setEditingTx(null);
    setTxType('expense');
    setTxAccountId(accounts[0]?.id || 0);
    setTxDestAccountId(accounts[1]?.id || accounts[0]?.id || 0);
    const defaultExpCat = categories.find((c) => c.categoryType === 'expense');
    setTxCategoryId(defaultExpCat ? defaultExpCat.id : '');
    setTxAmount('');
    setTxDescription('');
    setTxDate('2026-10-28');
    setTxNotes('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (tx: TransactionRecord) => {
    setEditingTx(tx);
    setTxType(tx.transactionType);
    setTxAccountId(tx.accountId);
    setTxDestAccountId(tx.destinationAccountId || accounts[1]?.id || 0);
    setTxCategoryId(tx.categoryId || '');
    setTxAmount(tx.amount);
    setTxDescription(tx.description);
    setTxDate(tx.transactionDate);
    setTxNotes(tx.notes || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        accountId: Number(txAccountId || accounts[0]?.id),
        destinationAccountId:
          txType === 'transfer' ? Number(txDestAccountId) : null,
        categoryId:
          txType !== 'transfer' && txCategoryId ? Number(txCategoryId) : null,
        transactionType: txType,
        amount: txAmount,
        description: txDescription,
        transactionDate: txDate,
        notes: txNotes,
      };
      if (editingTx) {
        await onUpdateTransaction(editingTx.id, payload);
      } else {
        await onCreateTransaction(payload);
      }
      setIsFormOpen(false);
      if (onClearInitialModal) onClearInitialModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (typeFilter !== 'all' && tx.transactionType !== typeFilter) return false;
        if (accountFilter !== 'all' && tx.accountId !== Number(accountFilter)) return false;
        if (categoryFilter !== 'all' && tx.categoryId !== Number(categoryFilter)) return false;
        if (startDate && tx.transactionDate < startDate) return false;
        if (endDate && tx.transactionDate > endDate) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const matchNotes = (tx.notes || '').toLowerCase().includes(q);
          const matchAmt = tx.amount.includes(q);
          if (!matchDesc && !matchNotes && !matchAmt) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return b.transactionDate.localeCompare(a.transactionDate) || b.id - a.id;
        }
        if (sortBy === 'date-asc') {
          return a.transactionDate.localeCompare(b.transactionDate) || a.id - b.id;
        }
        if (sortBy === 'amount-desc') {
          return toCents(b.amount) - toCents(a.amount);
        }
        return toCents(a.amount) - toCents(b.amount);
      });
  }, [
    transactions,
    typeFilter,
    accountFilter,
    categoryFilter,
    startDate,
    endDate,
    searchQuery,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const handleExportCsv = () => {
    const csv = generateTransactionsCsv(filteredTransactions, accounts, categories);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `smartspend-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadSampleCsv = () => {
    const primaryAccName = accounts[0]?.name || 'Chase Premier Checking';
    const sample = [
      'date,description,type,amount,account,category,notes',
      `2026-10-26,Stripe Client Advisory Payout,income,850.00,${primaryAccName},Consulting & Freelance,Valid row 1`,
      `2026-10-27,Whole Foods Organic Market,expense,94.60,${primaryAccName},Groceries & Dining,Valid row 2`,
      `2026-10-08,Trader Joes & FreshDirect [Demo],expense,538.40,${primaryAccName},Groceries & Dining,Duplicate of existing record`,
      `2026-02-30,Malformed Calendar Date Entry,expense,45.00,${primaryAccName},Groceries & Dining,Invalid Feb 30 date`,
      `2026-10-27,Negative Amount Test Row,expense,-120.00,${primaryAccName},Groceries & Dining,Invalid negative amount`,
    ].join('\n');
    setCsvText(sample);
    const result = validateAndParseTransactionsCsv(
      sample,
      transactions,
      accounts,
      categories
    );
    setCsvValidation(result);
    setCsvImportSuccess(null);
  };

  const handleValidateCsv = () => {
    const result = validateAndParseTransactionsCsv(
      csvText,
      transactions,
      accounts,
      categories
    );
    setCsvValidation(result);
    setCsvImportSuccess(null);
  };

  const handleCommitCsvImport = async () => {
    if (!csvValidation || csvValidation.validRows.length === 0) return;
    await onImportTransactions(csvValidation.validRows);
    setCsvImportSuccess(
      `Imported ${csvValidation.validRows.length} validated transaction(s) into PostgreSQL.`
    );
    setCsvValidation(null);
    setCsvText('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Transactions Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, filter, sort, and manage income, expenses, transfers, and CSV batches
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCsvPanelOpen(!isCsvPanelOpen)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>CSV Import / Validate</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Transaction</span>
          </button>
        </div>
      </div>

      {/* Create / Edit Transaction Drawer Panel */}
      {isFormOpen && (
        <div className="bg-white border border-slate-300 rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              {editingTx ? `Edit Transaction #${editingTx.id}` : 'Record New Transaction'}
            </h2>
            <button
              type="button"
              aria-label="Close transaction form"
              onClick={() => setIsFormOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleSaveTransaction} className="space-y-4">
            {/* Quick Segmented Amount Type Switcher */}
            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Amount Type
              </span>
              <div
                role="group"
                aria-label="Select amount type"
                className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
              >
                {[
                  { id: 'expense', label: 'Expense (-)' },
                  { id: 'income', label: 'Income (+)' },
                  { id: 'transfer', label: 'Transfer (⇄)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      const nextType = opt.id as 'income' | 'expense' | 'transfer';
                      setTxType(nextType);
                      if (nextType !== 'transfer') {
                        const matchingCat = categories.find(
                          (c) => c.categoryType === nextType
                        );
                        setTxCategoryId(matchingCat ? matchingCat.id : '');
                      }
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      txType === opt.id
                        ? opt.id === 'income'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : opt.id === 'expense'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="tx-type"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Amount Type
                </label>
                <select
                  id="tx-type"
                  value={txType}
                  onChange={(e) => {
                    const nextType = e.target.value as 'income' | 'expense' | 'transfer';
                    setTxType(nextType);
                    if (nextType !== 'transfer') {
                      const matchingCat = categories.find((c) => c.categoryType === nextType);
                      setTxCategoryId(matchingCat ? matchingCat.id : '');
                    }
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="expense">Expense (- Outflow)</option>
                  <option value="income">Income (+ Inflow)</option>
                  <option value="transfer">Transfer (⇄ Inter-Account)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="tx-amount"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Amount
                  </label>
                  {onChangeCurrency && (
                    <select
                      aria-label="Change amount currency unit"
                      value={currency}
                      onChange={(e) => onChangeCurrency(e.target.value)}
                      className="text-xs font-mono font-semibold text-emerald-700 bg-transparent border-none focus:outline-none cursor-pointer"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                      <option value="JPY">JPY (¥)</option>
                    </select>
                  )}
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    aria-label="Cycle amount sign type"
                    onClick={() => {
                      const nextType =
                        txType === 'expense'
                          ? 'income'
                          : txType === 'income'
                            ? 'transfer'
                            : 'expense';
                      setTxType(nextType);
                      if (nextType !== 'transfer') {
                        const matchingCat = categories.find(
                          (c) => c.categoryType === nextType
                        );
                        setTxCategoryId(matchingCat ? matchingCat.id : '');
                      }
                    }}
                    className={`px-2.5 py-2 text-xs font-mono font-bold border border-r-0 border-slate-300 rounded-l-lg cursor-pointer ${
                      txType === 'income'
                        ? 'bg-emerald-50 text-emerald-700'
                        : txType === 'transfer'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {txType === 'income' ? '+' : txType === 'expense' ? '-' : '⇄'}
                  </button>
                  <input
                    id="tx-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-r-lg"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="tx-date"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Date
                </label>
                <input
                  id="tx-date"
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="tx-account"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {txType === 'transfer' ? 'Source Account' : 'Account'}
                </label>
                <select
                  id="tx-account"
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.accountType})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {txType === 'transfer' ? (
                <div>
                  <label
                    htmlFor="tx-dest-account"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Destination Account
                  </label>
                  <select
                    id="tx-dest-account"
                    value={txDestAccountId}
                    onChange={(e) => setTxDestAccountId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.accountType})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="tx-category"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="tx-category"
                    value={txCategoryId}
                    onChange={(e) =>
                      setTxCategoryId(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">Uncategorized</option>
                    {categories
                      .filter((c) => c.categoryType === txType)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="tx-description"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Description / Payee
                </label>
                <input
                  id="tx-description"
                  type="text"
                  required
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="e.g. Trader Joes Market"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="tx-notes"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Notes (Optional)
                </label>
                <input
                  id="tx-notes"
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Optional memo or invoice reference"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {editingTx ? 'Save Changes' : 'Save Transaction'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Validated CSV Import & Summary Panel */}
      {isCsvPanelOpen && (
        <div className="bg-white border border-slate-300 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Validated CSV Transaction Import
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Validates required columns (<code>date,description,type,amount,account,category,notes</code>),
                rejects malformed dates/amounts, and skips duplicate records.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close CSV import panel"
              onClick={() => setIsCsvPanelOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleLoadSampleCsv}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer"
            >
              Load Sample Test CSV (Valid + Duplicate + Malformed Rows)
            </button>
            <label className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer">
              <span>Upload .CSV File</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const content = String(ev.target?.result || '');
                    setCsvText(content);
                    setCsvValidation(
                      validateAndParseTransactionsCsv(
                        content,
                        transactions,
                        accounts,
                        categories
                      )
                    );
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>

          <div>
            <label
              htmlFor="csv-textarea"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              CSV Content
            </label>
            <textarea
              id="csv-textarea"
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="date,description,type,amount,account,category,notes&#10;2026-10-28,Monthly Salary,income,3500.00,Chase Premier Checking,Salary & Payroll,Oct pay"
              className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleValidateCsv}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              Validate CSV Records
            </button>

            {csvValidation && csvValidation.validRows.length > 0 && (
              <button
                type="button"
                onClick={handleCommitCsvImport}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
              >
                Commit {csvValidation.validRows.length} Valid Row(s) to Ledger
              </button>
            )}
          </div>

          {csvImportSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{csvImportSuccess}</span>
            </div>
          )}

          {csvValidation && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-6 font-mono tabular-nums">
                <span>
                  Header Check:{' '}
                  <strong
                    className={
                      csvValidation.validHeader ? 'text-emerald-700' : 'text-red-600'
                    }
                  >
                    {csvValidation.validHeader ? 'PASSED' : 'FAILED'}
                  </strong>
                </span>
                <span>Total Rows: {csvValidation.totalRows}</span>
                <span className="text-emerald-700 font-semibold">
                  Valid Ready: {csvValidation.validRows.length}
                </span>
                <span className="text-amber-700 font-semibold">
                  Duplicates Skipped: {csvValidation.duplicatesSkipped}
                </span>
                <span className="text-red-600 font-semibold">
                  Rejected Rows: {csvValidation.errors.length}
                </span>
              </div>

              {csvValidation.headerError && (
                <p className="text-red-600 font-medium">{csvValidation.headerError}</p>
              )}

              {csvValidation.errors.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-200">
                  <p className="font-semibold text-slate-700">Validation Diagnostics:</p>
                  {csvValidation.errors.map((err, idx) => (
                    <div key={idx} className="text-red-600 font-mono">
                      Line {err.line}: {err.message} ({err.raw})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Banner */}
      {deleteTarget && (
        <div
          role="alertdialog"
          aria-labelledby="delete-confirm-heading"
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 id="delete-confirm-heading" className="text-xs font-bold text-red-900">
                Confirm Transaction Deletion
              </h3>
              <p className="text-xs text-red-700 mt-0.5">
                Are you sure you want to permanently remove &ldquo;{deleteTarget.description}&rdquo; (
                {formatCurrency(deleteTarget.amount, currency)} on {deleteTarget.transactionDate})?
                Account balances and category budgets will recalculate immediately.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                await onDeleteTransaction(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}

      {/* Search & Multi-Criteria Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="search"
              aria-label="Search transactions by description or notes"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search payee, description, notes..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <select
              aria-label="Filter by transaction type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Types</option>
              <option value="expense">Expenses Only</option>
              <option value="income">Income Only</option>
              <option value="transfer">Transfers Only</option>
            </select>
          </div>

          <div>
            <select
              aria-label="Filter by account"
              value={accountFilter}
              onChange={(e) => {
                setAccountFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={String(acc.id)}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              aria-label="Sort transactions"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="date-desc">Date: Newest First</option>
              <option value="date-asc">Date: Oldest First</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-600">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-xs font-mono border border-slate-300 rounded-md"
              />
            </label>
            <label className="flex items-center gap-1.5 text-slate-600">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-xs font-mono border border-slate-300 rounded-md"
              />
            </label>
            {(searchQuery ||
              typeFilter !== 'all' ||
              accountFilter !== 'all' ||
              categoryFilter !== 'all' ||
              startDate ||
              endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setAccountFilter('all');
                  setCategoryFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
                className="text-emerald-700 font-medium hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          <span className="text-slate-500 font-mono tabular-nums">
            Showing {paginatedTransactions.length} of {filteredTransactions.length} matching
            records
          </span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700 mb-1">
              No transactions match your current filter criteria
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Try clearing your filters or record a new income, expense, or transfer entry.
            </p>
            <button
              type="button"
              onClick={openCreateForm}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg cursor-pointer"
            >
              Record Transaction
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">Description &amp; Notes</th>
                  <th className="py-3 px-4 font-semibold">Type · Category</th>
                  <th className="py-3 px-4 font-semibold">Account</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTransactions.map((tx) => {
                  const accName = accMap.get(tx.accountId) || 'Account';
                  const destName = tx.destinationAccountId
                    ? accMap.get(tx.destinationAccountId)
                    : null;
                  const catName =
                    tx.transactionType === 'transfer'
                      ? `Transfer → ${destName || 'Account'}`
                      : tx.categoryId
                        ? catMap.get(tx.categoryId) || 'Uncategorized'
                        : 'Uncategorized';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {tx.transactionDate}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{tx.description}</div>
                        {tx.notes && (
                          <div className="text-slate-500 mt-0.5">{tx.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`Change amount type for ${tx.description}`}
                            value={tx.transactionType}
                            onChange={async (e) => {
                              const newType = e.target.value as
                                | 'income'
                                | 'expense'
                                | 'transfer';
                              const fallbackDest =
                                newType === 'transfer'
                                  ? tx.destinationAccountId ||
                                    accounts.find((a) => a.id !== tx.accountId)?.id ||
                                    null
                                  : null;
                              const fallbackCat =
                                newType === 'transfer'
                                  ? null
                                  : categories.find((c) => c.categoryType === newType)
                                      ?.id || tx.categoryId || null;
                              await onUpdateTransaction(tx.id, {
                                accountId: tx.accountId,
                                destinationAccountId: fallbackDest,
                                categoryId: fallbackCat,
                                transactionType: newType,
                                amount: tx.amount,
                                description: tx.description,
                                transactionDate: tx.transactionDate,
                                notes: tx.notes || '',
                              });
                            }}
                            className={`px-2 py-1 text-xs font-semibold rounded-md border border-slate-200 bg-white cursor-pointer ${
                              tx.transactionType === 'income'
                                ? 'text-emerald-700'
                                : tx.transactionType === 'transfer'
                                  ? 'text-blue-700'
                                  : 'text-slate-800'
                            }`}
                          >
                            <option value="expense">Expense (-)</option>
                            <option value="income">Income (+)</option>
                            <option value="transfer">Transfer (⇄)</option>
                          </select>
                          <span>· {catName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {accName}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                          tx.transactionType === 'income'
                            ? 'text-emerald-700'
                            : tx.transactionType === 'transfer'
                              ? 'text-slate-600'
                              : 'text-slate-900'
                        }`}
                      >
                        {tx.transactionType === 'income'
                          ? '+'
                          : tx.transactionType === 'expense'
                            ? '-'
                            : '⇄ '}
                        {formatCurrency(tx.amount, currency)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Edit ${tx.description}`}
                            onClick={() => openEditForm(tx)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${tx.description}`}
                            onClick={() => setDeleteTarget(tx)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-mono tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 font-medium text-slate-700 bg-white border border-slate-300 rounded-md disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 font-medium text-slate-700 bg-white border border-slate-300 rounded-md disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
