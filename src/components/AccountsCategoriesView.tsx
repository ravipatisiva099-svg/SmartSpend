import React, { useState } from 'react';
import {
  Plus,
  ArrowLeftRight,
  Trash2,
  Edit2,
  Landmark,
  Wallet,
  Banknote,
  AlertCircle,
} from 'lucide-react';
import {
  AccountRecord,
  CategoryRecord,
  TransactionRecord,
  calculateAccountBalances,
  formatCurrency,
  toCents,
  fromCents,
} from '../utils/financeRules';

interface AccountsCategoriesViewProps {
  mode: 'accounts' | 'categories';
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  transactions: TransactionRecord[];
  currency: string;
  onCreateAccount: (payload: {
    name: string;
    accountType: 'bank' | 'cash' | 'wallet';
    openingBalance: string;
    institution: string;
  }) => Promise<void>;
  onUpdateAccount: (
    id: number,
    payload: {
      name: string;
      accountType: 'bank' | 'cash' | 'wallet';
      openingBalance: string;
      institution: string;
      isArchived: boolean;
    }
  ) => Promise<void>;
  onDeleteAccount: (id: number) => Promise<void>;
  onCreateTransfer: (payload: {
    accountId: number;
    destinationAccountId: number;
    transactionType: 'transfer';
    amount: string;
    description: string;
    transactionDate: string;
    notes: string;
  }) => Promise<void>;
  onCreateCategory: (payload: {
    name: string;
    categoryType: 'income' | 'expense';
    color: string;
  }) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
}

