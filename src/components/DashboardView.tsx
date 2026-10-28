import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Plus,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import {
  AccountRecord,
  CategoryRecord,
  TransactionRecord,
  BudgetRecord,
  SavingsGoalRecord,
  calculateAccountBalances,
  calculateCashFlowSummary,
  calculateCategoryBreakdown,
  evaluateBudgetProgress,
  formatCurrency,
} from '../utils/financeRules';

interface DashboardViewProps {
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  transactions: TransactionRecord[];
  budgets: BudgetRecord[];
  savingsGoals: SavingsGoalRecord[];
  currency: string;
  onNavigate: (page: string) => void;
  onOpenNewTransaction: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  accounts,
  categories,
  transactions,
  budgets,
  Currency: _unused,
  currency,
  onNavigate,
  onOpenNewTransaction,
}: DashboardViewProps & { Currency?: string }) => {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [showAccessibleChartTable, setShowAccessibleChartTable] = useState(false);

  const balances = calculateAccountBalances(accounts, transactions);
  const currentCashFlow = calculateCashFlowSummary(
    transactions,
    selectedMonth === 'all' ? undefined : selectedMonth
  );
  const prevMonth =
    selectedMonth === '2026-10'
      ? '2026-09'
      : selectedMonth === '2026-09'
        ? '2026-08'
        : '2026-09';
  const prevCashFlow = calculateCashFlowSummary(transactions, prevMonth);

  const categoryBreakdown = calculateCategoryBreakdown(
    transactions,
    categories,
    'expense',
    selectedMonth === 'all' ? undefined : selectedMonth
  );

  const budgetEvaluations = evaluateBudgetProgress(
    budgets,
    transactions,
    categories,
    selectedMonth === 'all' ? '2026-10' : selectedMonth
  );

  const monthsForChart = ['2026-08', '2026-09', '2026-10'];
  const monthlySeries = monthsForChart.map((m) => {
    const cf = calculateCashFlowSummary(transactions, m);
    return {
      month: m,
      label:
        m === '2026-08' ? 'Aug 2026' : m === '2026-09' ? 'Sep 2026' : 'Oct 2026',
      incomeCents: cf.incomeCents,
      expenseCents: cf.expenseCents,
      netCents: cf.netSavingsCents,
      income: cf.income,
      expense: cf.expense,
      net: cf.netSavings,
    };
  });

  const maxChartCents = Math.max(
    100000,
    ...monthlySeries.flatMap((s) => [s.incomeCents, s.expenseCents])
  );

  const recentTransactions = transactions.slice(0, 7);
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const incomeDeltaPct =
    prevCashFlow.incomeCents > 0
      ? Math.round(
          ((currentCashFlow.incomeCents - prevCashFlow.incomeCents) /
            prevCashFlow.incomeCents) *
            1000
        ) / 10
      : 0;

  const expenseDeltaPct =
    prevCashFlow.expenseCents > 0
      ? Math.round(
          ((currentCashFlow.expenseCents - prevCashFlow.expenseCents) /
            prevCashFlow.expenseCents) *
            1000
        ) / 10
      : 0;

  return (
    <div className="space-y-6">
      {/* Header Toolbar & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Financial Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            All metrics calculated from live PostgreSQL ledger records · Transfers excluded from
            cash flow
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Filter dashboard period"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {[
              { id: '2026-10', label: 'Oct 2026' },
              { id: '2026-09', label: 'Sep 2026' },
              { id: '2026-08', label: 'Aug 2026' },
              { id: 'all', label: 'All Time' },
            ].map((period) => (
              <button
                key={period.id}
                type="button"
                onClick={() => setSelectedMonth(period.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedMonth === period.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Total Account Balance</span>
            <span className="font-mono tabular-nums">
              {accounts.filter((a) => !a.isArchived).length} active accounts
            </span>
          </div>
          <p
            data-testid="kpi-total-balance"
            className="text-2xl font-bold text-slate-900 font-mono tabular-nums"
          >
            {formatCurrency(balances.totalBalance, currency)}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Includes Bank, Cash &amp; Digital Wallet balances
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Period Income</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <p
            data-testid="kpi-period-income"
            className="text-2xl font-bold text-emerald-700 font-mono tabular-nums"
          >
            {formatCurrency(currentCashFlow.income, currency)}
          </p>
          <p className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
            {selectedMonth !== 'all'
              ? `${incomeDeltaPct >= 0 ? '+' : ''}${incomeDeltaPct}% vs ${prevMonth}`
              : 'Cumulative verified inflows'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Period Expenses</span>
            <ArrowDownRight className="w-4 h-4 text-red-600" />
          </div>
          <p
            data-testid="kpi-period-expense"
            className="text-2xl font-bold text-slate-900 font-mono tabular-nums"
          >
            {formatCurrency(currentCashFlow.expense, currency)}
          </p>
          <p className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
            {selectedMonth !== 'all'
              ? `${expenseDeltaPct >= 0 ? '+' : ''}${expenseDeltaPct}% vs ${prevMonth}`
              : 'Cumulative verified outflows'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Net Cash Flow &amp; Savings</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p
            data-testid="kpi-net-savings"
            className={`text-2xl font-bold font-mono tabular-nums ${
              currentCashFlow.netSavingsCents >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatCurrency(currentCashFlow.netSavings, currency)}
          </p>
          <p className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
            Savings Rate: {currentCashFlow.savingsRatePct}% of income
          </p>
        </div>
      </div>

      {/* Middle Row: Monthly Cash Flow Chart + Category Spending Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Monthly Cash Flow Comparison
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Income vs. Expenses · Aug 2026 – Oct 2026
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAccessibleChartTable(!showAccessibleChartTable)}
              className="text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showAccessibleChartTable ? 'Show Visual Chart' : 'Accessible Table View'}
            </button>
          </div>

          {!showAccessibleChartTable ? (
            <div className="space-y-5">
              {monthlySeries.map((item) => {
                const incWidth = Math.min(
                  100,
                  Math.round((item.incomeCents / maxChartCents) * 100)
                );
                const expWidth = Math.min(
                  100,
                  Math.round((item.expenseCents / maxChartCents) * 100)
                );
                return (
                  <div key={item.month} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{item.label}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        Income: {formatCurrency(item.income, currency)} · Expense:{' '}
                        {formatCurrency(item.expense, currency)} · Net:{' '}
                        <strong className="text-emerald-700">
                          {formatCurrency(item.net, currency)}
                        </strong>
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-xs text-slate-500">Income</span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-sm"
                            style={{ width: `${Math.max(4, incWidth)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-xs text-slate-500">Expense</span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden">
                          <div
                            className="h-full bg-slate-700 rounded-sm"
                            style={{ width: `${Math.max(4, expWidth)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Month</th>
                    <th className="py-2 font-semibold text-right">Income</th>
                    <th className="py-2 font-semibold text-right">Expenses</th>
                    <th className="py-2 font-semibold text-right">Net Cash Flow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlySeries.map((item) => (
                    <tr key={item.month}>
                      <td className="py-2.5 font-medium text-slate-800">{item.label}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-emerald-700">
                        {formatCurrency(item.income, currency)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-800">
                        {formatCurrency(item.expense, currency)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {formatCurrency(item.net, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Category Spending Breakdown */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Category Spending</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedMonth === 'all' ? 'All Time' : selectedMonth} Expense Distribution
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
            >
              Full Analytics →
            </button>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500 mb-3">
                No expenses recorded for this period.
              </p>
              <button
                type="button"
                onClick={onOpenNewTransaction}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer"
              >
                Log First Expense
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {categoryBreakdown.slice(0, 6).map((cat) => (
                <div key={cat.categoryName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{cat.categoryName}</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {formatCurrency(cat.amount, currency)} · {cat.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${Math.max(3, cat.percentage)}%`,
                        backgroundColor: cat.color || '#059669',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Budget Progress + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Budget Progress */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Monthly Budget Status</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Threshold monitoring for {selectedMonth === 'all' ? '2026-10' : selectedMonth}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
            >
              Manage Budgets →
            </button>
          </div>

          {budgetEvaluations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-500 mb-3">
                No category budgets configured for this month.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('budgets')}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg cursor-pointer"
              >
                Configure Monthly Budgets
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {budgetEvaluations.map((b) => (
                <div key={b.budgetId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {b.status === 'exceeded' && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      )}
                      {b.status === 'warning' && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                      {b.status === 'healthy' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span className="font-medium text-slate-800">{b.categoryName}</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-600">
                      {formatCurrency(b.spent, currency)} / {formatCurrency(b.limit, currency)} (
                      {b.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className={`h-full rounded-sm ${
                        b.status === 'exceeded'
                          ? 'bg-red-600'
                          : b.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, b.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Ledger Activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest verified transactions across all accounts
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
            >
              View All ({transactions.length}) →
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-500">No transactions recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Date</th>
                    <th className="py-2 font-semibold">Description</th>
                    <th className="py-2 font-semibold">Account &amp; Category</th>
                    <th className="py-2 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.map((tx) => {
                    const accName = accMap.get(tx.accountId) || 'Account';
                    const destName = tx.destinationAccountId
                      ? accMap.get(tx.destinationAccountId)
                      : null;
                    const catName =
                      tx.transactionType === 'transfer'
                        ? `Transfer → ${destName || 'Destination'}`
                        : tx.categoryId
                          ? catMap.get(tx.categoryId) || 'Uncategorized'
                          : 'Uncategorized';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {tx.transactionDate}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-slate-900">
                          {tx.description}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-500">
                          {accName} · {catName}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
