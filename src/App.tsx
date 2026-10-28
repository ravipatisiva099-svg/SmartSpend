import React, { useState, useEffect, useCallback } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  PieChart,
  Target,
  Repeat,
  BarChart3,
  Bell,
  User,
  Settings,
  Shield,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase';
import { PublicViews, PublicPageType } from './components/PublicViews';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { AccountsCategoriesView } from './components/AccountsCategoriesView';
import { BudgetsGoalsRecurringView } from './components/BudgetsGoalsRecurringView';
import { ReportsSettingsHelpView } from './components/ReportsSettingsHelpView';
import {
  AccountRecord,
  CategoryRecord,
  TransactionRecord,
  BudgetRecord,
  SavingsGoalRecord,
  RecurringRuleRecord,
  CsvImportRow,
} from './utils/financeRules';

export type WorkspacePage =
  | 'dashboard'
  | 'transactions'
  | 'accounts'
  | 'categories'
  | 'budgets'
  | 'goals'
  | 'recurring'
  | 'reports'
  | 'notifications'
  | 'profile'
  | 'preferences'
  | 'security'
  | 'help'
  | 'error-403'
  | 'error-404'
  | 'error-500';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const isAutostart = params.get('autostart') === '1';

  // Store auth token strictly in memory (never in localStorage)
  const [authToken, setAuthToken] = useState<string | null>(
    isAutostart ? 'local:demo-smartspend-user:demo@smartspend.app:Alex Morgan' : null
  );
  const [currentUser, setCurrentUser] = useState<{
    uid: string;
    email: string;
    name: string;
  } | null>(
    isAutostart
      ? {
          uid: 'demo-smartspend-user',
          email: 'demo@smartspend.app',
          name: 'Alex Morgan',
        }
      : null
  );

  const [publicPage, setPublicPage] = useState<PublicPageType>('login');
  const [activePage, setActivePage] = useState<WorkspacePage>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openTxModalOnNav, setOpenTxModalOnNav] = useState(false);

  // Workspace Data State from PostgreSQL
  const [isLoading, setIsLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [profile, setProfile] = useState<any>({
    id: 1,
    uid: 'demo-smartspend-user',
    email: 'demo@smartspend.app',
    fullName: 'Alex Morgan',
    currency: 'USD',
    timezone: 'America/New_York',
    dateFormat: 'YYYY-MM-DD',
    emailAlerts: true,
    budgetThresholdPct: 80,
    twoFactorEnabled: false,
  });
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalRecord[]>([]);
  const [goalContributions, setGoalContributions] = useState<any[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRuleRecord[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);

  const showFlash = (text: string, type: 'success' | 'error' = 'success') => {
    setFlashMessage({ type, text });
    setTimeout(() => {
      setFlashMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!authToken) throw new Error('Not authenticated');
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          ...(options.headers || {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    },
    [authToken]
  );

  const loadWorkspace = useCallback(async () => {
    if (!authToken) return;
    setIsLoading(true);
    setWorkspaceError(null);
    try {
      const data = await apiFetch('/api/workspace?seed=true');
      if (data.profile) setProfile(data.profile);
      setAccounts(data.accounts || []);
      setCategories(data.categories || []);
      setTransactions(data.transactions || []);
      setBudgets(data.budgets || []);
      setSavingsGoals(data.savingsGoals || []);
      setGoalContributions(data.goalContributions || []);
      setRecurringRules(data.recurringRules || []);
      setNotifications(data.notifications || []);
      setAuditEvents(data.auditEvents || []);
    } catch (error: any) {
      console.error('Error loading workspace:', error);
      setWorkspaceError(
        error.message || 'Unable to load financial records from PostgreSQL.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [authToken, apiFetch]);

  useEffect(() => {
    if (authToken) {
      loadWorkspace();
    }
  }, [authToken, loadWorkspace]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setAuthToken(idToken);
      setCurrentUser({
        uid: cred.user.uid,
        email: cred.user.email || 'user@smartspend.app',
        name: cred.user.displayName || 'SmartSpend User',
      });
      setActivePage('dashboard');
      showFlash('Signed in with Google OAuth.');
    } catch (error: any) {
      console.error('Google Sign-In failed:', error);
      setAuthError(
        'Google popup sign-in was cancelled or blocked. You can use Email Sign-In or the Instant Demo Workspace below.'
      );
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth).catch(() => {});
    } finally {
      setAuthToken(null);
      setCurrentUser(null);
      setPublicPage('login');
      setMobileMenuOpen(false);
    }
  };

  const handleCurrencyChange = async (nextCurrency: string) => {
    setProfile((prev: any) => ({ ...prev, currency: nextCurrency }));
    try {
      await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ currency: nextCurrency }),
      });
      showFlash(`Amount currency updated to ${nextCurrency}.`);
    } catch (err: any) {
      console.error('Failed to update currency:', err);
    }
  };

  if (!authToken || !currentUser) {
    return (
      <PublicViews
        currentPage={publicPage}
        onNavigate={(page) => setPublicPage(page)}
        onLoginSuccess={(token, user) => {
          setAuthToken(token);
          setCurrentUser(user);
          setActivePage('dashboard');
          showFlash(`Welcome back, ${user.name}. Connected to PostgreSQL ledger.`);
        }}
        onGoogleSignIn={handleGoogleSignIn}
        authError={authError}
      />
    );
  }

  const unreadNotifications = notifications.filter((n) => !n.isRead).length;

  const navSections = [
    {
      heading: 'Core Ledger',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
        { id: 'accounts', label: 'Accounts & Transfers', icon: Wallet },
        { id: 'categories', label: 'Categories', icon: Tags },
      ],
    },
    {
      heading: 'Planning & Automation',
      items: [
        { id: 'budgets', label: 'Monthly Budgets', icon: PieChart },
        { id: 'goals', label: 'Savings Goals', icon: Target },
        { id: 'recurring', label: 'Recurring Rules', icon: Repeat },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      ],
    },
    {
      heading: 'Account & System',
      items: [
        {
          id: 'notifications',
          label:
            unreadNotifications > 0
              ? `Notifications (${unreadNotifications})`
              : 'Notifications',
          icon: Bell,
        },
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'preferences', label: 'Preferences', icon: Settings },
        { id: 'security', label: 'Security & Audit', icon: Shield },
        { id: 'help', label: 'Help & Django Guide', icon: HelpCircle },
      ],
    },
  ];

  const pageLabels: Record<WorkspacePage, string> = {
    dashboard: 'Dashboard',
    transactions: 'Transactions Ledger',
    accounts: 'Accounts & Transfers',
    categories: 'Categories',
    budgets: 'Monthly Budgets',
    goals: 'Savings Goals',
    recurring: 'Recurring Rules',
    reports: 'Reports & Analytics',
    notifications: 'Notifications',
    profile: 'User Profile',
    preferences: 'Preferences',
    security: 'Security Settings',
    help: 'Help & Setup Guide',
    'error-403': '403 Forbidden',
    'error-404': '404 Not Found',
    'error-500': '500 Server Error',
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar (260px width) */}
      <aside
        aria-label="Workspace sidebar navigation"
        className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200 shrink-0 sticky top-0 h-screen"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setActivePage('dashboard')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            SmartSpend
          </button>
          <select
            aria-label="Change amount currency"
            value={profile?.currency || 'USD'}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="px-2 py-1 text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md cursor-pointer"
          >
            <option value="USD">USD ($)</option>
            <option value="INR">INR (₹)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CAD">CAD ($)</option>
            <option value="AUD">AUD ($)</option>
            <option value="JPY">JPY (¥)</option>
          </select>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((sec) => (
            <div key={sec.heading}>
              <p className="px-3 text-xs font-semibold text-slate-400 mb-1.5">
                {sec.heading}
              </p>
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActivePage(item.id as WorkspacePage);
                        setOpenTxModalOnNav(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {profile?.fullName || currentUser.name}
              </p>
              <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
            </div>
            <button
              type="button"
              aria-label="Sign out of SmartSpend"
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-xs bg-white h-full flex flex-col z-10 shadow-xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">SmartSpend</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {navSections.map((sec) => (
                <div key={sec.heading}>
                  <p className="px-3 text-xs font-semibold text-slate-400 mb-1">
                    {sec.heading}
                  </p>
                  <div className="space-y-0.5">
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activePage === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActivePage(item.id as WorkspacePage);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-lg cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-800 font-semibold'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 px-3 text-xs font-semibold text-red-600 bg-red-50 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* SaaS Top Bar Contract: Breadcrumb on Left, 1 Primary Action on Right */}
        <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs font-medium text-slate-500 truncate">
              <span>SmartSpend</span>
              <span className="mx-2">/</span>
              <span className="text-slate-900 font-semibold">
                {pageLabels[activePage]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setOpenTxModalOnNav(true);
                setActivePage('transactions');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Transaction</span>
            </button>
          </div>
        </header>

        {/* Flash Message Feedback */}
        {flashMessage && (
          <div
            role="status"
            className={`mx-6 mt-4 px-4 py-3 rounded-xl border text-xs flex items-center justify-between ${
              flashMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {flashMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{flashMessage.text}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification message"
              onClick={() => setFlashMessage(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Workspace Error Banner */}
        {workspaceError && (
          <div
            role="alert"
            className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between"
          >
            <span>{workspaceError}</span>
            <button
              type="button"
              onClick={loadWorkspace}
              className="px-3 py-1.5 font-semibold bg-white border border-red-300 rounded-lg cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Main Viewport Content */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {isLoading && accounts.length === 0 ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading financial ledger">
              <div className="h-20 bg-white border border-slate-200 rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
                <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
                <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
                <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
              </div>
              <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && (
                <DashboardView
                  accounts={accounts}
                  categories={categories}
                  transactions={transactions}
                  budgets={budgets}
                  savingsGoals={savingsGoals}
                  currency={profile?.currency || 'USD'}
                  onNavigate={(p) => setActivePage(p as WorkspacePage)}
                  onOpenNewTransaction={() => {
                    setOpenTxModalOnNav(true);
                    setActivePage('transactions');
                  }}
                />
              )}

              {activePage === 'transactions' && (
                <TransactionsView
                  accounts={accounts}
                  categories={categories}
                  transactions={transactions}
                  currency={profile?.currency || 'USD'}
                  onChangeCurrency={handleCurrencyChange}
                  showNewModalInitially={openTxModalOnNav}
                  onClearInitialModal={() => setOpenTxModalOnNav(false)}
                  onCreateTransaction={async (payload) => {
                    await apiFetch('/api/transactions', {
                      method: 'POST',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash('Transaction recorded in PostgreSQL ledger.');
                  }}
                  onUpdateTransaction={async (id, payload) => {
                    await apiFetch(`/api/transactions/${id}`, {
                      method: 'PUT',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash('Transaction amount type & details updated.');
                  }}
                  onDeleteTransaction={async (id) => {
                    await apiFetch(`/api/transactions/${id}`, {
                      method: 'DELETE',
                    });
                    await loadWorkspace();
                    showFlash('Transaction deleted.');
                  }}
                  onImportTransactions={async (rows: CsvImportRow[]) => {
                    await apiFetch('/api/transactions/import', {
                      method: 'POST',
                      body: JSON.stringify({ rows }),
                    });
                    await loadWorkspace();
                    showFlash(`Imported ${rows.length} CSV transaction(s).`);
                  }}
                />
              )}

              {(activePage === 'accounts' || activePage === 'categories') && (
                <AccountsCategoriesView
                  mode={activePage}
                  accounts={accounts}
                  categories={categories}
                  transactions={transactions}
                  currency={profile?.currency || 'USD'}
                  onCreateAccount={async (payload) => {
                    await apiFetch('/api/accounts', {
                      method: 'POST',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash(`Account "${payload.name}" created.`);
                  }}
                  onUpdateAccount={async (id, payload) => {
                    await apiFetch(`/api/accounts/${id}`, {
                      method: 'PUT',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash('Account updated.');
                  }}
                  onDeleteAccount={async (id) => {
                    await apiFetch(`/api/accounts/${id}`, {
                      method: 'DELETE',
                    });
                    await loadWorkspace();
                    showFlash('Account removed.');
                  }}
                  onCreateTransfer={async (payload) => {
                    await apiFetch('/api/transactions', {
                      method: 'POST',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash('Inter-account transfer recorded.');
                  }}
                  onCreateCategory={async (payload) => {
                    await apiFetch('/api/categories', {
                      method: 'POST',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash(`Category "${payload.name}" created.`);
                  }}
                  onDeleteCategory={async (id) => {
                    await apiFetch(`/api/categories/${id}`, {
                      method: 'DELETE',
                    });
                    await loadWorkspace();
                    showFlash('Category deleted.');
                  }}
                />
              )}

              {(activePage === 'budgets' ||
                activePage === 'goals' ||
                activePage === 'recurring') && (
                <BudgetsGoalsRecurringView
                  mode={activePage}
                  accounts={accounts}
                  categories={categories}
                  transactions={transactions}
                  budgets={budgets}
                  savingsGoals={savingsGoals}
                  goalContributions={goalContributions}
                  recurringRules={recurringRules}
                  currency={profile?.currency || 'USD'}
                  onSaveBudget={async (payload) => {
                    await apiFetch('/api/budgets', {
                      method: 'POST',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash('Monthly category budget saved.');
                  }}
                  onDeleteBudget={async (id) => {
                    await apiFetch(`/api/budgets/${id}`, {
                      method: 'DELETE',
                    });
                    await loadWorkspace();
                    showFlash('Budget removed.');
                  }}
                  onCreateGoal={async (payload) => {
                    await apiFetch('/api/goals', {
                      method: 'POST',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash(`Savings goal "${payload.name}" created.`);
                  }}
                  onContributeGoal={async (goalId, payload) => {
                    await apiFetch(`/api/goals/${goalId}/contribute`, {
                      method: 'POST',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash('Savings contribution recorded.');
                  }}
                  onDeleteGoal={async (id) => {
                    await apiFetch(`/api/goals/${id}`, {
                      method: 'DELETE',
                    });
                    await loadWorkspace();
                    showFlash('Savings goal deleted.');
                  }}
                  onCreateRecurring={async (payload) => {
                    await apiFetch('/api/recurring', {
                      method: 'POST',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash('Recurring rule created.');
                  }}
                  onUpdateRecurring={async (id, payload) => {
                    await apiFetch(`/api/recurring/${id}`, {
                      method: 'PUT',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash('Recurring rule amount type updated.');
                  }}
                  onToggleRecurring={async (id, isActive) => {
                    await apiFetch(`/api/recurring/${id}/toggle`, {
                      method: 'PUT',
                      body: JSON.stringify({ isActive }),
                    });
                    await loadWorkspace();
                    showFlash(isActive ? 'Recurring rule resumed.' : 'Recurring rule paused.');
                  }}
                  onDeleteRecurring={async (id) => {
                    await apiFetch(`/api/recurring/${id}`, {
                      method: 'DELETE',
                    });
                    await loadWorkspace();
                    showFlash('Recurring rule deleted.');
                  }}
                  onProcessDueRecurring={async (asOfDate) => {
                    const res = await apiFetch('/api/recurring/process', {
                      method: 'POST',
                      body: JSON.stringify({ asOfDate }),
                    });
                    await loadWorkspace();
                    return res;
                  }}
                />
              )}

              {(activePage === 'reports' ||
                activePage === 'notifications' ||
                activePage === 'profile' ||
                activePage === 'preferences' ||
                activePage === 'security' ||
                activePage === 'help' ||
                activePage === 'error-403' ||
                activePage === 'error-404' ||
                activePage === 'error-500') && (
                <ReportsSettingsHelpView
                  mode={activePage}
                  profile={profile}
                  accounts={accounts}
                  categories={categories}
                  transactions={transactions}
                  notifications={notifications}
                  auditEvents={auditEvents}
                  onNavigate={(p) => setActivePage(p as WorkspacePage)}
                  onMarkNotificationRead={async (id) => {
                    await apiFetch(`/api/notifications/${id}/read`, {
                      method: 'PUT',
                    });
                    await loadWorkspace();
                  }}
                  onMarkAllNotificationsRead={async () => {
                    await apiFetch('/api/notifications/read-all', {
                      method: 'POST',
                    });
                    await loadWorkspace();
                    showFlash('All notifications marked as read.');
                  }}
                  onUpdateProfile={async (payload) => {
                    await apiFetch('/api/profile', {
                      method: 'PUT',
                      body: JSON.stringify(payload),
                    });
                    await loadWorkspace();
                    showFlash('Profile and preferences saved.');
                  }}
                  onResetDemoData={async () => {
                    await apiFetch('/api/demo/reset', {
                      method: 'POST',
                    });
                    await loadWorkspace();
                    showFlash('Demo fixtures reloaded.');
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