export const AccountsCategoriesView: React.FC<AccountsCategoriesViewProps> = ({
  mode,
  accounts,
  categories,
  transactions,
  currency,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateTransfer,
  onCreateCategory,
  onDeleteCategory,
}) => {
  // Accounts state
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRecord | null>(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<'bank' | 'cash' | 'wallet'>('bank');
  const [accOpening, setAccOpening] = useState('0.00');
  const [accInstitution, setAccInstitution] = useState('');
  const [accArchived, setAccArchived] = useState(false);

  // Transfer state
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState<number>(accounts[0]?.id || 0);
  const [transferDestId, setTransferDestId] = useState<number>(accounts[1]?.id || 0);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState('2026-10-28');
  const [transferDesc, setTransferDesc] = useState('Inter-Account Funds Transfer');

  // Selected Account History Inspector
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    accounts[0]?.id || null
  );

  // Categories state
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'income' | 'expense'>('expense');
  const [catColor, setCatColor] = useState('#059669');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const balances = calculateAccountBalances(accounts, transactions);

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      if (editingAccount) {
        await onUpdateAccount(editingAccount.id, {
          name: accName,
          accountType: accType,
          openingBalance: accOpening,
          institution: accInstitution,
          isArchived: accArchived,
        });
      } else {
        await onCreateAccount({
          name: accName,
          accountType: accType,
          openingBalance: accOpening,
          institution: accInstitution,
        });
      }
      setShowNewAccount(false);
      setEditingAccount(null);
      setAccName('');
      setAccOpening('0.00');
      setAccInstitution('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save account.');
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (transferSourceId === transferDestId) {
      setErrorMsg('Source and destination accounts must be different.');
      return;
    }
    try {
      await onCreateTransfer({
        accountId: Number(transferSourceId),
        destinationAccountId: Number(transferDestId),
        transactionType: 'transfer',
        amount: transferAmount,
        description: transferDesc,
        transactionDate: transferDate,
        notes: 'Explicit inter-account transfer',
      });
      setShowTransferForm(false);
      setTransferAmount('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record transfer.');
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await onCreateCategory({
        name: catName,
        categoryType: catType,
        color: catColor,
      });
      setCatName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create category.');
    }
  };

  if (mode === 'categories') {
    const expenseCategories = categories.filter((c) => c.categoryType === 'expense');
    const incomeCategories = categories.filter((c) => c.categoryType === 'income');

    const getCategoryStats = (catId: number) => {
      let count = 0;
      let totalCents = 0;
      for (const tx of transactions) {
        if (tx.categoryId === catId) {
          count += 1;
          totalCents += toCents(tx.amount);
        }
      }
      return { count, total: fromCents(totalCents) };
    };

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Categories Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Organize income and expense classifications for budgets and analytics
            </p>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"
          >
            {errorMsg}
          </div>
        )}

        {/* Create Category Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">Create New Category</h2>
          <form
            onSubmit={handleCategorySubmit}
            className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
          >
            <div>
              <label
                htmlFor="cat-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Category Name
              </label>
              <input
                id="cat-name"
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Travel & Lodging"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="cat-type"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Classification
              </label>
              <select
                id="cat-type"
                value={catType}
                onChange={(e) => setCatType(e.target.value as 'income' | 'expense')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="expense">Expense Category</option>
                <option value="income">Income Category</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="cat-color"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Accent Swatch
              </label>
              <input
                id="cat-color"
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="w-full h-9 p-1 border border-slate-300 rounded-lg bg-white cursor-pointer"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Add Category
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Categories */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Expense Categories ({expenseCategories.length})
            </h2>
            <div className="divide-y divide-slate-100">
              {expenseCategories.map((cat) => {
                const stats = getCategoryStats(cat.id);
                return (
                  <div
                    key={cat.id}
                    className="py-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div>
                        <p className="font-semibold text-slate-900">{cat.name}</p>
                        <p className="text-slate-500 font-mono tabular-nums">
                          {stats.count} transactions · {formatCurrency(stats.total, currency)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete category ${cat.name}`}
                      onClick={() => onDeleteCategory(cat.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Income Categories */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Income Categories ({incomeCategories.length})
            </h2>
            <div className="divide-y divide-slate-100">
              {incomeCategories.map((cat) => {
                const stats = getCategoryStats(cat.id);
                return (
                  <div
                    key={cat.id}
                    className="py-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div>
                        <p className="font-semibold text-slate-900">{cat.name}</p>
                        <p className="text-slate-500 font-mono tabular-nums">
                          {stats.count} transactions · {formatCurrency(stats.total, currency)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete category ${cat.name}`}
                      onClick={() => onDeleteCategory(cat.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ACCOUNTS VIEW
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const accountTransactions = selectedAccount
    ? transactions.filter(
        (tx) =>
          tx.accountId === selectedAccount.id ||
          tx.destinationAccountId === selectedAccount.id
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Accounts &amp; Transfers</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consolidated Net Balance:{' '}
            <strong className="text-slate-900 font-mono tabular-nums">
              {formatCurrency(balances.totalBalance, currency)}
            </strong>{' '}
            · Transfers adjust source and destination balances without double-counting
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setShowTransferForm(!showTransferForm);
              setShowNewAccount(false);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600" />
            <span>Transfer Funds</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setAccName('');
              setAccType('bank');
              setAccOpening('0.00');
              setAccInstitution('');
              setAccArchived(false);
              setShowNewAccount(!showNewAccount);
              setShowTransferForm(false);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Create / Edit Account Form */}
      {showNewAccount && (
        <div className="bg-white border border-slate-300 rounded-xl p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">
            {editingAccount ? `Edit Account: ${editingAccount.name}` : 'Add Financial Account'}
          </h2>
          <form
            onSubmit={handleAccountSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
          >
            <div>
              <label
                htmlFor="acc-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Account Name
              </label>
              <input
                id="acc-name"
                type="text"
                required
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                placeholder="e.g. Fidelity Cash Management"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="acc-type"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Account Type
              </label>
              <select
                id="acc-type"
                value={accType}
                onChange={(e) => setAccType(e.target.value as 'bank' | 'cash' | 'wallet')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                <option value="bank">Bank Account</option>
                <option value="wallet">Digital Wallet</option>
                <option value="cash">Cash Reserve</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="acc-opening"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Opening Balance ({currency})
              </label>
              <input
                id="acc-opening"
                type="number"
                step="0.01"
                min="0"
                required
                value={accOpening}
                onChange={(e) => setAccOpening(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="acc-inst"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Institution / Location
              </label>
              <input
                id="acc-inst"
                type="text"
                value={accInstitution}
                onChange={(e) => setAccInstitution(e.target.value)}
                placeholder="e.g. Chase, Ally, Safe"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
              >
                {editingAccount ? 'Update' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewAccount(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Explicit Inter-Account Transfer Form */}
      {showTransferForm && (
        <div className="bg-white border border-slate-300 rounded-xl p-6">
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Record Explicit Inter-Account Transfer
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Moves funds directly from Source Account to Destination Account. Net worth and
            income/expense totals remain uninflated.
          </p>
          <form
            onSubmit={handleTransferSubmit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
          >
            <div>
              <label
                htmlFor="tr-source"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                From Source Account
              </label>
              <select
                id="tr-source"
                value={transferSourceId}
                onChange={(e) => setTransferSourceId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="tr-dest"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                To Destination Account
              </label>
              <select
                id="tr-dest"
                value={transferDestId}
                onChange={(e) => setTransferDestId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="tr-amount"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Transfer Amount ({currency})
              </label>
              <input
                id="tr-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="500.00"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="tr-date"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Transfer Date
              </label>
              <input
                id="tr-date"
                type="date"
                required
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer"
              >
                Execute Transfer
              </button>
              <button
                type="button"
                onClick={() => setShowTransferForm(false)}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((acc) => {
          const accBal = balances.byAccountId[acc.id] || {
            balance: acc.openingBalance,
            txCount: 0,
          };
          const isSelected = selectedAccount?.id === acc.id;

          return (
            <div
              key={acc.id}
              className={`bg-white border rounded-xl p-5 flex flex-col justify-between transition-colors ${
                isSelected ? 'border-emerald-600' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {acc.accountType === 'bank' && (
                      <Landmark className="w-4 h-4 text-emerald-600" />
                    )}
                    {acc.accountType === 'wallet' && (
                      <Wallet className="w-4 h-4 text-emerald-600" />
                    )}
                    {acc.accountType === 'cash' && (
                      <Banknote className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="capitalize">{acc.accountType}</span>
                    {acc.institution && <span>· {acc.institution}</span>}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Edit account ${acc.name}`}
                      onClick={() => {
                        setEditingAccount(acc);
                        setAccName(acc.name);
                        setAccType(acc.accountType);
                        setAccOpening(acc.openingBalance);
                        setAccInstitution(acc.institution);
                        setAccArchived(acc.isArchived);
                        setShowNewAccount(true);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete account ${acc.name}`}
                      onClick={async () => {
                        setErrorMsg(null);
                        try {
                          await onDeleteAccount(acc.id);
                        } catch (err: any) {
                          setErrorMsg(err.message);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{acc.name}</h3>
                <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                  {formatCurrency(accBal.balance, currency)}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono tabular-nums">
                  Opening: {formatCurrency(acc.openingBalance, currency)} · {accBal.txCount} tx
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedAccountId(acc.id)}
                  className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  {isSelected ? 'Viewing History' : 'Inspect →'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Account Transaction History */}
      {selectedAccount && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Account Ledger: {selectedAccount.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Opening Balance: {formatCurrency(selectedAccount.openingBalance, currency)} ·
                Current Computed Balance:{' '}
                <strong className="text-slate-900 font-mono tabular-nums">
                  {formatCurrency(
                    balances.byAccountId[selectedAccount.id]?.balance || '0.00',
                    currency
                  )}
                </strong>
              </p>
            </div>
          </div>

          {accountTransactions.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No transactions recorded for this account yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 font-semibold">Date</th>
                    <th className="py-2 font-semibold">Description</th>
                    <th className="py-2 font-semibold">Movement</th>
                    <th className="py-2 font-semibold text-right">Impact on Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {accountTransactions.map((tx) => {
                    const isIncomingTransfer =
                      tx.transactionType === 'transfer' &&
                      tx.destinationAccountId === selectedAccount.id;
                    const isPositive =
                      tx.transactionType === 'income' || isIncomingTransfer;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="py-2.5 font-mono tabular-nums text-slate-500">
                          {tx.transactionDate}
                        </td>
                        <td className="py-2.5 font-medium text-slate-900">
                          {tx.description}
                        </td>
                        <td className="py-2.5 text-slate-500 capitalize">
                          {tx.transactionType === 'transfer'
                            ? isIncomingTransfer
                              ? 'Incoming Transfer'
                              : 'Outgoing Transfer'
                            : tx.transactionType}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono tabular-nums font-semibold ${
                            isPositive ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {isPositive ? '+' : '-'}
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
      )}
    </div>
  );
};
