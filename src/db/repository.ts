import { eq, and, desc } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  accounts,
  categories,
  transactions,
  budgets,
  savingsGoals,
  goalContributions,
  recurringRules,
  notifications,
  auditEvents,
} from './schema.ts';
import {
  toCents,
  fromCents,
  computeNextDueDate,
  buildTransactionHash,
} from '../utils/financeRules.ts';

export async function logAuditEvent(
  userId: number,
  action: string,
  entityType: string,
  entityId: string | number,
  details: string
) {
  try {
    await db.insert(auditEvents).values({
      userId,
      action,
      entityType,
      entityId: String(entityId),
      details,
    });
  } catch (error) {
    console.error('Failed to record audit event:', error);
  }
}

export async function seedUserInitialWorkspace(
  userId: number,
  includeDemoTransactions = true
) {
  try {
    const existingAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));

    if (existingAccounts.length > 0) {
      return;
    }

    // 1. Insert default categories
    const insertedCategories = await db
      .insert(categories)
      .values([
        {
          userId,
          name: 'Salary & Payroll',
          categoryType: 'income',
          color: '#059669',
          icon: 'briefcase',
          isSystem: true,
        },
        {
          userId,
          name: 'Consulting & Freelance',
          categoryType: 'income',
          color: '#0d9488',
          icon: 'laptop',
          isSystem: true,
        },
        {
          userId,
          name: 'Dividends & Interest',
          categoryType: 'income',
          color: '#2563eb',
          icon: 'trending-up',
          isSystem: true,
        },
        {
          userId,
          name: 'Housing & Rent',
          categoryType: 'expense',
          color: '#1e293b',
          icon: 'home',
          isSystem: true,
        },
        {
          userId,
          name: 'Groceries & Dining',
          categoryType: 'expense',
          color: '#d97706',
          icon: 'shopping-bag',
          isSystem: true,
        },
        {
          userId,
          name: 'Utilities & Internet',
          categoryType: 'expense',
          color: '#4f46e5',
          icon: 'zap',
          isSystem: true,
        },
        {
          userId,
          name: 'Transportation',
          categoryType: 'expense',
          color: '#0284c7',
          icon: 'car',
          isSystem: true,
        },
        {
          userId,
          name: 'Healthcare & Fitness',
          categoryType: 'expense',
          color: '#e11d48',
          icon: 'heart',
          isSystem: true,
        },
        {
          userId,
          name: 'Software & Subscriptions',
          categoryType: 'expense',
          color: '#7c3aed',
          icon: 'cpu',
          isSystem: true,
        },
      ])
      .returning();

    if (!includeDemoTransactions) {
      return;
    }

    // 2. Insert realistic accounts (Bank, Savings, Cash, Wallet)
    const insertedAccounts = await db
      .insert(accounts)
      .values([
        {
          userId,
          name: 'Chase Premier Checking',
          accountType: 'bank',
          openingBalance: '6450.00',
          currency: 'USD',
          institution: 'JPMorgan Chase',
          isArchived: false,
        },
        {
          userId,
          name: 'Ally High-Yield Vault',
          accountType: 'bank',
          openingBalance: '18500.00',
          currency: 'USD',
          institution: 'Ally Bank',
          isArchived: false,
        },
        {
          userId,
          name: 'Apple Pay Cash Wallet',
          accountType: 'wallet',
          openingBalance: '420.00',
          currency: 'USD',
          institution: 'Apple Cash',
          isArchived: false,
        },
        {
          userId,
          name: 'Emergency Cash Reserve',
          accountType: 'cash',
          openingBalance: '350.00',
          currency: 'USD',
          institution: 'Physical Safe',
          isArchived: false,
        },
      ])
      .returning();

    const checkingAcc = insertedAccounts[0];
    const savingsAcc = insertedAccounts[1];
    const walletAcc = insertedAccounts[2];
    const cashAcc = insertedAccounts[3];

    const catByName = (name: string) =>
      insertedCategories.find((c) => c.name === name)?.id ?? null;

    // 3. Insert transactions across 2026-08, 2026-09, and 2026-10 (current month)
    const demoTxs = [
      // August 2026
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Salary & Payroll'),
        transactionType: 'income',
        amount: '5800.00',
        description: 'Bi-Monthly Engineering Payroll [Demo]',
        transactionDate: '2026-08-01',
        notes: 'Direct deposit after tax & 401k',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Housing & Rent'),
        transactionType: 'expense',
        amount: '1850.00',
        description: 'Avalon Bay Apartment Lease [Demo]',
        transactionDate: '2026-08-02',
        notes: 'August monthly rent',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Groceries & Dining'),
        transactionType: 'expense',
        amount: '540.25',
        description: 'Whole Foods & Trader Joes [Demo]',
        transactionDate: '2026-08-14',
        notes: 'Monthly household groceries',
      },
      // September 2026
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Salary & Payroll'),
        transactionType: 'income',
        amount: '5800.00',
        description: 'Bi-Monthly Engineering Payroll [Demo]',
        transactionDate: '2026-09-01',
        notes: 'Direct deposit',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Consulting & Freelance'),
        transactionType: 'income',
        amount: '950.00',
        description: 'PostgreSQL Schema Audit Retainer [Demo]',
        transactionDate: '2026-09-12',
        notes: 'Client invoice #104',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Housing & Rent'),
        transactionType: 'expense',
        amount: '1850.00',
        description: 'Avalon Bay Apartment Lease [Demo]',
        transactionDate: '2026-09-02',
        notes: 'September monthly rent',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Groceries & Dining'),
        transactionType: 'expense',
        amount: '612.80',
        description: 'Whole Foods Market & Local Dining [Demo]',
        transactionDate: '2026-09-18',
        notes: 'Groceries and weekend dinner',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Utilities & Internet'),
        transactionType: 'expense',
        amount: '142.50',
        description: 'ConEdison Electric & Sonic Fiber [Demo]',
        transactionDate: '2026-09-21',
        notes: 'Electric + 1Gbps fiber',
      },
      // October 2026 (Current Month)
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Salary & Payroll'),
        transactionType: 'income',
        amount: '5800.00',
        description: 'Oct Engineering Payroll Deposit [Demo]',
        transactionDate: '2026-10-01',
        notes: 'October base salary',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Consulting & Freelance'),
        transactionType: 'income',
        amount: '1250.00',
        description: 'Fintech UI Architecture Advisory [Demo]',
        transactionDate: '2026-10-10',
        notes: 'Completed milestone 2',
      },
      {
        userId,
        accountId: savingsAcc.id,
        categoryId: catByName('Dividends & Interest'),
        transactionType: 'income',
        amount: '74.85',
        description: 'Ally High-Yield Monthly APY Interest [Demo]',
        transactionDate: '2026-10-15',
        notes: '4.35% APY interest payment',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Housing & Rent'),
        transactionType: 'expense',
        amount: '1850.00',
        description: 'Avalon Bay Apartment Lease [Demo]',
        transactionDate: '2026-10-02',
        notes: 'October rent payment',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Groceries & Dining'),
        transactionType: 'expense',
        amount: '538.40',
        description: 'Trader Joes & FreshDirect [Demo]',
        transactionDate: '2026-10-08',
        notes: 'Weekly produce and pantry restock',
      },
      {
        userId,
        accountId: walletAcc.id,
        categoryId: catByName('Groceries & Dining'),
        transactionType: 'expense',
        amount: '64.20',
        description: 'Blue Bottle Coffee & Artisanal Bakery [Demo]',
        transactionDate: '2026-10-14',
        notes: 'Team coffee catchup',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Utilities & Internet'),
        transactionType: 'expense',
        amount: '148.90',
        description: 'ConEdison Power & Fiber Gigabit [Demo]',
        transactionDate: '2026-10-16',
        notes: 'Auto-debit utility bill',
      },
      {
        userId,
        accountId: walletAcc.id,
        categoryId: catByName('Transportation'),
        transactionType: 'expense',
        amount: '132.00',
        description: 'MTA MetroCard & Regional Rail Pass [Demo]',
        transactionDate: '2026-10-18',
        notes: 'Monthly transit pass',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Healthcare & Fitness'),
        transactionType: 'expense',
        amount: '115.00',
        description: 'Equinox Club & Pharmacy Co-Pay [Demo]',
        transactionDate: '2026-10-20',
        notes: 'Monthly wellness membership',
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Software & Subscriptions'),
        transactionType: 'expense',
        amount: '49.00',
        description: 'Cloud Hosting, GitHub Pro & JetBrains [Demo]',
        transactionDate: '2026-10-22',
        notes: 'Developer tool stack',
      },
      {
        userId,
        accountId: cashAcc.id,
        categoryId: catByName('Groceries & Dining'),
        transactionType: 'expense',
        amount: '28.50',
        description: 'Union Square Farmers Market [Demo]',
        transactionDate: '2026-10-24',
        notes: 'Paid in cash',
      },
      {
        userId,
        accountId: checkingAcc.id,
        destinationAccountId: savingsAcc.id,
        categoryId: null,
        transactionType: 'transfer',
        amount: '1500.00',
        description: 'Automated Transfer to High-Yield Vault [Demo]',
        transactionDate: '2026-10-25',
        notes: 'Monthly wealth building transfer',
      },
    ];

    await db.insert(transactions).values(
      demoTxs.map((t) => ({
        ...t,
        externalHash: buildTransactionHash({
          transactionDate: t.transactionDate,
          description: t.description,
          transactionType: t.transactionType,
          amount: t.amount,
          accountNameOrId: t.accountId,
        }),
      }))
    );

    // 4. Insert monthly budgets for 2026-10 (including one healthy, one warning >=80%, one near/exceeded)
    const housingCatId = catByName('Housing & Rent');
    const groceriesCatId = catByName('Groceries & Dining');
    const utilitiesCatId = catByName('Utilities & Internet');
    const transportCatId = catByName('Transportation');
    const softwareCatId = catByName('Software & Subscriptions');

    const budgetValues = [];
    if (housingCatId) {
      budgetValues.push({
        userId,
        categoryId: housingCatId,
        month: '2026-10',
        amountLimit: '1850.00',
        alertThresholdPct: 90,
      });
    }
    if (groceriesCatId) {
      // Spent is 538.40 + 64.20 + 28.50 = 631.10 -> on 700.00 limit = 90.2% (Warning!)
      budgetValues.push({
        userId,
        categoryId: groceriesCatId,
        month: '2026-10',
        amountLimit: '700.00',
        alertThresholdPct: 80,
      });
    }
    if (utilitiesCatId) {
      budgetValues.push({
        userId,
        categoryId: utilitiesCatId,
        month: '2026-10',
        amountLimit: '200.00',
        alertThresholdPct: 80,
      });
    }
    if (transportCatId) {
      budgetValues.push({
        userId,
        categoryId: transportCatId,
        month: '2026-10',
        amountLimit: '220.00',
        alertThresholdPct: 80,
      });
    }
    if (softwareCatId) {
      // Spent 49.00 on 45.00 budget -> 108.9% (Exceeded!)
      budgetValues.push({
        userId,
        categoryId: softwareCatId,
        month: '2026-10',
        amountLimit: '45.00',
        alertThresholdPct: 80,
      });
    }

    if (budgetValues.length > 0) {
      await db.insert(budgets).values(budgetValues);
    }

    // 5. Insert Savings Goals + Contributions
    const insertedGoals = await db
      .insert(savingsGoals)
      .values([
        {
          userId,
          name: '6-Month Emergency Reserve',
          targetAmount: '25000.00',
          currentAmount: '20000.00',
          targetDate: '2027-03-31',
          accountId: savingsAcc.id,
          color: '#059669',
          status: 'active',
        },
        {
          userId,
          name: 'Kyoto & Tokyo Autumn Fund',
          targetAmount: '4500.00',
          currentAmount: '3150.00',
          targetDate: '2027-05-15',
          accountId: savingsAcc.id,
          color: '#0284c7',
          status: 'active',
        },
        {
          userId,
          name: 'Workstation M4 Max Upgrade',
          targetAmount: '3200.00',
          currentAmount: '3200.00',
          targetDate: '2026-11-01',
          accountId: checkingAcc.id,
          color: '#7c3aed',
          status: 'completed',
        },
      ])
      .returning();

    if (insertedGoals.length > 0) {
      await db.insert(goalContributions).values([
        {
          userId,
          goalId: insertedGoals[0].id,
          amount: '1500.00',
          contributionDate: '2026-10-25',
          note: 'October automated vault allocation',
        },
        {
          userId,
          goalId: insertedGoals[1].id,
          amount: '450.00',
          contributionDate: '2026-10-15',
          note: 'Consulting bonus allocation',
        },
      ]);
    }

    // 6. Insert Recurring Rules (one due today/past so user can test idempotent processing!)
    await db.insert(recurringRules).values([
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: housingCatId,
        transactionType: 'expense',
        amount: '1850.00',
        description: 'Avalon Bay Apartment Lease',
        frequency: 'monthly',
        nextDueDate: '2026-11-01',
        lastProcessedDate: '2026-10-01',
        isActive: true,
        reminderDaysBefore: 5,
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: catByName('Salary & Payroll'),
        transactionType: 'income',
        amount: '2900.00',
        description: 'End-of-Month Engineering Payroll',
        frequency: 'biweekly',
        nextDueDate: '2026-10-28',
        lastProcessedDate: null,
        isActive: true,
        reminderDaysBefore: 2,
      },
      {
        userId,
        accountId: checkingAcc.id,
        categoryId: utilitiesCatId,
        transactionType: 'expense',
        amount: '79.99',
        description: 'Sonic Gigabit Fiber Internet',
        frequency: 'monthly',
        nextDueDate: '2026-10-28',
        lastProcessedDate: null,
        isActive: true,
        reminderDaysBefore: 3,
      },
    ]);

    // 7. Insert Notifications
    await db.insert(notifications).values([
      {
        userId,
        title: 'Budget Threshold Reached: Groceries & Dining',
        message:
          'You have used 90.2% ($631.10 of $700.00) of your October Groceries & Dining budget.',
        notificationType: 'budget_warning',
        isRead: false,
      },
      {
        userId,
        title: 'Budget Exceeded: Software & Subscriptions',
        message:
          'October spending ($49.00) exceeded your $45.00 monthly budget by $4.00.',
        notificationType: 'budget_exceeded',
        isRead: false,
      },
      {
        userId,
        title: '2 Recurring Transactions Due Today',
        message:
          'End-of-Month Engineering Payroll ($2,900.00) and Sonic Gigabit Fiber Internet ($79.99) are ready for idempotent processing.',
        notificationType: 'recurring_due',
        isRead: false,
      },
      {
        userId,
        title: 'Savings Goal Completed: Workstation M4 Max Upgrade',
        message:
          'Congratulations! You reached 100% of your $3,200.00 target ahead of schedule.',
        notificationType: 'goal_milestone',
        isRead: true,
      },
    ]);

    await logAuditEvent(
      userId,
      'SEED_DEMO_FIXTURES',
      'Workspace',
      userId,
      'Initialized isolated SmartSpend demo ledger fixtures.'
    );
  } catch (error) {
    console.error('Database query failed in seedUserInitialWorkspace:', error);
    throw new Error('Failed to initialize workspace data.', { cause: error });
  }
}

