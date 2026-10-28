import React, { useState, useMemo } from 'react';
import {
  Download,
  Bell,
  CheckCircle2,
  Shield,
  Terminal,
  Copy,
  Check,
  AlertOctagon,
  FileCode2,
  RefreshCw,
} from 'lucide-react';
import {
  AccountRecord,
  CategoryRecord,
  TransactionRecord,
  calculateCashFlowSummary,
  calculateCategoryBreakdown,
  formatCurrency,
} from '../utils/financeRules';
import { DJANGO_SOURCE_FILES } from '../data/djangoSourceReference';

export type ExtendedViewMode =
  | 'reports'
  | 'notifications'
  | 'profile'
  | 'preferences'
  | 'security'
  | 'help'
  | 'error-403'
  | 'error-404'
  | 'error-500';

interface ReportsSettingsHelpViewProps {
  mode: ExtendedViewMode;
  profile: {
    id: number;
    uid: string;
    email: string;
    fullName: string;
    currency: string;
    timezone: string;
    dateFormat: string;
    emailAlerts: boolean;
    budgetThresholdPct: number;
    twoFactorEnabled: boolean;
  };
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  transactions: TransactionRecord[];
  notifications: Array<{
    id: number;
    title: string;
    message: string;
    notificationType: string;
    isRead: boolean;
    createdAt: string;
  }>;
  auditEvents: Array<{
    id: number;
    action: string;
    entityType: string;
    entityId: string;
    details: string;
    createdAt: string;
  }>;
  onNavigate: (page: string) => void;
  onMarkNotificationRead: (id: number) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onUpdateProfile: (payload: Record<string, any>) => Promise<void>;
  onResetDemoData: () => Promise<void>;
}

