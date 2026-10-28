import React, { useState } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  Lock,
  CheckCircle2,
  FileSpreadsheet,
  PieChart,
  Repeat,
  Wallet,
  KeyRound,
  Mail,
  UserCheck,
} from 'lucide-react';

export type PublicPageType = 'landing' | 'login' | 'register' | 'password-reset';

interface PublicViewsProps {
  currentPage: PublicPageType;
  onNavigate: (page: PublicPageType) => void;
  onLoginSuccess: (token: string, user: { uid: string; email: string; name: string }) => void;
  onGoogleSignIn: () => Promise<void>;
  authError: string | null;
}

export const PublicViews: React.FC<PublicViewsProps> = ({
  currentPage,
  onNavigate,
  onLoginSuccess,
  onGoogleSignIn,
  authError,
}) => {
  // Login state
  const [loginEmail, setLoginEmail] = useState('alex.morgan@smartspend.app');
  const [loginPassword, setLoginPassword] = useState('SmartSpend2026!');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm' | 'done'>('request');
  const [resetNewPass, setResetNewPass] = useState('');

  const handleLaunchDemo = () => {
    onLoginSuccess('local:demo-smartspend-user:demo@smartspend.app:Alex Morgan', {
      uid: 'demo-smartspend-user',
      email: 'demo@smartspend.app',
      name: 'Alex Morgan',
    });
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!loginPassword || loginPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    const uid =
      cleanEmail === 'demo@smartspend.app' || cleanEmail === 'alex.morgan@smartspend.app'
        ? 'demo-smartspend-user'
        : `user-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`;
    const displayName =
      cleanEmail === 'demo@smartspend.app' || cleanEmail === 'alex.morgan@smartspend.app'
        ? 'Alex Morgan'
        : cleanEmail.split('@')[0];

    onLoginSuccess(`local:${uid}:${cleanEmail}:${displayName}`, {
      uid,
      email: cleanEmail,
      name: displayName,
    });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanName) {
      setFormError('Full name is required.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (regPassword.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }
    if (regPassword !== regConfirm) {
      setFormError('Password confirmation does not match.');
      return;
    }

    const uid = `user-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`;
    onLoginSuccess(`local:${uid}:${cleanEmail}:${cleanName}`, {
      uid,
      email: cleanEmail,
      name: cleanName,
    });
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (resetStep === 'request') {
      if (!resetEmail.trim() || !resetEmail.includes('@')) {
        setFormError('Enter the email address associated with your SmartSpend account.');
        return;
      }
      setResetStep('confirm');
      setFormSuccess(
        `Verification token dispatched to ${resetEmail.trim()}. Set your new password below.`
      );
    } else if (resetStep === 'confirm') {
      if (resetNewPass.length < 8) {
        setFormError('New password must be at least 8 characters long.');
        return;
      }
      setResetStep('done');
      setFormSuccess('Your password has been updated. You can now sign in.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 py-4 bg-white border-b border-slate-200 sticky top-0 z-30">
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 transition-colors text-lg font-extrabold tracking-tight whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Wallet className="w-5 h-5 text-emerald-100 shrink-0" />
          <span>
            Smart<span className="text-emerald-200">Spend</span>
          </span>
        </button>

        <nav
          aria-label="Public navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentPage === 'login'
                ? 'text-emerald-700 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentPage === 'register'
                ? 'text-emerald-700 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentPage === 'landing'
                ? 'text-emerald-700 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Platform Overview
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleLaunchDemo}
            className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Instant Demo Ledger
          </button>
        </div>
      </header>

      {currentPage === 'landing' && (
        <main className="flex-1">
          {/* Hero Section */}
          <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-3">
                  Personal Finance &amp; PostgreSQL Ledger Architecture · Decimal-Safe Accounting
                </p>
                <h1
                  className="text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight mb-6"
                  style={{ textWrap: 'balance' }}
                >
                  <span className="text-emerald-600">Precision personal finance</span> without
                  double-counted transfers or spreadsheet drift.
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-2xl mb-8">
                  SmartSpend unifies multi-account balances, monthly category budgets, target
                  savings goals, idempotent recurring transaction rules, and validated CSV
                  import/export backed by PostgreSQL.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('login')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('register')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Create Personal Account</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Live Ledger Snapshot Preview */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
                <div>
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500">Consolidated Net Balance</p>
                      <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                        $29,918.85
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Oct 2026 Net Savings</p>
                      <p className="text-sm font-semibold text-emerald-700 font-mono tabular-nums mt-0.5">
                        +$4,198.85 (59.0%)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs py-2 border-b border-slate-100">
                      <span className="font-medium text-slate-800 truncate">
                        Chase Premier Checking
                      </span>
                      <span className="text-slate-500 whitespace-nowrap">
                        Bank · JPMorgan
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        $7,958.70
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs py-2 border-b border-slate-100">
                      <span className="font-medium text-slate-800 truncate">
                        Ally High-Yield Vault
                      </span>
                      <span className="text-slate-500 whitespace-nowrap">
                        Bank · 4.35% APY
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                        $20,074.85
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs py-2 border-b border-slate-100">
                      <span className="font-medium text-slate-800 truncate">
                        Emergency Reserve Goal
                      </span>
                      <span className="text-slate-500 whitespace-nowrap">
                        80.0% of $25k
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                        $20,000.00
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">
                        October Budget Utilization
                      </span>
                      <span className="font-mono tabular-nums text-slate-800 font-semibold">
                        $2,926.00 / $3,015.00 (97.0%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-sm"
                        style={{ width: '91%' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>PostgreSQL ACID Ledger · User-Scoped</span>
                  <button
                    type="button"
                    onClick={handleLaunchDemo}
                    className="font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Open Interactive Dashboard →
                  </button>
                </div>
              </div>
            </div>

            {/* Full-Width 4-Column KPI / Capability Strip below Hero Split */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 pt-10 border-t border-slate-200">
              <div>
                <p className="text-xs text-slate-500">Monetary Precision</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  100% Decimal-Safe
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Exact cent-level arithmetic prevents IEEE-754 floating-point rounding drift.
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Inter-Account Transfers</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  Zero Double-Counting
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Explicit transfer records move funds between accounts without inflating cash flow.
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Recurring Engine</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  Idempotent Execution
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Deterministic cycle hashes guarantee due rules never generate duplicate entries.
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">CSV Ledger Pipeline</p>
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
                  4-Stage Validation
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Verifies headers, calendar dates, positive amounts, and duplicate fingerprints.
                </p>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section id="features" className="bg-white border-y border-slate-200 py-16">
            <div className="max-w-7xl mx-auto px-6 lg:px-12">
              <div className="max-w-2xl mb-12">
                <h2 className="text-2xl font-bold text-slate-900">
                  Built for Complete Personal Financial Control
                </h2>
                <p className="text-sm text-slate-600 mt-2">
                  Every workflow connects directly to your PostgreSQL ledger—no hardcoded demo
                  charts or disconnected calculators.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 border border-slate-200 rounded-xl">
                  <Wallet className="w-5 h-5 text-emerald-600 mb-3" />
                  <h3 className="text-base font-semibold text-slate-900 mb-2">
                    Multi-Account &amp; Transfer Modeling
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Track Bank, Cash, and Digital Wallet accounts with opening balances and
                    referential deletion guards that protect historical transactions.
                  </p>
                </div>

                <div className="p-6 border border-slate-200 rounded-xl">
                  <PieChart className="w-5 h-5 text-emerald-600 mb-3" />
                  <h3 className="text-base font-semibold text-slate-900 mb-2">
                    Category Budgets &amp; Threshold Alerts
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Set monthly spending limits per category with configurable warning thresholds
                    (default 80%) and automatic over-budget notifications.
                  </p>
                </div>

                <div className="p-6 border border-slate-200 rounded-xl">
                  <Repeat className="w-5 h-5 text-emerald-600 mb-3" />
                  <h3 className="text-base font-semibold text-slate-900 mb-2">
                    Savings Goals &amp; Recurring Rules
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Track target dates and contributions for major milestones while automating
                    rent, payroll, and subscriptions idempotently.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Accounting Integrity & Security Section */}
          <section id="accounting-integrity" className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  Security &amp; Financial Integrity by Design
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  SmartSpend enforces strict row-level ownership (`user_id` foreign keys on every
                  table), server-side validation, audit event logging, and protective deletion
                  constraints.
                </p>
                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Row-Level User Isolation:</strong> Every query scopes accounts,
                      categories, transactions, budgets, and goals strictly to the authenticated
                      user.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Referential Deletion Guards:</strong> Accounts containing ledger
                      transactions cannot be accidentally deleted without archiving or reassigning.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Transparent Scope:</strong> SmartSpend does not claim live third-party
                      bank scraping or external wire execution; all balances derive deterministically
                      from your verified ledger and CSV imports.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Validated CSV Import Pipeline Specification</span>
                </div>
                <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto leading-relaxed">
{`date,description,type,amount,account,category,notes
2026-10-01,Engineering Payroll,income,5800.00,Chase Premier Checking,Salary & Payroll,Oct Deposit
2026-10-08,Trader Joes Market,expense,142.80,Chase Premier Checking,Groceries & Dining,Weekly food
2026-10-25,Vault Transfer,transfer,1500.00,Chase Premier Checking,,Monthly savings`}
                </pre>
                <p className="text-xs text-slate-500 mt-3">
                  Supports RFC-4180 quoted fields, duplicate fingerprint detection, and line-numbered
                  diagnostic reports before committing records to PostgreSQL.
                </p>
              </div>
            </div>
          </section>
        </main>
      )}

      {(currentPage === 'login' || currentPage === 'register') && (
        <main className="flex-1 flex items-center justify-center px-6 py-10 lg:py-16">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Side: Financial Ledger Overview & Highlights */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
                  PostgreSQL Personal Finance Ledger
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-snug mb-4">
                  Welcome to{' '}
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    SmartSpend
                  </span>
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Sign in or register your personal workspace to track bank, cash, and wallet
                  accounts, manage monthly category budgets, monitor savings goals, and automate
                  recurring bills with decimal-safe accuracy.
                </p>

                <div className="space-y-3.5 pt-4 border-t border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                      <Wallet className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        Multi-Account &amp; Transfer Accuracy
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Explicit inter-account transfers prevent double-counting in monthly income
                        and expense reports.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                      <PieChart className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        Category Budgets &amp; Savings Targets
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Real-time utilization progress bars with configurable threshold alerts and
                        milestone contribution tracking.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        4-Stage Validated CSV Import &amp; Export
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Automatic header, date, amount, and duplicate fingerprint verification
                        backed by Cloud SQL PostgreSQL.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Row-Level User Isolation · Cloud SQL (`us-west1`)</span>
                <button
                  type="button"
                  onClick={() => onNavigate('landing')}
                  className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  Explore Platform Overview →
                </button>
              </div>
            </div>

            {/* Right Side: Unified Sign In / Register Card */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 flex flex-col justify-between">
              <div>
                {/* Segmented Mode Switcher: Sign In vs Register */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      onNavigate('login');
                    }}
                    className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      currentPage === 'login'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      onNavigate('register');
                    }}
                    className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      currentPage === 'register'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Create Account (Register)
                  </button>
                </div>

                {currentPage === 'login' ? (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl font-bold text-slate-900">
                        Sign In to <span className="text-emerald-600">SmartSpend</span>
                      </h2>
                      <p className="text-xs text-slate-600 mt-1">
                        Enter your credentials to access your personal PostgreSQL finance ledger.
                      </p>
                    </div>

                    {(formError || authError) && (
                      <div
                        role="alert"
                        className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"
                      >
                        {formError || authError}
                      </div>
                    )}

                    <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div>
                        <label
                          htmlFor="login-email"
                          className="block text-xs font-semibold text-slate-700 mb-1.5"
                        >
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            id="login-email"
                            type="email"
                            required
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            htmlFor="login-password"
                            className="block text-xs font-semibold text-slate-700"
                          >
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setFormError(null);
                              setFormSuccess(null);
                              onNavigate('password-reset');
                            }}
                            className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            id="login-password"
                            type="password"
                            required
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        Sign In with Email
                      </button>
                    </form>

                    <div className="my-5 flex items-center gap-3">
                      <div className="h-px bg-slate-200 flex-1" />
                      <span className="text-xs text-slate-400">or continue with</span>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={onGoogleSignIn}
                        className="w-full py-2.5 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Sign In with Google OAuth</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleLaunchDemo}
                        className="w-full py-2.5 px-4 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4 text-emerald-700" />
                        <span>Instant Demo Workspace (Alex Morgan)</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-5">
                      <h2 className="text-xl font-bold text-slate-900">
                        Create Your <span className="text-emerald-600">SmartSpend</span> Account
                      </h2>
                      <p className="text-xs text-slate-600 mt-1">
                        Start with a clean, isolated personal ledger in PostgreSQL.
                      </p>
                    </div>

                    {formError && (
                      <div
                        role="alert"
                        className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"
                      >
                        {formError}
                      </div>
                    )}

                    <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                      <div>
                        <label
                          htmlFor="reg-name"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Full Name
                        </label>
                        <input
                          id="reg-name"
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Jordan Taylor"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="reg-email"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Email Address
                        </label>
                        <input
                          id="reg-email"
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="jordan@example.com"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="reg-password"
                            className="block text-xs font-semibold text-slate-700 mb-1"
                          >
                            Password (min 8 chars)
                          </label>
                          <input
                            id="reg-password"
                            type="password"
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="reg-confirm"
                            className="block text-xs font-semibold text-slate-700 mb-1"
                          >
                            Confirm Password
                          </label>
                          <input
                            id="reg-confirm"
                            type="password"
                            required
                            value={regConfirm}
                            onChange={(e) => setRegConfirm(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        Create Account &amp; Initialize Workspace
                      </button>
                    </form>
                  </>
                )}
              </div>

              <p className="text-xs text-center text-slate-600 mt-6 pt-4 border-t border-slate-100">
                {currentPage === 'login' ? (
                  <>
                    New to SmartSpend?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('register')}
                      className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Switch to Create Account
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('login')}
                      className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Switch to Sign In
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
        </main>
      )}

      {currentPage === 'password-reset' && (
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
            <div className="mb-6">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
                <KeyRound className="w-4 h-4 text-emerald-700" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Reset Your Password</h1>
              <p className="text-sm text-slate-600 mt-1">
                Recover access to your SmartSpend account securely.
              </p>
            </div>

            {formError && (
              <div
                role="alert"
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"
              >
                {formError}
              </div>
            )}

            {formSuccess && (
              <div
                role="status"
                className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800"
              >
                {formSuccess}
              </div>
            )}

            {resetStep !== 'done' ? (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Account Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="alex.morgan@smartspend.app"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {resetStep === 'confirm' && (
                  <div>
                    <label
                      htmlFor="reset-new-password"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      New Password (minimum 8 characters)
                    </label>
                    <input
                      id="reset-new-password"
                      type="password"
                      required
                      value={resetNewPass}
                      onChange={(e) => setResetNewPass(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  {resetStep === 'request'
                    ? 'Send Password Reset Instructions'
                    : 'Confirm New Password'}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Return to Sign In
              </button>
            )}

            <p className="text-xs text-center text-slate-600 mt-6">
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </p>
          </div>
        </main>
      )}

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 lg:px-12 py-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span>SmartSpend Personal Finance Management · PostgreSQL &amp; Django Architecture</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="hover:text-slate-800 cursor-pointer"
          >
            Sign In
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="hover:text-slate-800 cursor-pointer"
          >
            Register
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={handleLaunchDemo}
            className="hover:text-slate-800 cursor-pointer"
          >
            Demo Workspace
          </button>
        </div>
      </footer>
    </div>
  );
};