export async function getFullUserWorkspace(userId: number) {
  try {
    const [
      userRows,
      userAccounts,
      userCategories,
      userTransactions,
      userBudgets,
      userGoals,
      userContributions,
      userRecurring,
      userNotifications,
      userAudits,
    ] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)),
      db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, userId))
        .orderBy(accounts.id),
      db
        .select()
        .from(categories)
        .where(eq(categories.userId, userId))
        .orderBy(categories.name),
      db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.transactionDate), desc(transactions.id)),
      db
        .select()
        .from(budgets)
        .where(eq(budgets.userId, userId))
        .orderBy(budgets.id),
      db
        .select()
        .from(savingsGoals)
        .where(eq(savingsGoals.userId, userId))
        .orderBy(savingsGoals.id),
      db
        .select()
        .from(goalContributions)
        .where(eq(goalContributions.userId, userId))
        .orderBy(desc(goalContributions.contributionDate)),
      db
        .select()
        .from(recurringRules)
        .where(eq(recurringRules.userId, userId))
        .orderBy(recurringRules.nextDueDate),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.id)),
      db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.userId, userId))
        .orderBy(desc(auditEvents.id))
        .limit(40),
    ]);

    return {
      profile: userRows[0],
      accounts: userAccounts,
      categories: userCategories,
      transactions: userTransactions,
      budgets: userBudgets,
      savingsGoals: userGoals,
      goalContributions: userContributions,
      recurringRules: userRecurring,
      notifications: userNotifications,
      auditEvents: userAudits,
    };
  } catch (error) {
    console.error('Database query failed in getFullUserWorkspace:', error);
    throw new Error('Failed to load financial workspace from PostgreSQL.', {
      cause: error,
    });
  }
}