export const ReportsSettingsHelpView: React.FC<ReportsSettingsHelpViewProps> = ({
  mode,
  profile,
  categories,
  transactions,
  notifications,
  auditEvents,
  onNavigate,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onUpdateProfile,
  onResetDemoData,
}) => {
  // Reports state
  const [reportScope, setReportScope] = useState<'2026-10' | '2026-09' | '2026-08' | '2026' | 'custom'>('2026');
  const [customFrom, setCustomFrom] = useState('2026-08-01');
  const [customTo, setCustomTo] = useState('2026-10-31');

  // Settings state
  const [fullName, setFullName] = useState(profile?.fullName || 'Alex Morgan');
  const [currency, setCurrency] = useState(profile?.currency || 'USD');
  const [timezone, setTimezone] = useState(profile?.timezone || 'America/New_York');
  const [dateFormat, setDateFormat] = useState(profile?.dateFormat || 'YYYY-MM-DD');
  const [emailAlerts, setEmailAlerts] = useState(Boolean(profile?.emailAlerts));
  const [budgetThresholdPct, setBudgetThresholdPct] = useState(
    profile?.budgetThresholdPct || 80
  );
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    Boolean(profile?.twoFactorEnabled)
  );
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Help / Django source viewer state
  const [selectedDjangoFile, setSelectedDjangoFile] = useState(
    DJANGO_SOURCE_FILES[0].path
  );
  const [copiedFile, setCopiedFile] = useState(false);

  const scopedTransactions = useMemo(() => {
    if (reportScope === 'custom') {
      return transactions.filter(
        (t) =>
          (!customFrom || t.transactionDate >= customFrom) &&
          (!customTo || t.transactionDate <= customTo)
      );
    }
    return transactions.filter((t) => t.transactionDate.startsWith(reportScope));
  }, [transactions, reportScope, customFrom, customTo]);

  if (mode === 'reports') {
    const summary = calculateCashFlowSummary(scopedTransactions);
    const expenseBreakdown = calculateCategoryBreakdown(
      scopedTransactions,
      categories,
      'expense'
    );
    const incomeBreakdown = calculateCategoryBreakdown(
      scopedTransactions,
      categories,
      'income'
    );

    const handleDownloadReportCsv = () => {
      const lines = [
        'section,category_or_metric,amount,percentage,transaction_count',
        `summary,Total Income,${summary.income},100%,`,
        `summary,Total Expenses,${summary.expense},100%,`,
        `summary,Net Savings,${summary.netSavings},${summary.savingsRatePct}%,`,
        ...expenseBreakdown.map(
          (c) =>
            `expense_category,"${c.categoryName}",${c.amount},${c.percentage}%,${c.transactionCount}`
        ),
        ...incomeBreakdown.map(
          (c) =>
            `income_category,"${c.categoryName}",${c.amount},${c.percentage}%,${c.transactionCount}`
        ),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `smartspend-report-${reportScope}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Financial Reports &amp; Analytics
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly and yearly cash flow analysis, category breakdowns, and CSV summaries
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Report period selector"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {[
                { id: '2026', label: 'Year 2026' },
                { id: '2026-10', label: 'Oct 2026' },
                { id: '2026-09', label: 'Sep 2026' },
                { id: '2026-08', label: 'Aug 2026' },
                { id: 'custom', label: 'Custom Range' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setReportScope(opt.id as any)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    reportScope === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDownloadReportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV Summary</span>
            </button>
          </div>
        </div>

        {reportScope === 'custom' && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2 font-medium text-slate-700">
              <span>Start Date:</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1.5 font-mono border border-slate-300 rounded-md"
              />
            </label>
            <label className="flex items-center gap-2 font-medium text-slate-700">
              <span>End Date:</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1.5 font-mono border border-slate-300 rounded-md"
              />
            </label>
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Report Period Inflows</p>
            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {formatCurrency(summary.income, profile.currency)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Report Period Outflows</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {formatCurrency(summary.expense, profile.currency)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">
              Net Cash Flow ({summary.savingsRatePct}% Savings Rate)
            </p>
            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {formatCurrency(summary.netSavings, profile.currency)}
            </p>
          </div>
        </div>

        {/* Expense & Income Category Breakdown Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Expense Breakdown by Category
            </h2>
            {expenseBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No expenses recorded in this date range.
              </p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Category</th>
                    <th className="py-2 font-semibold text-right">Tx Count</th>
                    <th className="py-2 font-semibold text-right">Share</th>
                    <th className="py-2 font-semibold text-right">Total Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseBreakdown.map((item) => (
                    <tr key={item.categoryName}>
                      <td className="py-2.5 font-medium text-slate-900">
                        {item.categoryName}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-500">
                        {item.transactionCount}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-600">
                        {item.percentage}%
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatCurrency(item.amount, profile.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Income Breakdown by Source Category
            </h2>
            {incomeBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No income recorded in this date range.
              </p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Category</th>
                    <th className="py-2 font-semibold text-right">Tx Count</th>
                    <th className="py-2 font-semibold text-right">Share</th>
                    <th className="py-2 font-semibold text-right">Total Income</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incomeBreakdown.map((item) => (
                    <tr key={item.categoryName}>
                      <td className="py-2.5 font-medium text-slate-900">
                        {item.categoryName}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-500">
                        {item.transactionCount}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-600">
                        {item.percentage}%
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {formatCurrency(item.amount, profile.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'notifications') {
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Notifications &amp; Alerts</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Budget threshold warnings, due recurring rules, and milestone updates ({unreadCount}{' '}
              unread)
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllNotificationsRead}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 cursor-pointer"
            >
              Mark All as Read
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No notifications in your inbox.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex items-start justify-between gap-4 ${
                  n.isRead ? 'bg-white' : 'bg-emerald-50/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Bell
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      n.isRead ? 'text-slate-400' : 'text-emerald-600'
                    }`}
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                    <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1.5 font-mono tabular-nums">
                      Type: {n.notificationType} · {n.isRead ? 'Read' : 'Unread'}
                    </p>
                  </div>
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => onMarkNotificationRead(n.id)}
                    className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shrink-0 cursor-pointer"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (mode === 'profile' || mode === 'preferences' || mode === 'security') {
    const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault();
      await onUpdateProfile({
        fullName,
        currency,
        timezone,
        dateFormat,
        emailAlerts,
        budgetThresholdPct,
        twoFactorEnabled,
      });
      setSaveBanner('Settings saved and synchronized with PostgreSQL.');
    };

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {mode === 'profile'
                ? 'User Profile & Workspace Data'
                : mode === 'preferences'
                  ? 'Application Preferences'
                  : 'Security Settings & Audit Trail'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Account Email: {profile?.email} · User ID: #{profile?.id}
            </p>
          </div>

          <div
            role="group"
            aria-label="Settings sections"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {[
              { id: 'profile', label: 'Profile' },
              { id: 'preferences', label: 'Preferences' },
              { id: 'security', label: 'Security & Audit' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSaveBanner(null);
                  onNavigate(tab.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                  mode === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {saveBanner && (
          <div
            role="status"
            className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveBanner}</span>
          </div>
        )}

        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          {mode === 'profile' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="prof-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="prof-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Verified Email Address
                </label>
                <input
                  id="prof-email"
                  type="email"
                  disabled
                  value={profile?.email || ''}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                />
              </div>
            </div>
          )}

          {mode === 'preferences' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="pref-currency"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Display Currency
                </label>
                <select
                  id="pref-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="pref-tz"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Time Zone
                </label>
                <select
                  id="pref-tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="pref-threshold"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Default Budget Warning (%)
                </label>
                <input
                  id="pref-threshold"
                  type="number"
                  min="50"
                  max="100"
                  value={budgetThresholdPct}
                  onChange={(e) => setBudgetThresholdPct(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Enable Budget &amp; Due Rule Email Alerts</span>
                </label>
              </div>
            </div>
          )}

          {mode === 'security' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Two-Factor Authentication (TOTP)
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Require a second verification step when signing in from unrecognized devices.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={twoFactorEnabled}
                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                  />
                  <span>{twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={async () => {
                await onResetDemoData();
                setSaveBanner('Reloaded clean SmartSpend demo fixtures into your workspace.');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset / Reload Demo Fixture Data</span>
            </button>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>

        {mode === 'security' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Security &amp; Ledger Audit Trail
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Action</th>
                    <th className="py-2 font-semibold">Entity</th>
                    <th className="py-2 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="py-2.5 font-mono font-semibold text-slate-800">
                        {ev.action}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {ev.entityType} #{ev.entityId}
                      </td>
                      <td className="py-2.5 text-slate-600">{ev.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ERROR PAGES (403, 404, 500)
  if (mode === 'error-403' || mode === 'error-404' || mode === 'error-500') {
    const code = mode === 'error-403' ? '403' : mode === 'error-404' ? '404' : '500';
    const title =
      code === '403'
        ? '403 Forbidden — Access Denied'
        : code === '404'
          ? '404 Not Found — Resource Unavailable'
          : '500 Internal Server Error — Ledger Service Fault';
    const description =
      code === '403'
        ? 'Row-level ownership rules prevent accessing financial records, accounts, or budgets belonging to another user.'
        : code === '404'
          ? 'The requested ledger record, transaction, or URL route could not be located in your SmartSpend workspace.'
          : 'An unexpected server error occurred while processing your request. Your PostgreSQL database transaction was safely rolled back.';

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto my-8">
        <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
          <AlertOctagon className="w-6 h-6 text-red-600" />
        </div>
        <p className="text-xs font-mono font-semibold text-red-600 mb-1">
          HTTP ERROR {code}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">{title}</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">{description}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
          >
            Return to Dashboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate('help')}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            Back to Help &amp; Diagnostics
          </button>
        </div>
      </div>
    );
  }

  // HELP, SETUP GUIDE & DJANGO SOURCE ARCHITECTURE VIEW
  const activeSourceObj =
    DJANGO_SOURCE_FILES.find((f) => f.path === selectedDjangoFile) ||
    DJANGO_SOURCE_FILES[0];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Help, PostgreSQL Setup &amp; Django Source Guide
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete setup instructions for Windows &amp; macOS/Linux, Django modular architecture
            files, and error page previews
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('error-403')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            Preview 403 Page
          </button>
          <button
            type="button"
            onClick={() => onNavigate('error-404')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            Preview 404 Page
          </button>
          <button
            type="button"
            onClick={() => onNavigate('error-500')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            Preview 500 Page
          </button>
        </div>
      </div>

      {/* Setup Commands Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Terminal className="w-4 h-4 text-emerald-600" />
            <span>macOS / Linux Setup &amp; Verification Commands</span>
          </div>
          <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto leading-relaxed">
{`# 1. Create PostgreSQL database and user
psql -U postgres -c "CREATE USER smartspend_user WITH PASSWORD 'StrongPassword123!';"
psql -U postgres -c "CREATE DATABASE smartspend_db OWNER smartspend_user;"

# 2. Virtualenv & Django dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Run migrations, system checks, demo fixtures & tests
cd smartspend_django
python manage.py makemigrations
python manage.py migrate
python manage.py check
python manage.py loaddata fixtures/demo_smartspend.json
python manage.py test
python manage.py runserver 8000`}
          </pre>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Terminal className="w-4 h-4 text-emerald-600" />
            <span>Windows (PowerShell) Setup &amp; Troubleshooting</span>
          </div>
          <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto leading-relaxed">
{`# 1. Create virtual environment in PowerShell
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt

# 2. Configure environment variables (.env)
$env:SQL_DB_NAME="smartspend_db"
$env:SQL_USER="smartspend_user"
$env:SQL_HOST="127.0.0.1"

# 3. Apply migrations & launch server
cd smartspend_django
python manage.py migrate
python manage.py test
python manage.py runserver 8000`}
          </pre>
        </div>
      </div>

      {/* Interactive Modular Django Source Inspector */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                Modular Django + PostgreSQL Source Code Inspector
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect the modular Django project files included in <code>/smartspend_django/</code>
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(activeSourceObj.content);
              setCopiedFile(true);
              setTimeout(() => setCopiedFile(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            {copiedFile ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Source File</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {DJANGO_SOURCE_FILES.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => setSelectedDjangoFile(file.path)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg border cursor-pointer ${
                selectedDjangoFile === file.path
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {file.path.replace('smartspend_django/', '')}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-600">{activeSourceObj.description}</p>

        <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto leading-relaxed max-h-96">
          {activeSourceObj.content}
        </pre>
      </div>
    </div>
  );
};
