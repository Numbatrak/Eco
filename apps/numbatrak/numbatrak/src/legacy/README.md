# Legacy UI — do not extend

These modules are **not routed** in `App.tsx`. Canonical paths:

| Legacy file | Use instead |
|-------------|-------------|
| `src/components/orders/OrderTable.tsx`, `OrderDialog.tsx`, `OrderTableRow.tsx` | `/orders` → `OrdersForm` + `formResponses/*` + `orderIntake.ts` |
| `src/utils/generateInvoice.ts` | Phase Next Invoicing (placeholder route today) |
| `src/components/waybillStatistics/WaybillStatisticsPage.tsx` | `/delivery-analytics` |

Inventory: prefer **Stock ledger** tab (`stock_movements`); **Legacy inventory totals** tab is deprecated.

Data: prefer **`customer_orders`** + `orderDataSource.ts`; `form_responses` remains for unmigrated rows only.

Safe to delete after stabilization sign-off and no imports remain.

**Deleted 2026-08-27** (confirmed zero imports, Supabase-cleanup pass): `ExpensesForm.tsx`, `GeneralExpensesForm.tsx`, `services/orders.ts`, `services/expenses.ts`, `services/generalExpenses.ts`, `services/inventory.ts`, `services/formProducts.ts`, `services/formResponses.ts`, `services/metrics.ts`, `services/orderWebhook.ts`, `utils/activityLogger.ts`, `components/inventory/InventoryTable.tsx`, `components/organizations/InvitationNotification.tsx`, `components/dashboard/WaybillByState.tsx`, plus the dead halves of `components/expenses/*` and all of `components/generalExpenses/`, `components/waybillStatistics/{MonthlyWaybillSummary,PageHeader}.*`, and `hooks/useCachedData.ts`.
