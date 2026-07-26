# Legacy UI — do not extend

These modules are **not routed** in `App.tsx`. Canonical paths:

| Legacy file | Use instead |
|-------------|-------------|
| `src/components/orders/OrderTable.tsx`, `OrderDialog.tsx`, `OrderTableRow.tsx` | `/orders` → `OrdersForm` + `formResponses/*` + `orderIntake.ts` |
| `src/components/ExpensesForm.tsx` | `/expenses` → `UnifiedExpensesForm.tsx` |
| `src/components/GeneralExpensesForm.tsx` | `/expenses` → `UnifiedExpensesForm.tsx` |
| `src/utils/generateInvoice.ts` | Phase Next Invoicing (placeholder route today) |
| `src/services/orders.ts` | `customerOrders.ts` / `orderIntake.ts` |
| `src/components/waybillStatistics/WaybillStatisticsPage.tsx` | `/delivery-analytics` |

Inventory: prefer **Stock ledger** tab (`stock_movements`); **Legacy inventory totals** tab is deprecated.

Data: prefer **`customer_orders`** + `orderDataSource.ts`; `form_responses` remains for unmigrated rows only.

Safe to delete after stabilization sign-off and no imports remain.