export async function processDueRecurringForUser(
  userId: number,
  asOfDate: string
) {
  try {
    const rules = await db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.userId, userId));

    const dueRules = rules.filter(
      (r) =>
        r.isActive &&
        r.nextDueDate <= asOfDate &&
        r.lastProcessedDate !== r.nextDueDate
    );

    const generatedTransactions = [];

    for (const rule of dueRules) {
      const dueDateBeingProcessed = rule.nextDueDate;
      const hash = `recurring:${rule.id}:${dueDateBeingProcessed}`;

      // Check idempotency in transactions table
      const existing = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.externalHash, hash)
          )
        );

      if (existing.length === 0) {
        const [insertedTx] = await db
          .insert(transactions)
          .values({
            userId,
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            transactionType: rule.transactionType,
            amount: fromCents(toCents(rule.amount)),
            description: `${rule.description} (Recurring)`,
            transactionDate: dueDateBeingProcessed,
            notes: `Auto-generated from ${rule.frequency} rule #${rule.id}`,
            recurringRuleId: rule.id,
            externalHash: hash,
          })
          .returning();
        generatedTransactions.push(insertedTx);
      }

      const nextDate = computeNextDueDate(
        dueDateBeingProcessed,
        rule.frequency as 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
      );

      await db
        .update(recurringRules)
        .set({
          lastProcessedDate: dueDateBeingProcessed,
          nextDueDate: nextDate,
        })
        .where(
          and(eq(recurringRules.id, rule.id), eq(recurringRules.userId, userId))
        );
    }

    if (generatedTransactions.length > 0) {
      await db.insert(notifications).values({
        userId,
        title: `Processed ${generatedTransactions.length} Recurring Transaction(s)`,
        message: `Idempotent processor posted ${generatedTransactions.length} scheduled transaction(s) and advanced next due dates.`,
        notificationType: 'system',
        isRead: false,
      });

      await logAuditEvent(
        userId,
        'PROCESS_RECURRING_RULES',
        'RecurringRule',
        'batch',
        `Processed ${generatedTransactions.length} due rules as of ${asOfDate}`
      );
    }

    return {
      processedCount: generatedTransactions.length,
      transactions: generatedTransactions,
    };
  } catch (error) {
    console.error('Database query failed in processDueRecurringForUser:', error);
    throw new Error('Failed to process recurring transactions.', {
      cause: error,
    });
  }
}
