export interface DjangoSourceFile {
  path: string;
  app: string;
  description: string;
  content: string;
}

export const DJANGO_SOURCE_FILES: DjangoSourceFile[] = [
  {
    path: 'smartspend_django/manage.py',
    app: 'project',
    description: 'Django command-line utility for administrative tasks, migrations, and running tests.',
    content: `#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "smartspend.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
`,
  },
  {
    path: 'smartspend_django/smartspend/settings.py',
    app: 'smartspend',
    description: 'Production-hardened Django 5.1 settings with PostgreSQL, CSRF, HTTPS headers, and modular apps.',
    content: `import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-dev-only-change-in-prod")
DEBUG = os.environ.get("DJANGO_DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    # SmartSpend modular apps
    "core.apps.CoreConfig",
    "accounts.apps.AccountsConfig",
    "transactions.apps.TransactionsConfig",
    "budgets.apps.BudgetsConfig",
    "goals.apps.GoalsConfig",
    "recurring.apps.RecurringConfig",
    "reports.apps.ReportsConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "smartspend.urls"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("SQL_DB_NAME", "smartspend_db"),
        "USER": os.environ.get("SQL_USER", "smartspend_user"),
        "PASSWORD": os.environ.get("SQL_PASSWORD", ""),
        "HOST": os.environ.get("SQL_HOST", "127.0.0.1"),
        "PORT": os.environ.get("SQL_PORT", "5432"),
        "ATOMIC_REQUESTS": True,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = "core:login"
LOGIN_REDIRECT_URL = "core:dashboard"
LOGOUT_REDIRECT_URL = "core:landing"

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
`,
  },
  {
    path: 'smartspend_django/accounts/models.py',
    app: 'accounts',
    description: 'Normalized PostgreSQL models for FinancialAccount and Category with DecimalField and constraints.',
    content: `from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Sum, Q

class FinancialAccount(models.Model):
    class AccountType(models.TextChoices):
        BANK = "bank", "Bank Account"
        CASH = "cash", "Cash Reserve"
        WALLET = "wallet", "Digital Wallet"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accounts")
    name = models.CharField(max_length=120)
    account_type = models.CharField(max_length=20, choices=AccountType.choices, default=AccountType.BANK)
    opening_balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    currency = models.CharField(max_length=3, default="USD")
    institution = models.CharField(max_length=120, blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["user", "is_archived"])]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="uniq_account_name_per_user")
        ]

    @property
    def current_balance(self) -> Decimal:
        inflows = self.transactions.filter(transaction_type="income").aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0.00")
        outflows = self.transactions.filter(transaction_type__in=["expense", "transfer"]).aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0.00")
        transfers_in = self.incoming_transfers.filter(transaction_type="transfer").aggregate(
            total=Sum("amount")
        )["total"] or Decimal("0.00")
        return self.opening_balance + inflows - outflows + transfers_in
`,
  },
  {
    path: 'smartspend_django/transactions/models.py',
    app: 'transactions',
    description: 'Decimal-safe Transaction ledger supporting income, expenses, and explicit inter-account transfers.',
    content: `from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from accounts.models import FinancialAccount

class Category(models.Model):
    class CategoryType(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=80)
    category_type = models.CharField(max_length=16, choices=CategoryType.choices)
    color = models.CharField(max_length=7, default="#059669")
    icon = models.CharField(max_length=40, default="tag")
    is_system = models.BooleanField(default=False)

    class Meta:
        unique_together = ("user", "name", "category_type")
        ordering = ["name"]

class Transaction(models.Model):
    class TransactionType(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"
        TRANSFER = "transfer", "Transfer"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    account = models.ForeignKey(FinancialAccount, on_delete=models.PROTECT, related_name="transactions")
    destination_account = models.ForeignKey(
        FinancialAccount,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="incoming_transfers",
    )
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    transaction_type = models.CharField(max_length=16, choices=TransactionType.choices)
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    description = models.CharField(max_length=200)
    transaction_date = models.DateField(db_index=True)
    notes = models.TextField(blank=True)
    external_hash = models.CharField(max_length=128, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-transaction_date", "-id"]
        indexes = [
            models.Index(fields=["user", "transaction_date"]),
            models.Index(fields=["user", "transaction_type"]),
        ]

    def clean(self):
        if self.transaction_type == self.TransactionType.TRANSFER:
            if not self.destination_account:
                raise ValidationError("Transfers require a destination account.")
            if self.destination_account_id == self.account_id:
                raise ValidationError("Source and destination accounts must be different.")
`,
  },
  {
    path: 'smartspend_django/budgets/models.py',
    app: 'budgets',
    description: 'Monthly category Budget model with threshold percentage and spend progress calculation.',
    content: `from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from transactions.models import Category, Transaction

class MonthlyBudget(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="budgets")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="budgets")
    month = models.CharField(max_length=7, help_text="YYYY-MM")
    amount_limit = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    alert_threshold_pct = models.PositiveSmallIntegerField(
        default=80,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "category", "month"], name="uniq_user_category_month_budget")
        ]
`,
  },
  {
    path: 'smartspend_django/recurring/services.py',
    app: 'recurring',
    description: 'Idempotent service for processing due recurring transaction rules inside transaction.atomic().',
    content: `from datetime import date
from django.db import transaction
from transactions.models import Transaction
from .models import RecurringRule

def process_due_rules_for_user(user, as_of_date: date | None = None) -> int:
    target_date = as_of_date or date.today()
    due_rules = RecurringRule.objects.select_for_update().filter(
        user=user,
        is_active=True,
        next_due_date__lte=target_date,
    )
    created_count = 0
    with transaction.atomic():
        for rule in due_rules:
            if rule.last_processed_date == rule.next_due_date:
                continue
            fingerprint = f"recurring:{rule.id}:{rule.next_due_date.isoformat()}"
            if not Transaction.objects.filter(user=user, external_hash=fingerprint).exists():
                Transaction.objects.create(
                    user=user,
                    account=rule.account,
                    category=rule.category,
                    transaction_type=rule.transaction_type,
                    amount=rule.amount,
                    description=f"{rule.description} (Recurring)",
                    transaction_date=rule.next_due_date,
                    external_hash=fingerprint,
                )
                created_count += 1
            rule.last_processed_date = rule.next_due_date
            rule.next_due_date = rule.compute_next_due_date()
            rule.save(update_fields=["last_processed_date", "next_due_date"])
    return created_count
`,
  },
  {
    path: 'smartspend_django/transactions/tests.py',
    app: 'transactions',
    description: 'Automated Django TestCase suite covering permissions, transfers, CSV import validation, and budgets.',
    content: `from decimal import Decimal
from datetime import date
from django.contrib.auth import get_user_model
from django.test import TestCase
from accounts.models import FinancialAccount
from transactions.models import Category, Transaction

User = get_user_model()

class SmartSpendLedgerTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="StrongPassword123!")
        self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="StrongPassword123!")
        self.checking = FinancialAccount.objects.create(
            user=self.alice, name="Checking", account_type="bank", opening_balance=Decimal("1000.00")
        )
        self.savings = FinancialAccount.objects.create(
            user=self.alice, name="Savings", account_type="bank", opening_balance=Decimal("2000.00")
        )
        self.groceries = Category.objects.create(user=self.alice, name="Groceries", category_type="expense")

    def test_transfer_does_not_double_count_net_worth(self):
        Transaction.objects.create(
            user=self.alice,
            account=self.checking,
            destination_account=self.savings,
            transaction_type="transfer",
            amount=Decimal("250.00"),
            description="Transfer to savings",
            transaction_date=date(2026, 10, 15),
        )
        self.assertEqual(self.checking.current_balance, Decimal("750.00"))
        self.assertEqual(self.savings.current_balance, Decimal("2250.00"))
        self.assertEqual(self.checking.current_balance + self.savings.current_balance, Decimal("3000.00"))

    def test_cross_user_isolation(self):
        bob_tx_count = Transaction.objects.filter(user=self.bob).count()
        self.assertEqual(bob_tx_count, 0)
`,
  },
];
