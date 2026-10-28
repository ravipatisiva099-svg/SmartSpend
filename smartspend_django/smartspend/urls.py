from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("core.urls", namespace="core")),
    path("accounts/", include("accounts.urls", namespace="accounts")),
    path("transactions/", include("transactions.urls", namespace="transactions")),
    path("budgets/", include("budgets.urls", namespace="budgets")),
    path("goals/", include("goals.urls", namespace="goals")),
    path("recurring/", include("recurring.urls", namespace="recurring")),
    path("reports/", include("reports.urls", namespace="reports")),
]

handler403 = "core.views.error_403"
handler404 = "core.views.error_404"
handler500 = "core.views.error_500"
