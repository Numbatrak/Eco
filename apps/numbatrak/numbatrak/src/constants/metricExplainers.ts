export type MetricExplainerKey =
  | "orders_generated"
  | "orders_delivered"
  | "delivery_rate"
  | "average_order_value"
  | "platform_cpa"
  | "real_cpa"
  | "average_cogs"
  | "average_delivery_fee"
  | "profit_per_order"
  | "total_profit"
  | "roas"
  | "business_roi"
  | "ad_spend"
  | "other_expenses";

export type MetricExplainer = {
  title: string;
  summary: string;
  formula?: string;
  bullets?: string[];
  /** Waterfall lines for profit metrics */
  waterfall?: { label: string; value?: string; highlight?: boolean }[];
  /** Split comparison for ROAS vs ROI */
  split?: { left: { title: string; body: string }; right: { title: string; body: string } };
};

export const METRIC_EXPLAINERS: Record<MetricExplainerKey, MetricExplainer> = {
  orders_generated: {
    title: "Orders generated",
    summary:
      "Every non-cancelled order created in the selected period, regardless of delivery outcome.",
    formula: "Count of orders where status ≠ cancelled and created_at is in range",
    bullets: [
      "Uses order creation date, not delivery date.",
      "Includes in-pipeline and failed orders.",
    ],
  },
  orders_delivered: {
    title: "Orders delivered",
    summary:
      "Orders marked delivered (or legacy completed) whose delivery date falls in the selected period.",
    formula: "Count where status is delivered/completed and completed_at (or created_at) is in range",
    bullets: [
      "This is the revenue-truth set for profit and ROAS.",
      "Undelivered orders never count here.",
    ],
  },
  delivery_rate: {
    title: "Delivery rate",
    summary:
      "What share of generated orders actually delivered — the gap is where ad spend leaks.",
    formula: "Delivered ÷ Generated × 100",
    bullets: [
      "Both counts respect the active dashboard filters.",
      "Green/amber/red uses your alert thresholds in Organization Settings.",
    ],
  },
  average_order_value: {
    title: "Average order value (AOV)",
    summary: "Average revenue per delivered order in the period.",
    formula: "Total delivered sales ÷ Delivered order count",
    bullets: ["Delivered orders only — not generated."],
  },
  platform_cpa: {
    title: "Platform CPA",
    summary:
      "What the ad platform thinks each lead costs — uses generated orders, not delivered.",
    formula: "Ad spend ÷ Orders generated",
    bullets: [
      "Hidden cost shows up when you compare to Real CPA.",
      "Hidden when there is no ad spend in the period.",
    ],
  },
  real_cpa: {
    title: "Real CPA",
    summary:
      "True cost to acquire a delivered sale — the number that matters for profit.",
    formula: "Ad spend ÷ Orders delivered",
    bullets: [
      "Gap vs Platform CPA = cost of undelivered orders.",
      "Compared to AOV for health colour and alerts.",
    ],
  },
  average_cogs: {
    title: "Average COGS",
    summary: "Average product cost per delivered order (snapshotted at order creation).",
    formula: "Sum order_cost on delivered ÷ Delivered count",
  },
  average_delivery_fee: {
    title: "Average delivery fee",
    summary: "Average delivery fee per delivered order.",
    formula: "Sum delivery_fee on delivered ÷ Delivered count",
  },
  profit_per_order: {
    title: "Profit per order",
    summary:
      "Estimated net margin per delivered order after ad, product, and delivery costs.",
    formula: "AOV − Real CPA − Avg COGS − Avg delivery fee",
    waterfall: [
      { label: "Average order value (AOV)", highlight: true },
      { label: "− Real CPA (ad cost per delivery)" },
      { label: "− Average COGS" },
      { label: "− Average delivery fee" },
      { label: "= Profit per order", highlight: true },
    ],
    bullets: [
      "Uses delivered orders only.",
      "Ad spend is spread across delivered orders via Real CPA.",
    ],
  },
  total_profit: {
    title: "Total profit (delivered)",
    summary: "Formula profit across all delivered orders in the filter.",
    formula: "Profit per order × Delivered order count",
    waterfall: [
      { label: "Profit per order" },
      { label: "× Delivered orders" },
      { label: "= Total profit", highlight: true },
    ],
  },
  roas: {
    title: "ROAS",
    summary:
      "Return on ad spend — how much delivered revenue you earn for each naira spent on ads.",
    formula: "Delivered revenue ÷ Ad spend",
    split: {
      left: {
        title: "ROAS (this card)",
        body: "Advertising only. Delivered sales divided by ad spend. Answers: “Are my ads paying for themselves on delivered orders?”",
      },
      right: {
        title: "Business ROI (separate)",
        body: "All expenses — ad + operational. Net profit after COGS, delivery, and every expense category, divided by total investment.",
      },
    },
    bullets: ["Never merged with Business ROI in the UI."],
  },
  business_roi: {
    title: "Business ROI",
    summary:
      "True business return after all operational and ad expenses — not the same as ROAS.",
    formula: "(Delivered sales − COGS − delivery − all expenses) ÷ (Ad spend + other expenses)",
    split: {
      left: {
        title: "ROAS",
        body: "Ad spend in isolation — delivered revenue ÷ ad spend only.",
      },
      right: {
        title: "Business ROI (this card)",
        body: "Layers rent, salaries, failed delivery, and every non-ad expense into the denominator. Shows whether the whole operation is profitable.",
      },
    },
  },
  ad_spend: {
    title: "Ad spend",
    summary:
      "Total advertising expenses in the period from Expenses (Advertising category).",
    bullets: ["Feeds Platform CPA, Real CPA, and ROAS."],
  },
  other_expenses: {
    title: "Other expenses",
    summary:
      "Non-ad operational and building expenses in the period — used for Business ROI only.",
    bullets: ["Does not affect ROAS or CPA metrics."],
  },
};
