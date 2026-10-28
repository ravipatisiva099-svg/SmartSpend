import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  seedUserInitialWorkspace,
  getFullUserWorkspace,
  processDueRecurringForUser,
  logAuditEvent,
} from './src/db/repository.ts';
import { db } from './src/db/index.ts';
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
} from './src/db/schema.ts';
import {
  validateMonetaryAmount,
  isValidIsoDate,
  toCents,
  fromCents,
  buildTransactionHash,
} from './src/utils/financeRules.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Helper to resolve DB user from authenticated request
  async function resolveDbUser(req: AuthRequest) {
    if (!req.user) {
      throw new Error('Unauthorized request');
    }
    return await getOrCreateUser(
      req.user.uid,
      req.user.email,
      req.user.name || 'Alex Morgan'
    );
  }

  // GET /api/workspace — Loads all user-owned PostgreSQL records
  app.get('/api/workspace', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const isSeedRequested = req.query.seed === 'true' || dbUser.uid.startsWith('demo');
      await seedUserInitialWorkspace(dbUser.id, isSeedRequested);
      const workspace = await getFullUserWorkspace(dbUser.id);
      res.json(workspace);
    } catch (error: any) {
      console.error('Failed to fetch workspace:', error);
      res.status(500).json({
        error: error.message || 'Failed to load workspace data',
      });
    }
  });

  // POST /api/demo/reset — Reloads clean demo data for the current user
  app.post('/api/demo/reset', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      await db.delete(transactions).where(eq(transactions.userId, dbUser.id));
      await db.delete(goalContributions).where(eq(goalContributions.userId, dbUser.id));
      await db.delete(savingsGoals).where(eq(savingsGoals.userId, dbUser.id));
      await db.delete(budgets).where(eq(budgets.userId, dbUser.id));
      await db.delete(recurringRules).where(eq(recurringRules.userId, dbUser.id));
      await db.delete(notifications).where(eq(notifications.userId, dbUser.id));
      await db.delete(accounts).where(eq(accounts.userId, dbUser.id));
      await db.delete(categories).where(eq(categories.userId, dbUser.id));

      await seedUserInitialWorkspace(dbUser.id, true);
      const workspace = await getFullUserWorkspace(dbUser.id);
      res.json(workspace);
    } catch (error: any) {
      console.error('Failed to reset demo data:', error);
      res.status(500).json({ error: error.message || 'Failed to reset demo data' });
    }
  });

  // ACCOUNTS CRUD
  app.post('/api/accounts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const { name, accountType, openingBalance, currency, institution } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Account name is required.' });
      }
      if (!['bank', 'cash', 'wallet'].includes(accountType)) {
        return res.status(400).json({ error: 'Account type must be bank, cash, or wallet.' });
      }
      const openCents = toCents(openingBalance ?? '0.00');
      if (openCents < 0) {
        return res.status(400).json({ error: 'Opening balance cannot be negative.' });
      }

      const [created] = await db
        .insert(accounts)
        .values({
          userId: dbUser.id,
          name: String(name).trim(),
          accountType,
          openingBalance: fromCents(openCents),
          currency: currency || dbUser.currency || 'USD',
          institution: String(institution || '').trim(),
          isArchived: false,
        })
        .returning();

      await logAuditEvent(
        dbUser.id,
        'CREATE_ACCOUNT',
        'Account',
        created.id,
        `Created ${accountType} account "${created.name}" with opening balance $${created.openingBalance}`
      );
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create account:', error);
      res.status(500).json({ error: error.message || 'Failed to create account' });
    }
  });

  app.put('/api/accounts/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const accountId = Number(req.params.id);
      const { name, accountType, openingBalance, currency, institution, isArchived } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Account name is required.' });
      }

      const [updated] = await db
        .update(accounts)
        .set({
          name: String(name).trim(),
          accountType: accountType || 'bank',
          openingBalance: fromCents(toCents(openingBalance ?? '0.00')),
          ...(currency ? { currency: String(currency).trim() } : {}),
          institution: String(institution || '').trim(),
          isArchived: Boolean(isArchived),
        })
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, dbUser.id)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      await logAuditEvent(
        dbUser.id,
        'UPDATE_ACCOUNT',
        'Account',
        accountId,
        `Updated account "${updated.name}"`
      );
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update account:', error);
      res.status(500).json({ error: error.message || 'Failed to update account' });
    }
  });

  app.delete('/api/accounts/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const accountId = Number(req.params.id);

      // Check financial integrity before deleting
      const linkedTxs = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, dbUser.id),
            eq(transactions.accountId, accountId)
          )
        );

      if (linkedTxs.length > 0) {
        return res.status(400).json({
          error: `Cannot delete account with ${linkedTxs.length} existing transaction(s). Archive the account or reassign its transactions first to preserve ledger integrity.`,
        });
      }

      await db
        .delete(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, dbUser.id)));

      await logAuditEvent(
        dbUser.id,
        'DELETE_ACCOUNT',
        'Account',
        accountId,
        `Deleted account #${accountId}`
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      res.status(500).json({ error: error.message || 'Failed to delete account' });
    }
  });

  // CATEGORIES CRUD
  app.post('/api/categories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const { name, categoryType, color, icon } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Category name is required.' });
      }
      if (!['income', 'expense'].includes(categoryType)) {
        return res.status(400).json({ error: 'Category type must be income or expense.' });
      }

      const [created] = await db
        .insert(categories)
        .values({
          userId: dbUser.id,
          name: String(name).trim(),
          categoryType,
          color: color || '#059669',
          icon: icon || 'tag',
          isSystem: false,
        })
        .returning();

      await logAuditEvent(
        dbUser.id,
        'CREATE_CATEGORY',
        'Category',
        created.id,
        `Created ${categoryType} category "${created.name}"`
      );
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create category:', error);
      res.status(500).json({ error: error.message || 'Failed to create category' });
    }
  });

  app.delete('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const categoryId = Number(req.params.id);

      await db
        .delete(categories)
        .where(and(eq(categories.id, categoryId), eq(categories.userId, dbUser.id)));

      await logAuditEvent(
        dbUser.id,
        'DELETE_CATEGORY',
        'Category',
        categoryId,
        `Deleted category #${categoryId}`
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      res.status(500).json({ error: error.message || 'Failed to delete category' });
    }
  });

  // TRANSACTIONS CRUD & CSV IMPORT
  app.post('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const {
        accountId,
        destinationAccountId,
        categoryId,
        transactionType,
        amount,
        description,
        transactionDate,
        notes,
      } = req.body;

      if (!description || !String(description).trim()) {
        return res.status(400).json({ error: 'Transaction description is required.' });
      }
      if (!['income', 'expense', 'transfer'].includes(transactionType)) {
        return res.status(400).json({ error: 'Invalid transaction type.' });
      }
      if (!isValidIsoDate(String(transactionDate || ''))) {
        return res.status(400).json({ error: 'Valid YYYY-MM-DD date is required.' });
      }
      const amtCheck = validateMonetaryAmount(amount);
      if (!amtCheck.valid) {
        return res.status(400).json({ error: amtCheck.error });
      }
      if (
        transactionType === 'transfer' &&
        (!destinationAccountId || Number(destinationAccountId) === Number(accountId))
      ) {
        return res.status(400).json({
          error: 'Transfers require a distinct destination account.',
        });
      }

      const [created] = await db
        .insert(transactions)
        .values({
          userId: dbUser.id,
          accountId: Number(accountId),
          destinationAccountId:
            transactionType === 'transfer' && destinationAccountId
              ? Number(destinationAccountId)
              : null,
          categoryId:
            transactionType !== 'transfer' && categoryId ? Number(categoryId) : null,
          transactionType,
          amount: amtCheck.normalized,
          description: String(description).trim(),
          transactionDate: String(transactionDate),
          notes: String(notes || '').trim(),
          externalHash: buildTransactionHash({
            transactionDate: String(transactionDate),
            description: String(description),
            transactionType,
            amount: amtCheck.normalized,
            accountNameOrId: Number(accountId),
          }),
        })
        .returning();

      await logAuditEvent(
        dbUser.id,
        'CREATE_TRANSACTION',
        'Transaction',
        created.id,
        `Recorded ${transactionType} of $${created.amount} ("${created.description}")`
      );
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create transaction:', error);
      res.status(500).json({ error: error.message || 'Failed to create transaction' });
    }
  });

  app.put('/api/transactions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const txId = Number(req.params.id);
      const {
        accountId,
        destinationAccountId,
        categoryId,
        transactionType,
        amount,
        description,
        transactionDate,
        notes,
      } = req.body;

      const amtCheck = validateMonetaryAmount(amount);
      if (!amtCheck.valid) {
        return res.status(400).json({ error: amtCheck.error });
      }
      if (!description || !String(description).trim()) {
        return res.status(400).json({ error: 'Description is required.' });
      }
      if (!isValidIsoDate(String(transactionDate || ''))) {
        return res.status(400).json({ error: 'Valid YYYY-MM-DD date is required.' });
      }

      const [updated] = await db
        .update(transactions)
        .set({
          accountId: Number(accountId),
          destinationAccountId:
            transactionType === 'transfer' && destinationAccountId
              ? Number(destinationAccountId)
              : null,
          categoryId:
            transactionType !== 'transfer' && categoryId ? Number(categoryId) : null,
          transactionType,
          amount: amtCheck.normalized,
          description: String(description).trim(),
          transactionDate: String(transactionDate),
          notes: String(notes || '').trim(),
        })
        .where(and(eq(transactions.id, txId), eq(transactions.userId, dbUser.id)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Transaction not found.' });
      }

      await logAuditEvent(
        dbUser.id,
        'UPDATE_TRANSACTION',
        'Transaction',
        txId,
        `Updated transaction #${txId} ("${updated.description}")`
      );
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update transaction:', error);
      res.status(500).json({ error: error.message || 'Failed to update transaction' });
    }
  });

  app.delete('/api/transactions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const txId = Number(req.params.id);

      await db
        .delete(transactions)
        .where(and(eq(transactions.id, txId), eq(transactions.userId, dbUser.id)));

      await logAuditEvent(
        dbUser.id,
        'DELETE_TRANSACTION',
        'Transaction',
        txId,
        `Deleted transaction #${txId}`
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete transaction:', error);
      res.status(500).json({ error: error.message || 'Failed to delete transaction' });
    }
  });

  app.post('/api/transactions/import', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No valid rows provided for import.' });
      }

      const inserted = await db
        .insert(transactions)
        .values(
          rows.map((r: any) => ({
            userId: dbUser.id,
            accountId: Number(r.accountId),
            categoryId: r.categoryId ? Number(r.categoryId) : null,
            transactionType: r.transactionType,
            amount: fromCents(toCents(r.amount)),
            description: String(r.description).trim(),
            transactionDate: String(r.transactionDate),
            notes: String(r.notes || '').trim(),
            externalHash: r.externalHash || null,
          }))
        )
        .returning();

      await logAuditEvent(
        dbUser.id,
        'CSV_IMPORT',
        'Transaction',
        'batch',
        `Imported ${inserted.length} validated CSV transaction(s)`
      );
      res.status(201).json({ importedCount: inserted.length, transactions: inserted });
    } catch (error: any) {
      console.error('Failed to import CSV transactions:', error);
      res.status(500).json({ error: error.message || 'Failed to import CSV transactions' });
    }
  });

  // BUDGETS CRUD
  app.post('/api/budgets', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const { categoryId, month, amountLimit, alertThresholdPct } = req.body;
      const amtCheck = validateMonetaryAmount(amountLimit);
      if (!amtCheck.valid) {
        return res.status(400).json({ error: amtCheck.error });
      }
      if (!/^\d{4}-\d{2}$/.test(String(month || ''))) {
        return res.status(400).json({ error: 'Month must be in YYYY-MM format.' });
      }

      // Check if budget already exists for this category & month
      const existing = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, dbUser.id),
            eq(budgets.categoryId, Number(categoryId)),
            eq(budgets.month, String(month))
          )
        );

      if (existing.length > 0) {
        const [updated] = await db
          .update(budgets)
          .set({
            amountLimit: amtCheck.normalized,
            alertThresholdPct: Number(alertThresholdPct || 80),
          })
          .where(eq(budgets.id, existing[0].id))
          .returning();
        return res.json(updated);
      }

      const [created] = await db
        .insert(budgets)
        .values({
          userId: dbUser.id,
          categoryId: Number(categoryId),
          month: String(month),
          amountLimit: amtCheck.normalized,
          alertThresholdPct: Number(alertThresholdPct || 80),
        })
        .returning();

      await logAuditEvent(
        dbUser.id,
        'SET_BUDGET',
        'Budget',
        created.id,
        `Set ${month} budget of $${created.amountLimit} for category #${categoryId}`
      );
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to save budget:', error);
      res.status(500).json({ error: error.message || 'Failed to save budget' });
    }
  });

  app.delete('/api/budgets/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const budgetId = Number(req.params.id);
      await db
        .delete(budgets)
        .where(and(eq(budgets.id, budgetId), eq(budgets.userId, dbUser.id)));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete budget:', error);
      res.status(500).json({ error: error.message || 'Failed to delete budget' });
    }
  });

  // SAVINGS GOALS & CONTRIBUTIONS
  app.post('/api/goals', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const { name, targetAmount, currentAmount, targetDate, accountId, color } =
        req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Goal name is required.' });
      }
      const targetCheck = validateMonetaryAmount(targetAmount);
      if (!targetCheck.valid) {
        return res.status(400).json({ error: targetCheck.error });
      }
      if (!isValidIsoDate(String(targetDate || ''))) {
        return res.status(400).json({ error: 'Valid target date (YYYY-MM-DD) is required.' });
      }
      const currentCents = Math.max(0, toCents(currentAmount ?? '0.00'));
      const status =
        currentCents >= toCents(targetCheck.normalized) ? 'completed' : 'active';

      const [created] = await db
        .insert(savingsGoals)
        .values({
          userId: dbUser.id,
          name: String(name).trim(),
          targetAmount: targetCheck.normalized,
          currentAmount: fromCents(currentCents),
          targetDate: String(targetDate),
          accountId: accountId ? Number(accountId) : null,
          color: color || '#059669',
          status,
        })
        .returning();

      await logAuditEvent(
        dbUser.id,
        'CREATE_GOAL',
        'SavingsGoal',
        created.id,
        `Created savings goal "${created.name}" with target $${created.targetAmount}`
      );
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create savings goal:', error);
      res.status(500).json({ error: error.message || 'Failed to create savings goal' });
    }
  });

  app.post('/api/goals/:id/contribute', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const goalId = Number(req.params.id);
      const { amount, contributionDate, note } = req.body;

      const amtCheck = validateMonetaryAmount(amount);
      if (!amtCheck.valid) {
        return res.status(400).json({ error: amtCheck.error });
      }

      const existingGoals = await db
        .select()
        .from(savingsGoals)
        .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, dbUser.id)));

      if (existingGoals.length === 0) {
        return res.status(404).json({ error: 'Savings goal not found.' });
      }

      const goal = existingGoals[0];
      const newCurrentCents = toCents(goal.currentAmount) + toCents(amtCheck.normalized);
      const targetCents = toCents(goal.targetAmount);
      const newStatus = newCurrentCents >= targetCents ? 'completed' : goal.status;

      const [contribution] = await db
        .insert(goalContributions)
        .values({
          userId: dbUser.id,
          goalId,
          amount: amtCheck.normalized,
          contributionDate:
            contributionDate && isValidIsoDate(contributionDate)
              ? contributionDate
              : new Date().toISOString().slice(0, 10),
          note: String(note || '').trim(),
        })
        .returning();

      const [updatedGoal] = await db
        .update(savingsGoals)
        .set({
          currentAmount: fromCents(newCurrentCents),
          status: newStatus,
        })
        .where(eq(savingsGoals.id, goalId))
        .returning();

      await logAuditEvent(
        dbUser.id,
        'CONTRIBUTE_GOAL',
        'SavingsGoal',
        goalId,
        `Added $${amtCheck.normalized} contribution to "${goal.name}"`
      );
      res.json({ goal: updatedGoal, contribution });
    } catch (error: any) {
      console.error('Failed to add goal contribution:', error);
      res.status(500).json({ error: error.message || 'Failed to add contribution' });
    }
  });

  app.delete('/api/goals/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const goalId = Number(req.params.id);
      await db
        .delete(savingsGoals)
        .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.userId, dbUser.id)));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete goal:', error);
      res.status(500).json({ error: error.message || 'Failed to delete goal' });
    }
  });

  // RECURRING RULES CRUD & IDEMPOTENT PROCESSING
  app.post('/api/recurring', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const {
        accountId,
        categoryId,
        transactionType,
        amount,
        description,
        frequency,
        nextDueDate,
        reminderDaysBefore,
      } = req.body;

      if (!description || !String(description).trim()) {
        return res.status(400).json({ error: 'Description is required.' });
      }
      const amtCheck = validateMonetaryAmount(amount);
      if (!amtCheck.valid) {
        return res.status(400).json({ error: amtCheck.error });
      }
      if (!isValidIsoDate(String(nextDueDate || ''))) {
        return res.status(400).json({ error: 'Valid next due date is required.' });
      }

      const [created] = await db
        .insert(recurringRules)
        .values({
          userId: dbUser.id,
          accountId: Number(accountId),
          categoryId: categoryId ? Number(categoryId) : null,
          transactionType: transactionType === 'income' ? 'income' : 'expense',
          amount: amtCheck.normalized,
          description: String(description).trim(),
          frequency: frequency || 'monthly',
          nextDueDate: String(nextDueDate),
          lastProcessedDate: null,
          isActive: true,
          reminderDaysBefore: Number(reminderDaysBefore ?? 3),
        })
        .returning();

      await logAuditEvent(
        dbUser.id,
        'CREATE_RECURRING_RULE',
        'RecurringRule',
        created.id,
        `Created ${created.frequency} rule "${created.description}" ($${created.amount})`
      );
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create recurring rule:', error);
      res.status(500).json({ error: error.message || 'Failed to create recurring rule' });
    }
  });

  app.put('/api/recurring/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const ruleId = Number(req.params.id);
      const { transactionType, amount, description, frequency, nextDueDate } = req.body;

      const updateFields: Record<string, any> = {};
      if (transactionType === 'income' || transactionType === 'expense') {
        updateFields.transactionType = transactionType;
      }
      if (amount !== undefined) {
        const amtCheck = validateMonetaryAmount(amount);
        if (!amtCheck.valid) {
          return res.status(400).json({ error: amtCheck.error });
        }
        updateFields.amount = amtCheck.normalized;
      }
      if (description && String(description).trim()) {
        updateFields.description = String(description).trim();
      }
      if (frequency) {
        updateFields.frequency = frequency;
      }
      if (nextDueDate && isValidIsoDate(String(nextDueDate))) {
        updateFields.nextDueDate = String(nextDueDate);
      }

      const [updated] = await db
        .update(recurringRules)
        .set(updateFields)
        .where(and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, dbUser.id)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Recurring rule not found.' });
      }

      await logAuditEvent(
        dbUser.id,
        'UPDATE_RECURRING_RULE',
        'RecurringRule',
        ruleId,
        `Updated recurring rule #${ruleId} (${updated.transactionType} $${updated.amount})`
      );
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update recurring rule:', error);
      res.status(500).json({ error: error.message || 'Failed to update recurring rule' });
    }
  });

  app.put('/api/recurring/:id/toggle', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const ruleId = Number(req.params.id);
      const { isActive } = req.body;

      const [updated] = await db
        .update(recurringRules)
        .set({ isActive: Boolean(isActive) })
        .where(and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, dbUser.id)))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error('Failed to toggle recurring rule:', error);
      res.status(500).json({ error: error.message || 'Failed to toggle rule' });
    }
  });

  app.delete('/api/recurring/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const ruleId = Number(req.params.id);
      await db
        .delete(recurringRules)
        .where(and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, dbUser.id)));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete recurring rule:', error);
      res.status(500).json({ error: error.message || 'Failed to delete recurring rule' });
    }
  });

  app.post('/api/recurring/process', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const asOfDate =
        req.body.asOfDate && isValidIsoDate(req.body.asOfDate)
          ? req.body.asOfDate
          : '2026-10-28';
      const result = await processDueRecurringForUser(dbUser.id, asOfDate);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to process recurring rules:', error);
      res.status(500).json({ error: error.message || 'Failed to process recurring rules' });
    }
  });

  // NOTIFICATIONS
  app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, dbUser.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to mark notifications read:', error);
      res.status(500).json({ error: error.message || 'Failed to update notifications' });
    }
  });

  app.put('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const notifId = Number(req.params.id);
      const [updated] = await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(eq(notifications.id, notifId), eq(notifications.userId, dbUser.id))
        )
        .returning();
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to mark notification read:', error);
      res.status(500).json({ error: error.message || 'Failed to update notification' });
    }
  });

  // PROFILE, PREFERENCES & SECURITY SETTINGS
  app.put('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await resolveDbUser(req);
      const {
        fullName,
        currency,
        timezone,
        dateFormat,
        emailAlerts,
        budgetThresholdPct,
        twoFactorEnabled,
      } = req.body;

      const [updated] = await db
        .update(users)
        .set({
          fullName: fullName !== undefined ? String(fullName).trim() : dbUser.fullName,
          currency: currency || dbUser.currency,
          timezone: timezone || dbUser.timezone,
          dateFormat: dateFormat || dbUser.dateFormat,
          emailAlerts:
            emailAlerts !== undefined ? Boolean(emailAlerts) : dbUser.emailAlerts,
          budgetThresholdPct:
            budgetThresholdPct !== undefined
              ? Number(budgetThresholdPct)
              : dbUser.budgetThresholdPct,
          twoFactorEnabled:
            twoFactorEnabled !== undefined
              ? Boolean(twoFactorEnabled)
              : dbUser.twoFactorEnabled,
        })
        .where(eq(users.id, dbUser.id))
        .returning();

      await logAuditEvent(
        dbUser.id,
        'UPDATE_PROFILE_SETTINGS',
        'User',
        dbUser.id,
        'Updated profile, preferences, or security settings'
      );
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      res.status(500).json({ error: error.message || 'Failed to update profile' });
    }
  });

  // Vite middleware for development; static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartSpend server listening on http://localhost:${PORT}`);
  });
}

startServer();
