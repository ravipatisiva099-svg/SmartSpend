import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull().default('Alex Morgan'),
  currency: text('currency').notNull().default('USD'),
  timezone: text('timezone').notNull().default('America/New_York'),
  dateFormat: text('date_format').notNull().default('YYYY-MM-DD'),
  emailAlerts: boolean('email_alerts').notNull().default(true),
  budgetThresholdPct: integer('budget_threshold_pct').notNull().default(80),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  accountType: text('account_type').notNull(), // 'bank' | 'cash' | 'wallet'
  openingBalance: text('opening_balance').notNull().default('0.00'),
  currency: text('currency').notNull().default('USD'),
  institution: text('institution').notNull().default(''),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  categoryType: text('category_type').notNull(), // 'income' | 'expense'
  color: text('color').notNull().default('#059669'),
  icon: text('icon').notNull().default('tag'),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: integer('account_id')
    .references(() => accounts.id, { onDelete: 'restrict' })
    .notNull(),
  destinationAccountId: integer('destination_account_id').references(
    () => accounts.id,
    { onDelete: 'restrict' }
  ),
  categoryId: integer('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  transactionType: text('transaction_type').notNull(), // 'income' | 'expense' | 'transfer'
  amount: text('amount').notNull(), // Decimal string e.g. "125.50"
  description: text('description').notNull(),
  transactionDate: text('transaction_date').notNull(), // YYYY-MM-DD
  notes: text('notes').notNull().default(''),
  recurringRuleId: integer('recurring_rule_id'),
  externalHash: text('external_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const budgets = pgTable('budgets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'cascade' })
    .notNull(),
  month: text('month').notNull(), // YYYY-MM
  amountLimit: text('amount_limit').notNull(), // Decimal string
  alertThresholdPct: integer('alert_threshold_pct').notNull().default(80),
  createdAt: timestamp('created_at').defaultNow(),
});

export const savingsGoals = pgTable('savings_goals', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  targetAmount: text('target_amount').notNull(),
  currentAmount: text('current_amount').notNull().default('0.00'),
  targetDate: text('target_date').notNull(), // YYYY-MM-DD
  accountId: integer('account_id').references(() => accounts.id, {
    onDelete: 'set null',
  }),
  color: text('color').notNull().default('#059669'),
  status: text('status').notNull().default('active'), // 'active' | 'completed' | 'paused'
  createdAt: timestamp('created_at').defaultNow(),
});

export const goalContributions = pgTable('goal_contributions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  goalId: integer('goal_id')
    .references(() => savingsGoals.id, { onDelete: 'cascade' })
    .notNull(),
  amount: text('amount').notNull(),
  contributionDate: text('contribution_date').notNull(),
  note: text('note').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const recurringRules = pgTable('recurring_rules', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  accountId: integer('account_id')
    .references(() => accounts.id, { onDelete: 'cascade' })
    .notNull(),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'set null' }),
  transactionType: text('transaction_type').notNull(), // 'income' | 'expense'
  amount: text('amount').notNull(),
  description: text('description').notNull(),
  frequency: text('frequency').notNull(), // 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  nextDueDate: text('next_due_date').notNull(), // YYYY-MM-DD
  lastProcessedDate: text('last_processed_date'),
  isActive: boolean('is_active').notNull().default(true),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(3),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  notificationType: text('notification_type').notNull(), // 'budget_warning' | 'budget_exceeded' | 'recurring_due' | 'goal_milestone' | 'security' | 'system'
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditEvents = pgTable('audit_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull().default(''),
  details: text('details').notNull().default(''),
  ipAddress: text('ip_address').notNull().default('127.0.0.1'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  budgets: many(budgets),
  savingsGoals: many(savingsGoals),
  recurringRules: many(recurringRules),
  notifications: many(notifications),
  auditEvents: many(auditEvents),
}));
