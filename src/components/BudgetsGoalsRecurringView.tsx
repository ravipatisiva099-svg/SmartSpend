import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Target,
  Repeat,
  Play,
  Pause,
} from 'lucide-react';
import {
  AccountRecord,
  CategoryRecord,
  TransactionRecord,
  BudgetRecord,
  SavingsGoalRecord,
  RecurringRuleRecord,
  evaluateBudgetProgress,
  evaluateSavingsGoal,
  getDueRecurringRules,
  formatCurrency,
  fromCents,
} from '../utils/financeRules';

interface BudgetsGoalsRecurringViewProps {
  mode: 'budgets' | 'goals' | 'recurring';
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  transactions: TransactionRecord[];
  budgets: BudgetRecord[];
  savingsGoals: SavingsGoalRecord[];
  goalContributions: Array<{
    id: number;
    goalId: number;
    amount: string;
    contributionDate: string;
    note: string;
  }>;
  recurringRules: RecurringRuleRecord[];
  currency: string;
  onSaveBudget: (payload: {
    categoryId: number;
    month: string;
    amountLimit: string;
    alertThresholdPct: number;
  }) => Promise<void>;
  onDeleteBudget: (id: number) => Promise<void>;
  onCreateGoal: (payload: {
    name: string;
    targetAmount: string;
    currentAmount: string;
    targetDate: string;
    accountId?: number | null;
    color: string;
  }) => Promise<void>;
  onContributeGoal: (
    goalId: number,
    payload: { amount: string; contributionDate: string; note: string }
  ) => Promise<void>;
  onDeleteGoal: (id: number) => Promise<void>;
  onCreateRecurring: (payload: {
    accountId: number;
    categoryId?: number | null;
    transactionType: 'income' | 'expense';
    amount: string;
    description: string;
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    nextDueDate: string;
    reminderDaysBefore: number;
  }) => Promise<void>;
  onUpdateRecurring?: (
    id: number,
    payload: {
      transactionType?: 'income' | 'expense';
      amount?: string;
      description?: string;
      frequency?: string;
      nextDueDate?: string;
    }
  ) => Promise<void>;
  onToggleRecurring: (id: number, isActive: boolean) => Promise<void>;
  onDeleteRecurring: (id: number) => Promise<void>;
  onProcessDueRecurring: (asOfDate: string) => Promise<{ processedCount: number }>;
}

export const BudgetsGoalsRecurringView: React.FC<BudgetsGoalsRecurringViewProps> = ({
  mode,
  accounts,
  categories,
  transactions,
  budgets,
  savingsGoals,
  goalContributions,
  recurringRules,
  currency,
  onSaveBudget,
  onDeleteBudget,
  onCreateGoal,
  onContributeGoal,
  onDeleteGoal,
  onCreateRecurring,
  onUpdateRecurring,
  onToggleRecurring,
  onDeleteRecurring,
  onProcessDueRecurring,
}) => {
  const expenseCategories = categories.filter((c) => c.categoryType === 'expense');

  // Budget Form State
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState('2026-10');
  const [budgetCatId, setBudgetCatId] = useState<number>(expenseCategories[0]?.id || 0);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [budgetThreshold, setBudgetThreshold] = useState(80);

  // Goal Form State
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0.00');
  const [goalDate, setGoalDate] = useState('2027-06-30');
  const [goalAccountId, setGoalAccountId] = useState<number | ''>(accounts[0]?.id || '');
  const [activeContributeGoalId, setActiveContributeGoalId] = useState<number | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribNote, setContribNote] = useState('');

  // Recurring Form State
  const [recDesc, setRecDesc] = useState('');
  const [recType, setRecType] = useState<'income' | 'expense'>('expense');
  const [recAmount, setRecAmount] = useState('');
  const [recFreq, setRecFreq] = useState<
    'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  >('monthly');
  const [recDueDate, setRecDueDate] = useState('2026-10-28');
  const [recAccountId, setRecAccountId] = useState<number>(accounts[0]?.id || 0);
  const [recCatId, setRecCatId] = useState<number | ''>(expenseCategories[0]?.id || '');
  const [recReminderDays, setRecReminderDays] = useState(3);
  const [processFeedback, setProcessFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (mode === 'budgets') {
    const evaluations = evaluateBudgetProgress(
      budgets,
      transactions,
      categories,
      selectedBudgetMonth
    );

    const totalBudgetLimitCents = evaluations.reduce((acc, b) => acc + b.limitCents, 0);
    const totalBudgetSpentCents = evaluations.reduce((acc, b) => acc + b.spentCents, 0);

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Monthly Category Budgets</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Total Allocated ({selectedBudgetMonth}):{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatCurrency(fromCents(totalBudgetLimitCents), currency)}
              </strong>{' '}
              · Total Spent:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {formatCurrency(fromCents(totalBudgetSpentCents), currency)}
              </strong>
            </p>
          </div>

          <div
            role="group"
            aria-label="Select budget month"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {['2026-10', '2026-09', '2026-08'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedBudgetMonth(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  selectedBudgetMonth === m
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Set / Update Budget Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">
            Set or Update Monthly Category Budget ({selectedBudgetMonth})
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrorMsg(null);
              try {
                await onSaveBudget({
                  categoryId: Number(budgetCatId || expenseCategories[0]?.id),
                  month: selectedBudgetMonth,
                  amountLimit: budgetLimit,
                  alertThresholdPct: Number(budgetThreshold),
                });
                setBudgetLimit('');
              } catch (err: any) {
                setErrorMsg(err.message);
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
          >
            <div>
              <label
                htmlFor="budget-category"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Expense Category
              </label>
              <select
                id="budget-category"
                value={budgetCatId}
                onChange={(e) => setBudgetCatId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="budget-limit"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Monthly Limit ({currency})
              </label>
              <input
                id="budget-limit"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                placeholder="600.00"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="budget-threshold"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Warning Threshold (%)
              </label>
              <input
                id="budget-threshold"
                type="number"
                min="10"
                max="100"
                required
                value={budgetThreshold}
                onChange={(e) => setBudgetThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
            >
              Save Monthly Budget
            </button>
          </form>
        </div>

        {/* Budget Cards */}
        {evaluations.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <p className="text-sm font-medium text-slate-700 mb-1">
              No budgets configured for {selectedBudgetMonth}
            </p>
            <p className="text-xs text-slate-500">
              Use the form above to assign monthly spending limits per expense category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evaluations.map((b) => (
              <div
                key={b.budgetId}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {b.status === 'exceeded' && (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      {b.status === 'warning' && (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      {b.status === 'healthy' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <h3 className="text-sm font-bold text-slate-900">{b.categoryName}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {b.status === 'exceeded'
                        ? `Over budget by ${formatCurrency(fromCents(Math.abs(b.remainingCents)), currency)}`
                        : b.status === 'warning'
                          ? `Approaching limit (>=${b.alertThresholdPct}% threshold) · ${formatCurrency(b.remaining, currency)} left`
                          : `On track · ${formatCurrency(b.remaining, currency)} remaining`}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={`Delete budget for ${b.categoryName}`}
                    onClick={() => onDeleteBudget(b.budgetId)}
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="w-full h-2.5 bg-slate-100 rounded-sm overflow-hidden">
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

                <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600">
                  <span>Spent: {formatCurrency(b.spent, currency)}</span>
                  <span>
                    {b.percentage}% of {formatCurrency(b.limit, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'goals') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h1 className="text-xl font-bold text-slate-900">Savings Goals &amp; Milestones</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track dedicated target amounts, deadlines, and contribution history
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Create Savings Goal Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Create New Savings Goal</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrorMsg(null);
              try {
                await onCreateGoal({
                  name: goalName,
                  targetAmount: goalTarget,
                  currentAmount: goalCurrent,
                  targetDate: goalDate,
                  accountId: goalAccountId ? Number(goalAccountId) : null,
                  color: '#059669',
                });
                setGoalName('');
                setGoalTarget('');
                setGoalCurrent('0.00');
              } catch (err: any) {
                setErrorMsg(err.message);
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
          >
            <div>
              <label
                htmlFor="goal-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Goal Name
              </label>
              <input
                id="goal-name"
                type="text"
                required
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="e.g. Home Down Payment"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="goal-target"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Target Amount ({currency})
              </label>
              <input
                id="goal-target"
                type="number"
                step="0.01"
                min="1"
                required
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                placeholder="10000.00"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="goal-current"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Initial Saved ({currency})
              </label>
              <input
                id="goal-current"
                type="number"
                step="0.01"
                min="0"
                required
                value={goalCurrent}
                onChange={(e) => setGoalCurrent(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="goal-date"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Target Date
              </label>
              <input
                id="goal-date"
                type="date"
                required
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
            >
              Create Savings Goal
            </button>
          </form>
        </div>

        {/* Goals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {savingsGoals.map((goal) => {
            const evalInfo = evaluateSavingsGoal(goal, '2026-10-28');
            const isContributing = activeContributeGoalId === goal.id;

            return (
              <div
                key={goal.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-600 shrink-0" />
                        <h3 className="text-sm font-bold text-slate-900">{goal.name}</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                        Target Date: {goal.targetDate} ·{' '}
                        {evalInfo.isCompleted
                          ? 'Completed (100%)'
                          : `${evalInfo.daysRemaining} days left`}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete savings goal ${goal.name}`}
                      onClick={() => onDeleteGoal(goal.id)}
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between font-mono tabular-nums text-xs mb-1.5">
                      <span className="text-base font-bold text-slate-900">
                        {formatCurrency(goal.currentAmount, currency)}
                      </span>
                      <span className="text-slate-500">
                        of {formatCurrency(goal.targetAmount, currency)} ({evalInfo.progressPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-sm"
                        style={{ width: `${Math.max(3, evalInfo.progressPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {isContributing ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await onContributeGoal(goal.id, {
                        amount: contribAmount,
                        contributionDate: '2026-10-28',
                        note: contribNote,
                      });
                      setContribAmount('');
                      setContribNote('');
                      setActiveContributeGoalId(null);
                    }}
                    className="pt-3 border-t border-slate-100 space-y-2"
                  >
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      aria-label={`Contribution amount for ${goal.name}`}
                      value={contribAmount}
                      onChange={(e) => setContribAmount(e.target.value)}
                      placeholder="Contribution amount ($)"
                      className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-md"
                    />
                    <input
                      type="text"
                      aria-label={`Contribution note for ${goal.name}`}
                      value={contribNote}
                      onChange={(e) => setContribNote(e.target.value)}
                      placeholder="Optional note"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="flex-1 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-md cursor-pointer"
                      >
                        Record Contribution
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveContributeGoalId(null)}
                        className="px-2.5 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-md cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono tabular-nums">
                      Remaining: {formatCurrency(fromCents(evalInfo.remainingCents), currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveContributeGoalId(goal.id)}
                      className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      + Add Contribution
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Recent Contributions Ledger */}
        {goalContributions.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Recent Goal Contributions
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Date</th>
                    <th className="py-2 font-semibold">Goal</th>
                    <th className="py-2 font-semibold">Note</th>
                    <th className="py-2 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {goalContributions.map((c) => {
                    const goalObj = savingsGoals.find((g) => g.id === c.goalId);
                    return (
                      <tr key={c.id}>
                        <td className="py-2.5 font-mono tabular-nums text-slate-500">
                          {c.contributionDate}
                        </td>
                        <td className="py-2.5 font-medium text-slate-900">
                          {goalObj ? goalObj.name : `Goal #${c.goalId}`}
                        </td>
                        <td className="py-2.5 text-slate-500">{c.note || '—'}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                          +{formatCurrency(c.amount, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RECURRING TRANSACTIONS VIEW
  const dueNow = getDueRecurringRules(recurringRules, '2026-10-28');

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Recurring Transactions &amp; Rules
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Idempotent recurrence processor · Due rules as of 2026-10-28:{' '}
            <strong className="font-mono tabular-nums text-slate-900">
              {dueNow.length}
            </strong>
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            setErrorMsg(null);
            try {
              const res = await onProcessDueRecurring('2026-10-28');
              setProcessFeedback(
                res.processedCount > 0
                  ? `Idempotent processor generated ${res.processedCount} due transaction(s) and advanced their next due dates.`
                  : 'All active recurring rules are already up to date for 2026-10-28 (0 duplicates generated).'
              );
            } catch (err: any) {
              setErrorMsg(err.message);
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Process Due Rules Now ({dueNow.length} Due)</span>
        </button>
      </div>

      {processFeedback && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{processFeedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Create Recurring Rule Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-900 mb-3">
          Create Recurring Transaction Rule
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErrorMsg(null);
            try {
              await onCreateRecurring({
                accountId: Number(recAccountId || accounts[0]?.id),
                categoryId: recCatId ? Number(recCatId) : null,
                transactionType: recType,
                amount: recAmount,
                description: recDesc,
                frequency: recFreq,
                nextDueDate: recDueDate,
                reminderDaysBefore: Number(recReminderDays),
              });
              setRecDesc('');
              setRecAmount('');
            } catch (err: any) {
              setErrorMsg(err.message);
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end"
        >
          <div className="lg:col-span-2">
            <label
              htmlFor="rec-desc"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Rule Description
            </label>
            <input
              id="rec-desc"
              type="text"
              required
              value={recDesc}
              onChange={(e) => setRecDesc(e.target.value)}
              placeholder="e.g. Cloud Backup Subscription"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label
              htmlFor="rec-type"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Type
            </label>
            <select
              id="rec-type"
              value={recType}
              onChange={(e) => setRecType(e.target.value as 'income' | 'expense')}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="rec-amount"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Amount ({currency})
            </label>
            <input
              id="rec-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={recAmount}
              onChange={(e) => setRecAmount(e.target.value)}
              placeholder="29.99"
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label
              htmlFor="rec-freq"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Frequency
            </label>
            <select
              id="rec-freq"
              value={recFreq}
              onChange={(e) => setRecFreq(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="rec-due"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Next Due Date
            </label>
            <input
              id="rec-due"
              type="date"
              required
              value={recDueDate}
              onChange={(e) => setRecDueDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div className="lg:col-span-6 flex items-center justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
            >
              Add Recurring Rule
            </button>
          </div>
        </form>
      </div>

      {/* Recurring Rules Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="py-3 px-4 font-semibold">Description</th>
                <th className="py-3 px-4 font-semibold">Frequency · Type</th>
                <th className="py-3 px-4 font-semibold">Next Due Date</th>
                <th className="py-3 px-4 font-semibold">Last Processed</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Amount</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recurringRules.map((rule) => {
                const isDue =
                  rule.isActive &&
                  rule.nextDueDate <= '2026-10-28' &&
                  rule.lastProcessedDate !== rule.nextDueDate;

                return (
                  <tr key={rule.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {rule.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600 capitalize">
                      <div className="flex items-center gap-1.5">
                        <span>{rule.frequency} ·</span>
                        <select
                          aria-label={`Change amount type for ${rule.description}`}
                          value={rule.transactionType}
                          onChange={(e) => {
                            if (onUpdateRecurring) {
                              onUpdateRecurring(rule.id, {
                                transactionType: e.target.value as 'income' | 'expense',
                              });
                            }
                          }}
                          className={`px-2 py-0.5 text-xs font-semibold rounded border border-slate-200 bg-white cursor-pointer ${
                            rule.transactionType === 'income'
                              ? 'text-emerald-700'
                              : 'text-slate-800'
                          }`}
                        >
                          <option value="expense">Expense (-)</option>
                          <option value="income">Income (+)</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-800">
                      {rule.nextDueDate}
                      {isDue && (
                        <span className="ml-2 text-amber-700 font-semibold">
                          (Due Now)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                      {rule.lastProcessedDate || 'Never'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {rule.isActive ? 'Active' : 'Paused'} · Reminder {rule.reminderDaysBefore}d
                      prior
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                        rule.transactionType === 'income'
                          ? 'text-emerald-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {rule.transactionType === 'income' ? '+' : '-'}
                      {formatCurrency(rule.amount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`${rule.isActive ? 'Pause' : 'Resume'} ${rule.description}`}
                          onClick={() => onToggleRecurring(rule.id, !rule.isActive)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 cursor-pointer"
                        >
                          {rule.isActive ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete recurring rule ${rule.description}`}
                          onClick={() => onDeleteRecurring(rule.id)}
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
      </div>
    </div>
  );
};
