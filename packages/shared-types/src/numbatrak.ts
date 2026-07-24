import { z } from "zod";

// ---------- agents ----------

export const agentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  locations: z.array(z.string()),
  active: z.boolean(),
  isWarehouse: z.boolean(),
  canDeliver: z.boolean(),
  contactPerson: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type Agent = z.infer<typeof agentSchema>;

export const createAgentRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  locations: z.array(z.string().trim().min(1)).default([]),
  contactPerson: z.string().trim().max(200).nullable().optional(),
  contactPhone: z.string().trim().max(50).nullable().optional(),
  contactEmail: z.string().trim().email().nullable().optional(),
});
export type CreateAgentRequest = z.infer<typeof createAgentRequestSchema>;

export const updateAgentRequestSchema = createAgentRequestSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateAgentRequest = z.infer<typeof updateAgentRequestSchema>;

export const setAgentActiveRequestSchema = z.object({
  active: z.boolean(),
});
export type SetAgentActiveRequest = z.infer<typeof setAgentActiveRequestSchema>;

// ---------- products ----------

export const numbatrakProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string().nullable(),
  active: z.boolean(),
  basePrice: z.string(),
  costPrice: z.string(),
});
export type NumbatrakProduct = z.infer<typeof numbatrakProductSchema>;

export const numbatrakProductTypeSchema = z.enum(["NORMAL", "INCENTIVE"]);
export type NumbatrakProductType = z.infer<typeof numbatrakProductTypeSchema>;

export const numbatrakProductOfferTypeSchema = z.enum(["single", "quantity_tier", "bundle", "buy_x_get_y"]);
export type NumbatrakProductOfferType = z.infer<typeof numbatrakProductOfferTypeSchema>;

export const numbatrakProductVariantSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  productId: z.string().uuid(),
  name: z.string(),
  sku: z.string().nullable(),
  basePrice: z.string(),
  costPrice: z.string(),
  active: z.boolean(),
  displayOrder: z.number().int(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakProductVariant = z.infer<typeof numbatrakProductVariantSchema>;

const numbatrakProductOfferBundleItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().positive(),
});

export const numbatrakProductOfferSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  offerType: numbatrakProductOfferTypeSchema,
  label: z.string(),
  minQuantity: z.number().int(),
  freeQuantity: z.number().int(),
  bundleItems: z.array(numbatrakProductOfferBundleItemSchema).nullable(),
  price: z.string(),
  unitCost: z.string(),
  active: z.boolean(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  displayOrder: z.number().int(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakProductOffer = z.infer<typeof numbatrakProductOfferSchema>;

export const numbatrakProductPerformanceSchema = z.object({
  unitsSold: z.number(),
  revenue: z.number(),
  margin: z.number(),
});
export type NumbatrakProductPerformance = z.infer<typeof numbatrakProductPerformanceSchema>;

export const numbatrakProductWithDetailsSchema = numbatrakProductSchema.extend({
  type: numbatrakProductTypeSchema,
  category: z.string().nullable(),
  subBrand: z.string().nullable(),
  lowStockThreshold: z.number().int().nullable(),
  allowsVariants: z.boolean(),
  allowsBundles: z.boolean(),
  allowsDiscounts: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  variants: z.array(numbatrakProductVariantSchema),
  offers: z.array(numbatrakProductOfferSchema),
  stockOnHand: z.number(),
  performance: numbatrakProductPerformanceSchema.nullable(),
});
export type NumbatrakProductWithDetails = z.infer<typeof numbatrakProductWithDetailsSchema>;

export const createNumbatrakProductRequestSchema = z.object({
  name: z.string().trim().min(1),
  basePrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  type: numbatrakProductTypeSchema.optional(),
  sku: z.string().trim().nullable().optional(),
  category: z.string().trim().nullable().optional(),
  subBrand: z.string().trim().nullable().optional(),
  lowStockThreshold: z.number().int().nonnegative().nullable().optional(),
  allowsVariants: z.boolean().optional(),
  allowsBundles: z.boolean().optional(),
  allowsDiscounts: z.boolean().optional(),
});
export type CreateNumbatrakProductRequest = z.infer<typeof createNumbatrakProductRequestSchema>;

export const updateNumbatrakProductRequestSchema = createNumbatrakProductRequestSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateNumbatrakProductRequest = z.infer<typeof updateNumbatrakProductRequestSchema>;

export const createNumbatrakProductVariantRequestSchema = z.object({
  name: z.string().trim().min(1),
  sku: z.string().trim().nullable().optional(),
  basePrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  displayOrder: z.number().int().optional(),
});
export type CreateNumbatrakProductVariantRequest = z.infer<typeof createNumbatrakProductVariantRequestSchema>;

export const updateNumbatrakProductVariantRequestSchema = z.object({
  name: z.string().trim().min(1).optional(),
  sku: z.string().trim().nullable().optional(),
  basePrice: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});
export type UpdateNumbatrakProductVariantRequest = z.infer<typeof updateNumbatrakProductVariantRequestSchema>;

export const createNumbatrakProductOfferRequestSchema = z.object({
  variantId: z.string().uuid().nullable().optional(),
  offerType: numbatrakProductOfferTypeSchema,
  label: z.string().trim().min(1),
  minQuantity: z.number().int().positive().optional(),
  freeQuantity: z.number().int().nonnegative().optional(),
  bundleItems: z.array(numbatrakProductOfferBundleItemSchema).nullable().optional(),
  price: z.number().nonnegative(),
  unitCost: z.number().nonnegative(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
});
export type CreateNumbatrakProductOfferRequest = z.infer<typeof createNumbatrakProductOfferRequestSchema>;

export const updateNumbatrakProductOfferRequestSchema = createNumbatrakProductOfferRequestSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateNumbatrakProductOfferRequest = z.infer<typeof updateNumbatrakProductOfferRequestSchema>;

export const receiveNumbatrakInventoryStockRequestSchema = z.object({
  variantId: z.string().uuid().nullable().optional(),
  quantityRemaining: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  receivedAt: z.string().optional(),
});
export type ReceiveNumbatrakInventoryStockRequest = z.infer<typeof receiveNumbatrakInventoryStockRequestSchema>;

// ---------- orders ----------
// Prefixed `numbatrak*` throughout - `orderItemSchema`/`OrderItem` etc. are
// already taken by the storefront's own commerce orders in commerce.ts.

export const numbatrakOrderStatusSchema = z.enum([
  "new",
  "confirmed",
  "packed",
  "dispatched",
  "delivered",
  "failed",
  "returned",
  "lost",
  "pending",
  "completed",
  "cancelled",
]);
export type NumbatrakOrderStatus = z.infer<typeof numbatrakOrderStatusSchema>;

export const numbatrakMoneyReceivedBySchema = z.enum(["agent_collected", "company_account", "prepaid"]);
export type NumbatrakMoneyReceivedBy = z.infer<typeof numbatrakMoneyReceivedBySchema>;

export const numbatrakOrderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int(),
  unitPriceAtSubmission: z.string(),
  unitCostAtSubmission: z.string(),
  totalPrice: z.string(),
  totalCost: z.string(),
  profit: z.string(),
  createdAt: z.string().nullable(),
});
export type NumbatrakOrderItem = z.infer<typeof numbatrakOrderItemSchema>;

export const numbatrakOrderSchema = z.object({
  id: z.string().uuid(),
  csrId: z.string().nullable(),
  agentId: z.number().int().nullable(),
  status: numbatrakOrderStatusSchema,
  source: z.enum(["form", "manual", "converted_from_cart"]),
  customerName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  state: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  orderRevenue: z.string().nullable(),
  orderCost: z.string().nullable(),
  amountPaid: z.string().nullable(),
  deliveryFee: z.string().nullable(),
  profit: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  offerName: z.string().nullable(),
  funnelName: z.string().nullable(),
  subBrand: z.string().nullable(),
  abandonedCartId: z.string().nullable(),
  moneyReceivedBy: numbatrakMoneyReceivedBySchema,
  items: z.array(numbatrakOrderItemSchema),
  csr: z.object({ id: z.string(), fullName: z.string().nullable(), email: z.string().nullable() }).nullable(),
  agent: z.object({ id: z.number(), name: z.string() }).nullable(),
  productNames: z.record(z.string(), z.string()),
});
export type NumbatrakOrder = z.infer<typeof numbatrakOrderSchema>;

const numbatrakOrderLineInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPriceAtSubmission: z.number().nonnegative(),
  unitCostAtSubmission: z.number().nonnegative(),
});

export const listNumbatrakOrdersQuerySchema = z.object({
  status: z.string().optional(),
  formId: z.string().uuid().optional(),
  csrId: z.string().optional(),
  agentId: z.coerce.number().int().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  subBrand: z.string().optional(),
  funnelName: z.string().optional(),
  offerName: z.string().optional(),
  search: z.string().optional(),
});
export type ListNumbatrakOrdersQuery = z.infer<typeof listNumbatrakOrdersQuerySchema>;

export const createNumbatrakOrderRequestSchema = z.object({
  csrId: z.string().nullable().optional(),
  agentId: z.number().int().nullable().optional(),
  customerName: z.string().trim().min(1),
  phoneNumber: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  deliveryAddress: z.string().trim().nullable().optional(),
  deliveryFee: z.number().nonnegative().nullable().optional(),
  amountPaid: z.number().nonnegative().nullable().optional(),
  moneyReceivedBy: numbatrakMoneyReceivedBySchema.optional(),
  notes: z.string().trim().nullable().optional(),
  funnelName: z.string().trim().nullable().optional(),
  offerName: z.string().trim().nullable().optional(),
  subBrand: z.string().trim().nullable().optional(),
  items: z.array(numbatrakOrderLineInputSchema).min(1),
});
export type CreateNumbatrakOrderRequest = z.infer<typeof createNumbatrakOrderRequestSchema>;

export const updateNumbatrakOrderRequestSchema = z.object({
  status: numbatrakOrderStatusSchema.optional(),
  notes: z.string().nullable().optional(),
  deliveryFee: z.number().nonnegative().nullable().optional(),
  amountPaid: z.number().nonnegative().nullable().optional(),
  agentId: z.number().int().nullable().optional(),
  moneyReceivedBy: numbatrakMoneyReceivedBySchema.optional(),
});
export type UpdateNumbatrakOrderRequest = z.infer<typeof updateNumbatrakOrderRequestSchema>;

export const markFailedDeliveryRequestSchema = z.object({
  expenseAmount: z.number().nonnegative().optional(),
});
export type MarkFailedDeliveryRequest = z.infer<typeof markFailedDeliveryRequestSchema>;

export const addNumbatrakOrderUpsellRequestSchema = numbatrakOrderLineInputSchema;
export type AddNumbatrakOrderUpsellRequest = z.infer<typeof addNumbatrakOrderUpsellRequestSchema>;

// ---------- abandoned carts ----------

export const numbatrakAbandonedCartSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  formId: z.string().uuid().nullable(),
  customerName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  whatsappNumber: z.string().nullable(),
  deliveryAddress: z.string().nullable(),
  state: z.string().nullable(),
  location: z.string().nullable(),
  selectedPackage: z.string().nullable(),
  selectedItems: z.string().nullable(),
  productName: z.string().nullable(),
  mailQuan: z.number().int().nullable(),
  agentQuan: z.number().int().nullable(),
  quantity: z.number().int().nullable(),
  product2: z.string().nullable(),
  mailQuan2: z.number().int().nullable(),
  agentQuan2: z.number().int().nullable(),
  quantity2: z.number().int().nullable(),
  salesPrice: z.string().nullable(),
  costPrice: z.string().nullable(),
  deliveryFee: z.string().nullable(),
  profit: z.string().nullable(),
  pageUrl: z.string().nullable(),
  filledFieldsCount: z.number().int(),
  filledFields: z.array(z.string()).nullable(),
  fieldValues: z.record(z.string(), z.unknown()).nullable(),
  selectedProducts: z.array(z.unknown()).nullable(),
  abandonedAt: z.string(),
  convertedToOrder: z.boolean(),
  convertedOrderId: z.string().uuid().nullable(),
  funnelName: z.string().nullable(),
  offerName: z.string().nullable(),
  subBrand: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakAbandonedCart = z.infer<typeof numbatrakAbandonedCartSchema>;

export const listNumbatrakAbandonedCartsQuerySchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().positive().max(200).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  // z.coerce.boolean() is unsafe for query strings - Boolean("false") is
  // true in JS, since any non-empty string is truthy. Coerce explicitly.
  converted: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  formId: z.string().uuid().optional(),
  funnelName: z.string().optional(),
  productId: z.string().uuid().optional(),
});
export type ListNumbatrakAbandonedCartsQuery = z.infer<typeof listNumbatrakAbandonedCartsQuerySchema>;

export const createNumbatrakAbandonedCartRequestSchema = z.object({
  customerName: z.string().trim().nullable().optional(),
  phoneNumber: z.string().trim().nullable().optional(),
  whatsappNumber: z.string().trim().nullable().optional(),
  deliveryAddress: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  selectedPackage: z.string().trim().nullable().optional(),
  selectedItems: z.string().trim().nullable().optional(),
  productName: z.string().trim().nullable().optional(),
  mailQuan: z.number().int().nullable().optional(),
  agentQuan: z.number().int().nullable().optional(),
  quantity: z.number().int().nullable().optional(),
  product2: z.string().trim().nullable().optional(),
  mailQuan2: z.number().int().nullable().optional(),
  agentQuan2: z.number().int().nullable().optional(),
  quantity2: z.number().int().nullable().optional(),
  salesPrice: z.number().nullable().optional(),
  pageUrl: z.string().trim().nullable().optional(),
  filledFieldsCount: z.number().int().optional(),
  note: z.string().trim().nullable().optional(),
  formId: z.string().uuid().nullable().optional(),
  funnelName: z.string().trim().nullable().optional(),
  offerName: z.string().trim().nullable().optional(),
  subBrand: z.string().trim().nullable().optional(),
  abandonedAt: z.string().optional(),
});
export type CreateNumbatrakAbandonedCartRequest = z.infer<typeof createNumbatrakAbandonedCartRequestSchema>;

export const updateNumbatrakAbandonedCartRequestSchema = z.object({
  customerName: z.string().trim().nullable().optional(),
  phoneNumber: z.string().trim().nullable().optional(),
  whatsappNumber: z.string().trim().nullable().optional(),
  deliveryAddress: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  selectedPackage: z.string().trim().nullable().optional(),
  selectedItems: z.string().trim().nullable().optional(),
  productName: z.string().trim().nullable().optional(),
  mailQuan: z.number().int().nullable().optional(),
  agentQuan: z.number().int().nullable().optional(),
  quantity: z.number().int().nullable().optional(),
  product2: z.string().trim().nullable().optional(),
  mailQuan2: z.number().int().nullable().optional(),
  agentQuan2: z.number().int().nullable().optional(),
  quantity2: z.number().int().nullable().optional(),
  salesPrice: z.number().nullable().optional(),
  pageUrl: z.string().trim().nullable().optional(),
  filledFieldsCount: z.number().int().optional(),
  convertedToOrder: z.boolean().optional(),
  convertedOrderId: z.string().uuid().nullable().optional(),
  funnelName: z.string().trim().nullable().optional(),
  offerName: z.string().trim().nullable().optional(),
  subBrand: z.string().trim().nullable().optional(),
  note: z.string().trim().nullable().optional(),
});
export type UpdateNumbatrakAbandonedCartRequest = z.infer<typeof updateNumbatrakAbandonedCartRequestSchema>;

// ---------- wallet (agent remittance) ----------

export const numbatrakRemittanceLineStatusSchema = z.enum(["standing", "remitted", "short", "net_owed"]);
export type NumbatrakRemittanceLineStatus = z.infer<typeof numbatrakRemittanceLineStatusSchema>;

export const numbatrakWalletSourceOrderSchema = z.object({
  id: z.string(),
  customerName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  agentId: z.number().int(),
  agentName: z.string().nullable(),
  orderRevenue: z.number(),
  amountPaid: z.number().nullable(),
  deliveryFee: z.number(),
  deliveredValue: z.number(),
  subBrand: z.string().nullable(),
  paymentMethod: z.enum(["cod", "online"]),
  moneyReceivedBy: numbatrakMoneyReceivedBySchema,
  walletStatus: z.enum(["pending_remittance", "collected", "released"]).nullable(),
  completedAt: z.string().nullable(),
});
export type NumbatrakWalletSourceOrder = z.infer<typeof numbatrakWalletSourceOrderSchema>;

export const numbatrakWalletRemittanceLineSchema = z.object({
  lineKey: z.string(),
  id: z.string().uuid().nullable(),
  agentId: z.number().int(),
  agentName: z.string(),
  remittanceDate: z.string(),
  orderCount: z.number().int(),
  orders: z.array(numbatrakWalletSourceOrderSchema),
  subBrands: z.array(z.string()),
  totalDeliveredValue: z.number(),
  totalDeliveryFees: z.number(),
  netOffAmount: z.number(),
  expectedRemittance: z.number(),
  actualAmount: z.number().nullable(),
  status: numbatrakRemittanceLineStatusSchema,
  shortfall: z.number(),
  netOffExpenseId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  remittedAt: z.string().nullable(),
});
export type NumbatrakWalletRemittanceLine = z.infer<typeof numbatrakWalletRemittanceLineSchema>;

export const recordNumbatrakWalletRemittanceRequestSchema = z.object({
  agentId: z.number().int(),
  remittanceDate: z.string(),
  actualAmount: z.number().nonnegative(),
});
export type RecordNumbatrakWalletRemittanceRequest = z.infer<typeof recordNumbatrakWalletRemittanceRequestSchema>;

export const addNumbatrakWalletNetOffRequestSchema = z.object({
  agentId: z.number().int(),
  remittanceDate: z.string(),
  amount: z.number().positive(),
  note: z.string().trim().nullable().optional(),
});
export type AddNumbatrakWalletNetOffRequest = z.infer<typeof addNumbatrakWalletNetOffRequestSchema>;

// ---------- deliveries / waybills ----------

export const numbatrakDeliveryStatusSchema = z.enum(["Waybilled", "Delivered"]);
export type NumbatrakDeliveryStatus = z.infer<typeof numbatrakDeliveryStatusSchema>;

export const numbatrakDeliverySchema = z.object({
  id: z.number().int(),
  date: z.string(),
  csr: z.string().nullable(),
  agentId: z.number().int().nullable(),
  agentName: z.string().nullable(),
  status: numbatrakDeliveryStatusSchema,
  productId: z.string().uuid().nullable(),
  productName: z.string().nullable(),
  quantity: z.number().int(),
  cost: z.string(),
  waybillingFee: z.string(),
  subBrand: z.string().nullable(),
  waybillBatchId: z.string().uuid().nullable(),
  createdAt: z.string().nullable(),
});
export type NumbatrakDelivery = z.infer<typeof numbatrakDeliverySchema>;

const numbatrakDeliveryLineInputSchema = z.object({
  agentId: z.number().int().nullable().optional(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  cost: z.number().nonnegative(),
  waybillingFee: z.number().nonnegative().optional(),
});

export const createNumbatrakWaybillBatchRequestSchema = z.object({
  date: z.string(),
  csr: z.string().trim().nullable().optional(),
  subBrand: z.string().trim().nullable().optional(),
  // Per-line agentId, not batch-level - a single batch can waybill different
  // products to different agents in one submission.
  lines: z.array(numbatrakDeliveryLineInputSchema.extend({ agentId: z.number().int() })).min(1),
});
export type CreateNumbatrakWaybillBatchRequest = z.infer<typeof createNumbatrakWaybillBatchRequestSchema>;

export const createNumbatrakDeliveryRequestSchema = z.object({
  date: z.string(),
  csr: z.string().trim().nullable().optional(),
  agentId: z.number().int().nullable().optional(),
  status: numbatrakDeliveryStatusSchema,
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  cost: z.number().nonnegative(),
  waybillingFee: z.number().nonnegative().optional(),
  subBrand: z.string().trim().nullable().optional(),
});
export type CreateNumbatrakDeliveryRequest = z.infer<typeof createNumbatrakDeliveryRequestSchema>;

export const updateNumbatrakDeliveryRequestSchema = z.object({
  date: z.string().optional(),
  csr: z.string().trim().nullable().optional(),
  agentId: z.number().int().nullable().optional(),
  status: numbatrakDeliveryStatusSchema.optional(),
  productId: z.string().uuid().optional(),
  quantity: z.number().int().positive().optional(),
  cost: z.number().nonnegative().optional(),
  waybillingFee: z.number().nonnegative().optional(),
  subBrand: z.string().trim().nullable().optional(),
});
export type UpdateNumbatrakDeliveryRequest = z.infer<typeof updateNumbatrakDeliveryRequestSchema>;

export const listNumbatrakDeliveriesQuerySchema = z.object({
  agentId: z.coerce.number().int().optional(),
  productId: z.string().uuid().optional(),
  status: numbatrakDeliveryStatusSchema.optional(),
  subBrand: z.string().optional(),
});
export type ListNumbatrakDeliveriesQuery = z.infer<typeof listNumbatrakDeliveriesQuerySchema>;

export const monthlyDeliverySummaryQuerySchema = z.object({
  year: z.coerce.number().int(),
  quarter: z.enum(["all", "Q1", "Q2", "Q3", "Q4"]).optional(),
  agentId: z.coerce.number().int().optional(),
  productId: z.string().uuid().optional(),
  csrText: z.string().optional(),
  status: numbatrakDeliveryStatusSchema.optional(),
  subBrand: z.string().optional(),
  location: z.enum(["all", "lagos", "outside_lagos"]).optional(),
});
export type MonthlyDeliverySummaryQuery = z.infer<typeof monthlyDeliverySummaryQuerySchema>;

export const numbatrakMonthlyDeliverySummarySchema = z.object({
  month: z.string(),
  monthNumber: z.number().int(),
  waybilled: z.number(),
  delivered: z.number(),
  balance: z.number(),
  waybillFee: z.number(),
});
export type NumbatrakMonthlyDeliverySummary = z.infer<typeof numbatrakMonthlyDeliverySummarySchema>;

// ---------- unified expenses ----------
// Category/subcategory normalization (legacy free-text -> canonical values)
// stays a client-side concern (constants/expenseCategories.ts +
// utils/expenseCategoryHelpers.ts aren't importable server-side) - the API
// stores whatever canonical scope/category/subcategory it's given, matching
// what the Orders/Deliveries/Wallet modules' own auto-feed writes already do.

export const numbatrakExpenseScopeSchema = z.enum(["org", "agent"]);
export type NumbatrakExpenseScope = z.infer<typeof numbatrakExpenseScopeSchema>;

export const numbatrakExpenseSourceTypeSchema = z.enum(["manual", "waybill_fee", "failed_delivery", "wallet_net_off"]);
export type NumbatrakExpenseSourceType = z.infer<typeof numbatrakExpenseSourceTypeSchema>;

export const numbatrakUnifiedExpenseSchema = z.object({
  id: z.string().uuid(),
  scope: numbatrakExpenseScopeSchema,
  category: z.string(),
  subcategory: z.string(),
  amount: z.number(),
  agentId: z.number().int().nullable(),
  agentName: z.string().nullable(),
  productId: z.string().uuid().nullable(),
  productName: z.string().nullable(),
  orderId: z.string().uuid().nullable(),
  note: z.string().nullable(),
  occurredAt: z.string(),
  createdBy: z.string().nullable(),
  createdAt: z.string().nullable(),
  sourceType: numbatrakExpenseSourceTypeSchema,
  sourceId: z.string().nullable(),
  offerName: z.string().nullable(),
  platform: z.string().nullable(),
});
export type NumbatrakUnifiedExpense = z.infer<typeof numbatrakUnifiedExpenseSchema>;

export const listNumbatrakUnifiedExpensesQuerySchema = z.object({
  scope: numbatrakExpenseScopeSchema.optional(),
  category: z.string().optional(),
});
export type ListNumbatrakUnifiedExpensesQuery = z.infer<typeof listNumbatrakUnifiedExpensesQuerySchema>;

export const createNumbatrakUnifiedExpenseRequestSchema = z.object({
  scope: numbatrakExpenseScopeSchema,
  category: z.string().trim().min(1),
  subcategory: z.string().trim().optional(),
  amount: z.number().positive(),
  agentId: z.number().int().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  note: z.string().trim().nullable().optional(),
  occurredAt: z.string(),
  offerName: z.string().trim().nullable().optional(),
  platform: z.string().trim().nullable().optional(),
});
export type CreateNumbatrakUnifiedExpenseRequest = z.infer<typeof createNumbatrakUnifiedExpenseRequestSchema>;

export const updateNumbatrakUnifiedExpenseRequestSchema = z.object({
  scope: numbatrakExpenseScopeSchema.optional(),
  category: z.string().trim().min(1).optional(),
  subcategory: z.string().trim().optional(),
  amount: z.number().positive().optional(),
  agentId: z.number().int().nullable().optional(),
  productId: z.string().uuid().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  note: z.string().trim().nullable().optional(),
  occurredAt: z.string().optional(),
  offerName: z.string().trim().nullable().optional(),
  platform: z.string().trim().nullable().optional(),
});
export type UpdateNumbatrakUnifiedExpenseRequest = z.infer<typeof updateNumbatrakUnifiedExpenseRequestSchema>;

export const numbatrakExpenseSubcategorySchema = z.object({
  id: z.string().uuid(),
  parentCategory: z.string(),
  slug: z.string(),
  label: z.string(),
  createdAt: z.string().nullable(),
});
export type NumbatrakExpenseSubcategory = z.infer<typeof numbatrakExpenseSubcategorySchema>;

export const createNumbatrakExpenseSubcategoryRequestSchema = z.object({
  parentCategory: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  label: z.string().trim().min(1),
});
export type CreateNumbatrakExpenseSubcategoryRequest = z.infer<typeof createNumbatrakExpenseSubcategoryRequestSchema>;

export const expenseSummaryQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
export type ExpenseSummaryQuery = z.infer<typeof expenseSummaryQuerySchema>;

export const numbatrakExpenseSummarySchema = z.object({
  byCategory: z.object({
    operational: z.number(),
    building: z.number(),
    marketing: z.number(),
    advertising: z.number(),
    agent: z.number(),
  }),
  totalOrgExpenses: z.number(),
  totalAgentExpenses: z.number(),
  totalExpenses: z.number(),
  advertisingSpend: z.number(),
  nonAdvertisingOrgExpenses: z.number(),
  deliveredRevenue: z.number(),
  expensePercentOfRevenue: z.number(),
  advertisingRoas: z.number(),
});
export type NumbatrakExpenseSummary = z.infer<typeof numbatrakExpenseSummarySchema>;

// ---------- follow-ups ----------

export const numbatrakFollowUpStatusSchema = z.enum(["awaiting", "followed_up", "resolved", "cancelled"]);
export type NumbatrakFollowUpStatus = z.infer<typeof numbatrakFollowUpStatusSchema>;

export const numbatrakFollowUpPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type NumbatrakFollowUpPriority = z.infer<typeof numbatrakFollowUpPrioritySchema>;

export const numbatrakFollowUpOutcomeSchema = z.enum([
  "converted",
  "not_converted",
  "not_interested",
  "follow_up_needed",
  "resolved",
  "other",
]);
export type NumbatrakFollowUpOutcome = z.infer<typeof numbatrakFollowUpOutcomeSchema>;

export const numbatrakFollowUpSchema = z.object({
  id: z.number().int(),
  orderId: z.string().uuid().nullable(),
  abandonedCartId: z.string().uuid().nullable(),
  assignedTo: z.string().nullable(),
  assignedUserName: z.string().nullable(),
  assignedUserEmail: z.string().nullable(),
  status: numbatrakFollowUpStatusSchema,
  priority: numbatrakFollowUpPrioritySchema,
  startedAt: z.string().nullable(),
  firstContactAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  responseTimeMinutes: z.number().int().nullable(),
  resolutionTimeMinutes: z.number().int().nullable(),
  outcome: numbatrakFollowUpOutcomeSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  cartCustomerName: z.string().nullable(),
  cartCustomerPhone: z.string().nullable(),
  cartCustomerWhatsapp: z.string().nullable(),
  cartCustomerLocation: z.string().nullable(),
  cartCustomerAddress: z.string().nullable(),
  cartCustomerState: z.string().nullable(),
});
export type NumbatrakFollowUp = z.infer<typeof numbatrakFollowUpSchema>;

export const listNumbatrakFollowUpsQuerySchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  // Higher ceiling than other list endpoints - services/followUpAnalytics.ts
  // and services/customerRelationsLeaderboard.ts both need a bulk ("all
  // matching filters") fetch for aggregation, not just one table page.
  limit: z.coerce.number().int().positive().max(2000).default(20),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
  assignedTo: z.string().optional(),
  status: numbatrakFollowUpStatusSchema.optional(),
  priority: numbatrakFollowUpPrioritySchema.optional(),
  orderId: z.string().uuid().optional(),
  abandonedCartId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
export type ListNumbatrakFollowUpsQuery = z.infer<typeof listNumbatrakFollowUpsQuerySchema>;

export const createNumbatrakFollowUpRequestSchema = z.object({
  orderId: z.string().uuid().nullable().optional(),
  abandonedCartId: z.string().uuid().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  priority: numbatrakFollowUpPrioritySchema.optional(),
  notes: z.string().trim().nullable().optional(),
});
export type CreateNumbatrakFollowUpRequest = z.infer<typeof createNumbatrakFollowUpRequestSchema>;

export const updateNumbatrakFollowUpRequestSchema = z.object({
  status: numbatrakFollowUpStatusSchema.optional(),
  priority: numbatrakFollowUpPrioritySchema.optional(),
  firstContactAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  outcome: numbatrakFollowUpOutcomeSchema.nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
});
export type UpdateNumbatrakFollowUpRequest = z.infer<typeof updateNumbatrakFollowUpRequestSchema>;

export const resolveNumbatrakFollowUpsForCartRequestSchema = z.object({
  cartId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
});
export type ResolveNumbatrakFollowUpsForCartRequest = z.infer<typeof resolveNumbatrakFollowUpsForCartRequestSchema>;

// ---------- dashboard ----------
// Business-performance/loss-metrics computation (services/dashboardMetrics.ts's
// pure computeBusinessPerformanceMetrics/computeLossMetrics) now runs
// server-side over a numbatrak_customer_orders-only row scan - same
// scope-narrowing precedent already applied to Orders/Wallet/Expenses (no
// form_responses merge). See numbatrak-dashboard/lib/summary.ts.

export const dashboardScopeQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  formId: z.string().uuid().optional(),
  csrId: z.string().optional(),
  funnelName: z.string().optional(),
  subBrand: z.string().optional(),
  agentId: z.coerce.number().int().optional(),
  status: z.string().optional(),
});
export type DashboardScopeQuery = z.infer<typeof dashboardScopeQuerySchema>;

export const numbatrakBusinessPerformanceMetricsSchema = z.object({
  totalOrdersGenerated: z.number(),
  totalOrdersDelivered: z.number(),
  deliveryRate: z.number(),
  totalDeliveredSales: z.number(),
  averageOrderValue: z.number(),
  adSpend: z.number(),
  platformCpa: z.number(),
  realCpa: z.number(),
  cpaGap: z.number(),
  totalCogs: z.number(),
  averageCogs: z.number(),
  totalDeliveryFees: z.number(),
  averageDeliveryFee: z.number(),
  profitPerOrder: z.number(),
  totalProfit: z.number(),
  roas: z.number(),
  businessRoi: z.number(),
  totalNonAdExpenses: z.number(),
  totalInvestment: z.number(),
  netProfitAfterAllExpenses: z.number(),
});
export type NumbatrakBusinessPerformanceMetrics = z.infer<typeof numbatrakBusinessPerformanceMetricsSchema>;

export const numbatrakLossStatusBreakdownSchema = z.object({
  status: z.string(),
  count: z.number(),
  wouldBeSales: z.number(),
});
export type NumbatrakLossStatusBreakdown = z.infer<typeof numbatrakLossStatusBreakdownSchema>;

export const numbatrakLossMetricsSchema = z.object({
  undeliveredCount: z.number(),
  wouldBeSales: z.number(),
  allocatedAdSpend: z.number(),
  failedDeliveryCost: z.number(),
  byStatus: z.array(numbatrakLossStatusBreakdownSchema),
});
export type NumbatrakLossMetrics = z.infer<typeof numbatrakLossMetricsSchema>;

export const numbatrakDashboardSummarySchema = z.object({
  businessMetrics: numbatrakBusinessPerformanceMetricsSchema,
  lossMetrics: numbatrakLossMetricsSchema,
});
export type NumbatrakDashboardSummary = z.infer<typeof numbatrakDashboardSummarySchema>;

export const numbatrakDashboardFilterOptionsSchema = z.object({
  funnelNames: z.array(z.string()),
  subBrands: z.array(z.string()),
});
export type NumbatrakDashboardFilterOptions = z.infer<typeof numbatrakDashboardFilterOptionsSchema>;

export const numbatrakDeliveryRateByLocationSchema = z.object({
  location: z.enum(["Lagos", "Outside Lagos", "Overall"]),
  totalDeliveries: z.number(),
  deliveredCount: z.number(),
  waybilledCount: z.number(),
  deliveryRate: z.number(),
});
export type NumbatrakDeliveryRateByLocation = z.infer<typeof numbatrakDeliveryRateByLocationSchema>;

// ---------- forms (admin CRUD) ----------
// The `schema` jsonb column (fields/submitButton/confirmation) is owned and
// shaped entirely by the frontend form builder (types/form.ts's FormSchema) -
// modeled loosely here since the API only needs to store/return it verbatim,
// not validate its internal structure (that happens server-side against the
// resolved form in the public intake endpoint, using plain TS, not zod).

export const numbatrakFormSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  formToken: z.string(),
  schema: z.record(z.string(), z.unknown()),
  active: z.boolean(),
  siteUrl: z.string().nullable(),
  subBrand: z.string().nullable(),
  funnelName: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakForm = z.infer<typeof numbatrakFormSchema>;

export const createNumbatrakFormRequestSchema = z.object({
  name: z.string().trim().min(1),
  formToken: z.string().trim().min(1),
  schema: z.record(z.string(), z.unknown()),
  active: z.boolean().optional(),
  siteUrl: z.string().trim().nullable().optional(),
  subBrand: z.string().trim().nullable().optional(),
  funnelName: z.string().trim().nullable().optional(),
});
export type CreateNumbatrakFormRequest = z.infer<typeof createNumbatrakFormRequestSchema>;

export const updateNumbatrakFormRequestSchema = z.object({
  name: z.string().trim().min(1).optional(),
  formToken: z.string().trim().min(1).optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
  siteUrl: z.string().trim().nullable().optional(),
  subBrand: z.string().trim().nullable().optional(),
  funnelName: z.string().trim().nullable().optional(),
});
export type UpdateNumbatrakFormRequest = z.infer<typeof updateNumbatrakFormRequestSchema>;

// ---------- public form intake (WordPress embed) ----------
// The one genuinely unauthenticated surface in the whole Numbatrak port - no
// org session, no requireOrgPermission. The form token itself is the sole
// public-safe capability, matching the source app's own RLS-by-token model.

export const publicFormLineItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  variantId: z.string().uuid().nullable().optional(),
  offerId: z.string().uuid().nullable().optional(),
});
export type PublicFormLineItem = z.infer<typeof publicFormLineItemSchema>;

export const submitPublicNumbatrakFormRequestSchema = z.object({
  fieldValues: z.record(z.string(), z.unknown()),
  items: z.array(publicFormLineItemSchema).default([]),
  source: z.string().trim().nullable().optional(),
  pageUrl: z.string().trim().nullable().optional(),
  offerName: z.string().trim().nullable().optional(),
  packageName: z.string().trim().nullable().optional(),
});
export type SubmitPublicNumbatrakFormRequest = z.infer<typeof submitPublicNumbatrakFormRequestSchema>;

export const publicNumbatrakFormResponseSchema = z.object({
  form: z.object({
    id: z.string().uuid(),
    name: z.string(),
    schema: z.record(z.string(), z.unknown()),
    funnelName: z.string().nullable(),
    subBrand: z.string().nullable(),
  }),
  products: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
});
export type PublicNumbatrakFormResponse = z.infer<typeof publicNumbatrakFormResponseSchema>;

export const submitPublicNumbatrakFormResultSchema = z.object({
  success: z.literal(true),
  kind: z.enum(["order", "abandoned_cart"]),
  id: z.string(),
  confirmation: z
    .object({
      type: z.enum(["message", "redirect"]),
      message: z.string().optional(),
      redirectUrl: z.string().optional(),
    })
    .nullable(),
  totals: z
    .object({
      orderRevenue: z.number(),
      orderCost: z.number(),
      orderProfit: z.number(),
    })
    .optional(),
});
export type SubmitPublicNumbatrakFormResult = z.infer<typeof submitPublicNumbatrakFormResultSchema>;

// ---------- inventory (per-agent stock ledger) ----------

export const numbatrakStockMovementTypeSchema = z.enum([
  "waybill_to_agent",
  "deliver_to_customer",
  "return_to_lagos",
  "transfer",
  "adjust",
  "damaged",
  "missing",
]);
export type NumbatrakStockMovementType = z.infer<typeof numbatrakStockMovementTypeSchema>;

export const numbatrakShrinkageMovementTypeSchema = z.enum(["damaged", "missing"]);
export type NumbatrakShrinkageMovementType = z.infer<typeof numbatrakShrinkageMovementTypeSchema>;

export const numbatrakStockMovementSchema = z.object({
  id: z.string().uuid(),
  movementType: numbatrakStockMovementTypeSchema,
  productId: z.string().uuid(),
  productName: z.string().nullable(),
  quantity: z.number().int(),
  fromAgentId: z.number().int().nullable(),
  fromAgentName: z.string().nullable(),
  toAgentId: z.number().int().nullable(),
  toAgentName: z.string().nullable(),
  orderId: z.string().uuid().nullable(),
  waybillBatchId: z.string().uuid().nullable(),
  occurredAt: z.string(),
  cost: z.string(),
  fee: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type NumbatrakStockMovement = z.infer<typeof numbatrakStockMovementSchema>;

export const createNumbatrakTransferMovementRequestSchema = z.object({
  fromAgentId: z.number().int(),
  toAgentId: z.number().int(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().trim().min(1),
});
export type CreateNumbatrakTransferMovementRequest = z.infer<typeof createNumbatrakTransferMovementRequestSchema>;

export const createNumbatrakShrinkageMovementRequestSchema = z.object({
  movementType: numbatrakShrinkageMovementTypeSchema,
  fromAgentId: z.number().int(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().trim().min(1),
});
export type CreateNumbatrakShrinkageMovementRequest = z.infer<typeof createNumbatrakShrinkageMovementRequestSchema>;

export const numbatrakAgentStockOnHandRowSchema = z.object({
  agentId: z.number().int(),
  agentName: z.string(),
  isWarehouse: z.boolean(),
  productId: z.string().uuid(),
  productName: z.string(),
  quantityOnHand: z.number(),
});
export type NumbatrakAgentStockOnHandRow = z.infer<typeof numbatrakAgentStockOnHandRowSchema>;

export const listNumbatrakStockMovementsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  agentId: z.coerce.number().int().optional(),
  movementType: numbatrakStockMovementTypeSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type ListNumbatrakStockMovementsQuery = z.infer<typeof listNumbatrakStockMovementsQuerySchema>;

// ---------- staff ----------

export const numbatrakSpecRoleSchema = z.enum(["CRS", "Manager", "Admin", "Media", "Accountant", "Founder"]);
export type NumbatrakSpecRole = z.infer<typeof numbatrakSpecRoleSchema>;

/**
 * Six-role spec vocabulary → which real Better-Auth org roles (member.role,
 * always lowercase: owner/admin/manager/csr/editor/viewer) satisfy it. Single
 * source of truth for the primaryRole-vs-member.role compatibility check -
 * apps/api validates directly against this (member.role is already this
 * lowercase shape); the numbatrak frontend's utils/specRoles.ts (which deals
 * in its own display-string UserRole type, e.g. "Customer Relations") derives
 * its own mapping from this instead of hand-duplicating the value set, so the
 * two can't drift out of sync.
 */
export const NUMBATRAK_SPEC_ROLE_COMPATIBLE_MEMBER_ROLES: Record<NumbatrakSpecRole, string[]> = {
  CRS: ["csr"],
  Manager: ["manager"],
  Admin: ["admin"],
  Founder: ["owner"],
  // Media/Accountant aren't real login roles yet (per docs/ROLE-MAPPING.md) -
  // treated as an HR-only designation held by an admin or owner today.
  Media: ["admin", "owner"],
  Accountant: ["admin", "owner"],
};

export const numbatrakStaffSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  userName: z.string().nullable(),
  userEmail: z.string().nullable(),
  memberRole: z.string().nullable(),
  primaryRole: numbatrakSpecRoleSchema,
  extraRoles: z.array(numbatrakSpecRoleSchema),
  subBrands: z.array(z.string()),
  phone: z.string().nullable(),
  bankName: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankAccountName: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakStaff = z.infer<typeof numbatrakStaffSchema>;

const numbatrakStaffRequestBaseSchema = z.object({
  userId: z.string().trim().min(1),
  primaryRole: numbatrakSpecRoleSchema,
  extraRoles: z.array(numbatrakSpecRoleSchema).default([]),
  subBrands: z.array(z.string().trim().min(1)).default([]),
  phone: z.string().trim().max(50).nullable().optional(),
  bankName: z.string().trim().max(200).nullable().optional(),
  bankAccountNumber: z.string().trim().max(50).nullable().optional(),
  bankAccountName: z.string().trim().max(200).nullable().optional(),
});

export const createNumbatrakStaffRequestSchema = numbatrakStaffRequestBaseSchema;
export type CreateNumbatrakStaffRequest = z.infer<typeof createNumbatrakStaffRequestSchema>;

export const updateNumbatrakStaffRequestSchema = numbatrakStaffRequestBaseSchema.partial().extend({
  active: z.boolean().optional(),
});
export type UpdateNumbatrakStaffRequest = z.infer<typeof updateNumbatrakStaffRequestSchema>;

export const numbatrakEligibleMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  memberRole: z.string(),
  hasStaffRecord: z.boolean(),
});
export type NumbatrakEligibleMember = z.infer<typeof numbatrakEligibleMemberSchema>;

// ---------- payroll ----------

export const numbatrakCommissionBasisSchema = z.enum(["flat_per_order", "percentage_of_sale"]);
export type NumbatrakCommissionBasis = z.infer<typeof numbatrakCommissionBasisSchema>;

export const numbatrakPayStructureScopeTypeSchema = z.enum(["role", "staff"]);
export type NumbatrakPayStructureScopeType = z.infer<typeof numbatrakPayStructureScopeTypeSchema>;

export const numbatrakPayStructureSchema = z.object({
  id: z.string().uuid(),
  scopeType: numbatrakPayStructureScopeTypeSchema,
  role: numbatrakSpecRoleSchema.nullable(),
  staffId: z.string().uuid().nullable(),
  staffName: z.string().nullable(),
  baseSalaryEnabled: z.boolean(),
  baseSalaryAmount: z.number(),
  commissionEnabled: z.boolean(),
  commissionBasis: numbatrakCommissionBasisSchema.nullable(),
  commissionRate: z.number(),
  commissionGateEnabled: z.boolean(),
  commissionGateThresholdPercent: z.number(),
  upsellBonusEnabled: z.boolean(),
  upsellBonusAmount: z.number(),
  sotmBonusEnabled: z.boolean(),
  sotmBonusAmount: z.number(),
  managerBonusEnabled: z.boolean(),
  managerBonusAmount: z.number(),
  managerGateEnabled: z.boolean(),
  managerGateTeamRatioPercent: z.number(),
  managerGateKpiThresholdPercent: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakPayStructure = z.infer<typeof numbatrakPayStructureSchema>;

const numbatrakPayStructureRequestBaseSchema = z.object({
  scopeType: numbatrakPayStructureScopeTypeSchema,
  role: numbatrakSpecRoleSchema.nullable().optional(),
  staffId: z.string().uuid().nullable().optional(),
  baseSalaryEnabled: z.boolean().default(false),
  baseSalaryAmount: z.number().nonnegative().default(0),
  commissionEnabled: z.boolean().default(false),
  commissionBasis: numbatrakCommissionBasisSchema.nullable().optional(),
  commissionRate: z.number().nonnegative().default(0),
  commissionGateEnabled: z.boolean().default(false),
  commissionGateThresholdPercent: z.number().min(0).max(100).default(0),
  upsellBonusEnabled: z.boolean().default(false),
  upsellBonusAmount: z.number().nonnegative().default(0),
  sotmBonusEnabled: z.boolean().default(false),
  sotmBonusAmount: z.number().nonnegative().default(0),
  managerBonusEnabled: z.boolean().default(false),
  managerBonusAmount: z.number().nonnegative().default(0),
  managerGateEnabled: z.boolean().default(false),
  managerGateTeamRatioPercent: z.number().min(0).max(100).default(50),
  managerGateKpiThresholdPercent: z.number().min(0).max(100).default(0),
});

export const createNumbatrakPayStructureRequestSchema = numbatrakPayStructureRequestBaseSchema;
export type CreateNumbatrakPayStructureRequest = z.infer<typeof createNumbatrakPayStructureRequestSchema>;

export const updateNumbatrakPayStructureRequestSchema = numbatrakPayStructureRequestBaseSchema
  .omit({ scopeType: true, role: true, staffId: true })
  .partial();
export type UpdateNumbatrakPayStructureRequest = z.infer<typeof updateNumbatrakPayStructureRequestSchema>;

export const numbatrakPayrollLineSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  staffId: z.string().uuid(),
  staffName: z.string().nullable(),
  primaryRole: numbatrakSpecRoleSchema.nullable(),
  calculatedBaseSalary: z.number(),
  calculatedCommission: z.number(),
  calculatedUpsellBonus: z.number(),
  calculatedSotmBonus: z.number(),
  calculatedManagerBonus: z.number(),
  overrideBaseSalary: z.number().nullable(),
  overrideCommission: z.number().nullable(),
  manualAdjustment: z.number(),
  manualAdjustmentNote: z.string().nullable(),
  deliveryRatePercent: z.number().nullable(),
  commissionGateMissed: z.boolean(),
  upsellCount: z.number(),
  managerGateMissed: z.boolean().nullable(),
  sotmAwarded: z.boolean(),
  paid: z.boolean(),
  paidAt: z.string().nullable(),
  totalPay: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakPayrollLine = z.infer<typeof numbatrakPayrollLineSchema>;

export const numbatrakPayrollRunSchema = z.object({
  id: z.string().uuid(),
  month: z.string(),
  lines: z.array(numbatrakPayrollLineSchema),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakPayrollRun = z.infer<typeof numbatrakPayrollRunSchema>;

export const runNumbatrakPayrollRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format"),
});
export type RunNumbatrakPayrollRequest = z.infer<typeof runNumbatrakPayrollRequestSchema>;

export const overrideNumbatrakPayrollLineRequestSchema = z.object({
  overrideBaseSalary: z.number().nullable().optional(),
  overrideCommission: z.number().nullable().optional(),
});
export type OverrideNumbatrakPayrollLineRequest = z.infer<typeof overrideNumbatrakPayrollLineRequestSchema>;

export const setNumbatrakPayrollManualAdjustmentRequestSchema = z.object({
  manualAdjustment: z.number(),
  manualAdjustmentNote: z.string().trim().nullable().optional(),
});
export type SetNumbatrakPayrollManualAdjustmentRequest = z.infer<
  typeof setNumbatrakPayrollManualAdjustmentRequestSchema
>;

export const awardNumbatrakSotmRequestSchema = z.object({
  sotmAwarded: z.boolean(),
});
export type AwardNumbatrakSotmRequest = z.infer<typeof awardNumbatrakSotmRequestSchema>;

export const markNumbatrakPayrollLinePaidRequestSchema = z.object({
  paid: z.boolean(),
});
export type MarkNumbatrakPayrollLinePaidRequest = z.infer<typeof markNumbatrakPayrollLinePaidRequestSchema>;

export const numbatrakMyEarningsSchema = z.object({
  month: z.string(),
  baseSalary: z.number(),
  commissionSoFar: z.number(),
  commissionGateMissed: z.boolean(),
  deliveryRatePercent: z.number().nullable(),
  commissionGateThresholdPercent: z.number().nullable(),
  upsellCount: z.number(),
  upsellBonusSoFar: z.number(),
  onTrackTotal: z.number(),
  gateStatusMessage: z.string().nullable(),
});
export type NumbatrakMyEarnings = z.infer<typeof numbatrakMyEarningsSchema>;

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export const numbatrakAttendanceSettingsSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
  autoCloseWindowMinutes: z.number().int(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakAttendanceSettings = z.infer<typeof numbatrakAttendanceSettingsSchema>;

export const updateNumbatrakAttendanceSettingsRequestSchema = z.object({
  enabled: z.boolean().optional(),
  autoCloseWindowMinutes: z.number().int().min(1).optional(),
});
export type UpdateNumbatrakAttendanceSettingsRequest = z.infer<
  typeof updateNumbatrakAttendanceSettingsRequestSchema
>;

export const numbatrakAttendanceEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  eventDate: z.string(),
  status: z.enum(["open", "closed"]),
  closedAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakAttendanceEvent = z.infer<typeof numbatrakAttendanceEventSchema>;

export const numbatrakAttendanceRecordSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  staffId: z.string().uuid(),
  staffName: z.string().nullable(),
  status: z.enum(["present", "late", "absent", "exempt"]),
  markedAt: z.string().nullable(),
  exemptReason: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakAttendanceRecord = z.infer<typeof numbatrakAttendanceRecordSchema>;

export const numbatrakAttendanceEventDetailSchema = numbatrakAttendanceEventSchema.extend({
  records: z.array(numbatrakAttendanceRecordSchema),
});
export type NumbatrakAttendanceEventDetail = z.infer<typeof numbatrakAttendanceEventDetailSchema>;

export const createNumbatrakAttendanceEventRequestSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  eventDate: z.string(),
});
export type CreateNumbatrakAttendanceEventRequest = z.infer<
  typeof createNumbatrakAttendanceEventRequestSchema
>;

export const markNumbatrakAttendanceRequestSchema = z.object({
  staffId: z.string().uuid(),
  status: z.enum(["present", "late", "absent"]),
});
export type MarkNumbatrakAttendanceRequest = z.infer<typeof markNumbatrakAttendanceRequestSchema>;

export const exemptNumbatrakAttendanceRequestSchema = z.object({
  staffId: z.string().uuid(),
  exemptReason: z.string().trim().min(1),
});
export type ExemptNumbatrakAttendanceRequest = z.infer<typeof exemptNumbatrakAttendanceRequestSchema>;

// ---------------------------------------------------------------------------
// Strikes
// ---------------------------------------------------------------------------

export const numbatrakStrikeSettingsSchema = z.object({
  id: z.string().uuid(),
  threshold: z.number().int(),
  thresholdPeriod: z.enum(["month", "quarter", "year"]),
  consequence: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakStrikeSettings = z.infer<typeof numbatrakStrikeSettingsSchema>;

export const updateNumbatrakStrikeSettingsRequestSchema = z.object({
  threshold: z.number().int().min(1).optional(),
  thresholdPeriod: z.enum(["month", "quarter", "year"]).optional(),
  consequence: z.string().trim().min(1).optional(),
});
export type UpdateNumbatrakStrikeSettingsRequest = z.infer<typeof updateNumbatrakStrikeSettingsRequestSchema>;

export const numbatrakStrikeSchema = z.object({
  id: z.string().uuid(),
  staffId: z.string().uuid(),
  staffName: z.string().nullable(),
  reason: z.string(),
  issuedBy: z.string().nullable(),
  issuedByName: z.string().nullable(),
  issuedAt: z.string(),
  cleared: z.boolean(),
  clearedBy: z.string().nullable(),
  clearedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakStrike = z.infer<typeof numbatrakStrikeSchema>;

export const issueNumbatrakStrikeRequestSchema = z.object({
  staffIds: z.array(z.string().uuid()).min(1),
  reason: z.string().trim().min(1),
});
export type IssueNumbatrakStrikeRequest = z.infer<typeof issueNumbatrakStrikeRequestSchema>;

// ---------------------------------------------------------------------------
// Stars & Leaderboard
// ---------------------------------------------------------------------------

export const numbatrakSotmCriteriaSchema = z.enum([
  "manual",
  "highest_delivery",
  "highest_delivery_rate",
  "highest_revenue",
  "highest_revenue_per_order",
  "highest_star_tier",
  "most_upsells",
]);
export type NumbatrakSotmCriteria = z.infer<typeof numbatrakSotmCriteriaSchema>;

export const numbatrakStarSettingsSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
  sotmEnabled: z.boolean(),
  sotmCriteria: numbatrakSotmCriteriaSchema,
  sotmMinStarTier: z.number().int(),
  sotmWinnerCount: z.number().int(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakStarSettings = z.infer<typeof numbatrakStarSettingsSchema>;

export const updateNumbatrakStarSettingsRequestSchema = z.object({
  enabled: z.boolean().optional(),
  sotmEnabled: z.boolean().optional(),
  sotmCriteria: numbatrakSotmCriteriaSchema.optional(),
  sotmMinStarTier: z.number().int().min(0).optional(),
  sotmWinnerCount: z.number().int().min(1).optional(),
});
export type UpdateNumbatrakStarSettingsRequest = z.infer<typeof updateNumbatrakStarSettingsRequestSchema>;

export const numbatrakStarTierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  minPoints: z.number().int(),
  displayOrder: z.number().int(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakStarTier = z.infer<typeof numbatrakStarTierSchema>;

export const createNumbatrakStarTierRequestSchema = z.object({
  name: z.string().trim().min(1),
  minPoints: z.number().int().min(0),
  displayOrder: z.number().int().optional(),
});
export type CreateNumbatrakStarTierRequest = z.infer<typeof createNumbatrakStarTierRequestSchema>;

export const numbatrakStarSchema = z.object({
  id: z.string().uuid(),
  staffId: z.string().uuid(),
  staffName: z.string().nullable(),
  points: z.number().int(),
  reason: z.string(),
  awardedBy: z.string().nullable(),
  awardedByName: z.string().nullable(),
  awardedAt: z.string(),
  month: z.string(),
  createdAt: z.string().nullable(),
});
export type NumbatrakStar = z.infer<typeof numbatrakStarSchema>;

export const awardNumbatrakStarRequestSchema = z.object({
  staffId: z.string().uuid(),
  points: z.number().int().min(1).default(1),
  reason: z.string().trim().min(1),
});
export type AwardNumbatrakStarRequest = z.infer<typeof awardNumbatrakStarRequestSchema>;

export const numbatrakLeaderboardEntrySchema = z.object({
  staffId: z.string().uuid(),
  staffName: z.string().nullable(),
  totalPoints: z.number().int(),
  tierName: z.string().nullable(),
  rank: z.number().int(),
});
export type NumbatrakLeaderboardEntry = z.infer<typeof numbatrakLeaderboardEntrySchema>;

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

export const numbatrakLeaveTypeSchema = z.enum(["annual", "sick", "emergency", "unpaid"]);
export type NumbatrakLeaveType = z.infer<typeof numbatrakLeaveTypeSchema>;

export const numbatrakLeaveStatusSchema = z.enum(["pending", "approved", "declined"]);
export type NumbatrakLeaveStatus = z.infer<typeof numbatrakLeaveStatusSchema>;

export const numbatrakLeaveSettingsSchema = z.object({
  id: z.string().uuid(),
  annualDays: z.number().int(),
  sickDays: z.number().int(),
  emergencyDays: z.number().int(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakLeaveSettings = z.infer<typeof numbatrakLeaveSettingsSchema>;

export const updateNumbatrakLeaveSettingsRequestSchema = z.object({
  annualDays: z.number().int().min(0).optional(),
  sickDays: z.number().int().min(0).optional(),
  emergencyDays: z.number().int().min(0).optional(),
});
export type UpdateNumbatrakLeaveSettingsRequest = z.infer<typeof updateNumbatrakLeaveSettingsRequestSchema>;

export const numbatrakLeaveBalanceSchema = z.object({
  staffId: z.string().uuid(),
  staffName: z.string().nullable(),
  year: z.number().int(),
  annualEntitled: z.number().int(),
  annualUsed: z.number().int(),
  annualRemaining: z.number().int(),
  sickEntitled: z.number().int(),
  sickUsed: z.number().int(),
  sickRemaining: z.number().int(),
  emergencyEntitled: z.number().int(),
  emergencyUsed: z.number().int(),
  emergencyRemaining: z.number().int(),
  unpaidUsed: z.number().int(),
});
export type NumbatrakLeaveBalance = z.infer<typeof numbatrakLeaveBalanceSchema>;

export const numbatrakLeaveRequestSchema = z.object({
  id: z.string().uuid(),
  staffId: z.string().uuid(),
  staffName: z.string().nullable(),
  leaveType: numbatrakLeaveTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  days: z.number().int(),
  reason: z.string().nullable(),
  status: numbatrakLeaveStatusSchema,
  decidedBy: z.string().nullable(),
  decidedByName: z.string().nullable(),
  decidedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakLeaveRequest = z.infer<typeof numbatrakLeaveRequestSchema>;

export const createNumbatrakLeaveRequestSchema = z.object({
  leaveType: numbatrakLeaveTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  days: z.number().int().min(1),
  reason: z.string().trim().nullable().optional(),
});
export type CreateNumbatrakLeaveRequestInput = z.infer<typeof createNumbatrakLeaveRequestSchema>;

export const decideNumbatrakLeaveRequestSchema = z.object({
  status: z.enum(["approved", "declined"]),
  decisionNote: z.string().trim().nullable().optional(),
});
export type DecideNumbatrakLeaveRequestInput = z.infer<typeof decideNumbatrakLeaveRequestSchema>;

// ---------------------------------------------------------------------------
// Order Assignment
// ---------------------------------------------------------------------------

export const numbatrakOrderAssignmentMethodSchema = z.enum(["round_robin", "percentage"]);
export type NumbatrakOrderAssignmentMethod = z.infer<typeof numbatrakOrderAssignmentMethodSchema>;

export const numbatrakOrderAssignmentSettingsSchema = z.object({
  id: z.string().uuid(),
  assignmentMethod: numbatrakOrderAssignmentMethodSchema,
  lastAssignedUserId: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakOrderAssignmentSettings = z.infer<typeof numbatrakOrderAssignmentSettingsSchema>;

export const updateNumbatrakOrderAssignmentSettingsRequestSchema = z.object({
  assignmentMethod: numbatrakOrderAssignmentMethodSchema,
});
export type UpdateNumbatrakOrderAssignmentSettingsInput = z.infer<
  typeof updateNumbatrakOrderAssignmentSettingsRequestSchema
>;

export const numbatrakOrderAssignmentWeightSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  userName: z.string().nullable(),
  percentage: z.number(),
  isPaused: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakOrderAssignmentWeight = z.infer<typeof numbatrakOrderAssignmentWeightSchema>;

export const upsertNumbatrakOrderAssignmentWeightRequestSchema = z.object({
  userId: z.string().trim().min(1),
  percentage: z.number().min(0).max(100),
  isPaused: z.boolean().optional(),
});
export type UpsertNumbatrakOrderAssignmentWeightRequest = z.infer<
  typeof upsertNumbatrakOrderAssignmentWeightRequestSchema
>;

// ---------------------------------------------------------------------------
// Media Buyers
// ---------------------------------------------------------------------------

export const numbatrakMediaBuyerSettingsSchema = z.object({
  id: z.string().uuid(),
  weeklyReviewEnabled: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakMediaBuyerSettings = z.infer<typeof numbatrakMediaBuyerSettingsSchema>;

export const updateNumbatrakMediaBuyerSettingsRequestSchema = z.object({
  weeklyReviewEnabled: z.boolean().optional(),
});
export type UpdateNumbatrakMediaBuyerSettingsRequest = z.infer<typeof updateNumbatrakMediaBuyerSettingsRequestSchema>;

export const numbatrakContractorRoleSchema = z.enum(["vo_artist", "video_editor"]);
export type NumbatrakContractorRole = z.infer<typeof numbatrakContractorRoleSchema>;

export const numbatrakContractorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  role: numbatrakContractorRoleSchema,
  rate: z.number(),
  active: z.boolean(),
  piecesDone: z.number().int(),
  piecesPaid: z.number().int(),
  piecesUnpaid: z.number().int(),
  amountOwed: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakContractor = z.infer<typeof numbatrakContractorSchema>;

export const createNumbatrakContractorRequestSchema = z.object({
  name: z.string().trim().min(1),
  role: numbatrakContractorRoleSchema,
  rate: z.number().nonnegative(),
});
export type CreateNumbatrakContractorRequest = z.infer<typeof createNumbatrakContractorRequestSchema>;

export const numbatrakCreativeTypeSchema = z.enum(["voiceover", "ugc", "ai_story", "sound", "other"]);
export type NumbatrakCreativeType = z.infer<typeof numbatrakCreativeTypeSchema>;

export const numbatrakProductionBatchStatusSchema = z.enum(["briefed", "shooting", "editing", "done"]);
export type NumbatrakProductionBatchStatus = z.infer<typeof numbatrakProductionBatchStatusSchema>;

export const numbatrakProductionBatchSchema = z.object({
  id: z.string().uuid(),
  buyerId: z.string().nullable(),
  buyerName: z.string().nullable(),
  brand: z.string().nullable(),
  productId: z.string().nullable(),
  creativeType: numbatrakCreativeTypeSchema,
  description: z.string().nullable(),
  voArtistId: z.string().uuid().nullable(),
  voArtistName: z.string().nullable(),
  editorId: z.string().uuid().nullable(),
  editorName: z.string().nullable(),
  videoCount: z.number().int(),
  status: numbatrakProductionBatchStatusSchema,
  driveLink: z.string().nullable(),
  doneAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakProductionBatch = z.infer<typeof numbatrakProductionBatchSchema>;

export const createNumbatrakProductionBatchRequestSchema = z.object({
  buyerId: z.string().nullable().optional(),
  brand: z.string().trim().nullable().optional(),
  productId: z.string().nullable().optional(),
  creativeType: numbatrakCreativeTypeSchema,
  description: z.string().trim().nullable().optional(),
  voArtistId: z.string().uuid().nullable().optional(),
  editorId: z.string().uuid().nullable().optional(),
  videoCount: z.number().int().min(1).default(1),
});
export type CreateNumbatrakProductionBatchRequest = z.infer<typeof createNumbatrakProductionBatchRequestSchema>;

export const numbatrakContractorPaymentSchema = z.object({
  id: z.string().uuid(),
  contractorId: z.string().uuid(),
  contractorName: z.string().nullable(),
  pieces: z.number().int(),
  amount: z.number(),
  brand: z.string().nullable(),
  paidAt: z.string(),
  createdAt: z.string().nullable(),
});
export type NumbatrakContractorPayment = z.infer<typeof numbatrakContractorPaymentSchema>;

export const numbatrakAdCatalogEntrySchema = z.object({
  id: z.string().uuid(),
  batchId: z.string().uuid().nullable(),
  name: z.string(),
  hookType: z.string().nullable(),
  creativeType: z.string().nullable(),
  brand: z.string().nullable(),
  productId: z.string().nullable(),
  offerId: z.string().nullable(),
  driveLink: z.string().nullable(),
  editorName: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakAdCatalogEntry = z.infer<typeof numbatrakAdCatalogEntrySchema>;

export const numbatrakAdSpendEntrySchema = z.object({
  id: z.string().uuid(),
  buyerId: z.string().nullable(),
  buyerName: z.string().nullable(),
  spendDate: z.string(),
  brand: z.string().nullable(),
  productId: z.string().nullable(),
  offerId: z.string().nullable(),
  platform: z.string().nullable(),
  spend: z.number(),
  orders: z.number().int(),
  cpa: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakAdSpendEntry = z.infer<typeof numbatrakAdSpendEntrySchema>;

export const createNumbatrakAdSpendRequestSchema = z.object({
  spendDate: z.string(),
  brand: z.string().trim().nullable().optional(),
  productId: z.string().nullable().optional(),
  offerId: z.string().nullable().optional(),
  platform: z.string().trim().nullable().optional(),
  spend: z.number().nonnegative(),
  orders: z.number().int().nonnegative(),
});
export type CreateNumbatrakAdSpendRequest = z.infer<typeof createNumbatrakAdSpendRequestSchema>;

export const numbatrakCpaTargetSchema = z.object({
  id: z.string().uuid(),
  buyerId: z.string().nullable(),
  buyerName: z.string().nullable(),
  brand: z.string().nullable(),
  productId: z.string().nullable(),
  offerId: z.string().nullable(),
  cpaTarget: z.number(),
  weeklyBudget: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakCpaTarget = z.infer<typeof numbatrakCpaTargetSchema>;

export const upsertNumbatrakCpaTargetRequestSchema = z.object({
  buyerId: z.string().nullable().optional(),
  brand: z.string().trim().nullable().optional(),
  productId: z.string().nullable().optional(),
  offerId: z.string().nullable().optional(),
  cpaTarget: z.number().nonnegative(),
  weeklyBudget: z.number().nonnegative(),
});
export type UpsertNumbatrakCpaTargetRequest = z.infer<typeof upsertNumbatrakCpaTargetRequestSchema>;

export const numbatrakWeeklyReviewVerdictSchema = z.enum(["on_track", "needs_attention", "critical"]);
export type NumbatrakWeeklyReviewVerdict = z.infer<typeof numbatrakWeeklyReviewVerdictSchema>;

export const numbatrakWeeklyReviewSchema = z.object({
  id: z.string().uuid(),
  buyerId: z.string(),
  buyerName: z.string().nullable(),
  weekStart: z.string(),
  adsToScale: z.string().nullable(),
  adsToPause: z.string().nullable(),
  adsToKill: z.string().nullable(),
  biggestWin: z.string().nullable(),
  biggestIssue: z.string().nullable(),
  verdict: numbatrakWeeklyReviewVerdictSchema,
  nextWeekDecisions: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakWeeklyReview = z.infer<typeof numbatrakWeeklyReviewSchema>;

export const createNumbatrakWeeklyReviewRequestSchema = z.object({
  weekStart: z.string(),
  adsToScale: z.string().trim().nullable().optional(),
  adsToPause: z.string().trim().nullable().optional(),
  adsToKill: z.string().trim().nullable().optional(),
  biggestWin: z.string().trim().nullable().optional(),
  biggestIssue: z.string().trim().nullable().optional(),
  verdict: numbatrakWeeklyReviewVerdictSchema,
  nextWeekDecisions: z.string().trim().nullable().optional(),
});
export type CreateNumbatrakWeeklyReviewRequest = z.infer<typeof createNumbatrakWeeklyReviewRequestSchema>;

export const numbatrakPerformanceAnalyticsSchema = z.object({
  brand: z.string().nullable(),
  productId: z.string().nullable(),
  offerId: z.string().nullable(),
  platform: z.string().nullable(),
  buyerName: z.string().nullable(),
  totalSpend: z.number(),
  totalOrders: z.number().int(),
  cpa: z.number(),
  revenue: z.number(),
  roas: z.number(),
});
export type NumbatrakPerformanceAnalytics = z.infer<typeof numbatrakPerformanceAnalyticsSchema>;

// ---------------------------------------------------------------------------
// CRM (Customer Management)
// ---------------------------------------------------------------------------

export const numbatrakCustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  whatsapp: z.string().nullable(),
  location: z.string().nullable(),
  firstClickSource: z.string().nullable(),
  lastClickSource: z.string().nullable(),
  notes: z.string().nullable(),
  ltv: z.number(),
  orderRevenue: z.number(),
  morePurchaseRevenue: z.number(),
  orderCount: z.number().int(),
  morePurchaseCount: z.number().int(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakCustomer = z.infer<typeof numbatrakCustomerSchema>;

export const createNumbatrakCustomerRequestSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().email().nullable().optional(),
  whatsapp: z.string().trim().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  firstClickSource: z.string().trim().nullable().optional(),
  lastClickSource: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});
export type CreateNumbatrakCustomerRequest = z.infer<typeof createNumbatrakCustomerRequestSchema>;

export const updateNumbatrakCustomerRequestSchema = createNumbatrakCustomerRequestSchema.partial();
export type UpdateNumbatrakCustomerRequest = z.infer<typeof updateNumbatrakCustomerRequestSchema>;

export const numbatrakFeedbackSettingsSchema = z.object({
  id: z.string().uuid(),
  callWindowDays: z.number().int(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakFeedbackSettings = z.infer<typeof numbatrakFeedbackSettingsSchema>;

export const numbatrakFeedbackCallDispositionSchema = z.enum([
  "answered", "no_answer", "wrong_number", "switched_off", "unreachable", "callback_requested",
]);
export type NumbatrakFeedbackCallDisposition = z.infer<typeof numbatrakFeedbackCallDispositionSchema>;

export const numbatrakReorderLikelihoodSchema = z.enum(["definitely", "maybe", "no", "unlikely"]);
export type NumbatrakReorderLikelihood = z.infer<typeof numbatrakReorderLikelihoodSchema>;

export const numbatrakFeedbackCallSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  orderId: z.string().nullable(),
  assignedTo: z.string().nullable(),
  assignedToName: z.string().nullable(),
  scheduledAt: z.string(),
  disposition: numbatrakFeedbackCallDispositionSchema.nullable(),
  satisfactionScore: z.number().int().nullable(),
  reorderLikelihood: numbatrakReorderLikelihoodSchema.nullable(),
  callbackAt: z.string().nullable(),
  attempts: z.number().int(),
  completedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakFeedbackCall = z.infer<typeof numbatrakFeedbackCallSchema>;

export const dispositionNumbatrakFeedbackCallRequestSchema = z.object({
  disposition: numbatrakFeedbackCallDispositionSchema,
  satisfactionScore: z.number().int().min(1).max(5).nullable().optional(),
  reorderLikelihood: numbatrakReorderLikelihoodSchema.nullable().optional(),
  callbackAt: z.string().nullable().optional(),
});
export type DispositionNumbatrakFeedbackCallRequest = z.infer<typeof dispositionNumbatrakFeedbackCallRequestSchema>;

export const numbatrakComplaintTypeSchema = z.enum([
  "wrong_size", "damaged", "never_received", "wrong_product", "quality_issue", "other",
]);
export type NumbatrakComplaintType = z.infer<typeof numbatrakComplaintTypeSchema>;

export const numbatrakComplaintStatusSchema = z.enum(["open", "escalated", "resolved"]);
export type NumbatrakComplaintStatus = z.infer<typeof numbatrakComplaintStatusSchema>;

export const numbatrakComplaintResolutionTypeSchema = z.enum(["refund", "replacement", "other"]);
export type NumbatrakComplaintResolutionType = z.infer<typeof numbatrakComplaintResolutionTypeSchema>;

export const numbatrakComplaintSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string().nullable(),
  orderId: z.string().nullable(),
  complaintType: numbatrakComplaintTypeSchema.nullable(),
  description: z.string(),
  attachments: z.string().nullable(),
  status: numbatrakComplaintStatusSchema,
  resolution: z.string().nullable(),
  resolutionType: numbatrakComplaintResolutionTypeSchema.nullable(),
  escalatedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  resolvedBy: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakComplaint = z.infer<typeof numbatrakComplaintSchema>;

export const createNumbatrakComplaintRequestSchema = z.object({
  customerId: z.string().uuid(),
  orderId: z.string().nullable().optional(),
  complaintType: numbatrakComplaintTypeSchema.nullable().optional(),
  description: z.string().trim().min(1),
  attachments: z.string().trim().nullable().optional(),
});
export type CreateNumbatrakComplaintRequest = z.infer<typeof createNumbatrakComplaintRequestSchema>;

export const resolveNumbatrakComplaintRequestSchema = z.object({
  resolution: z.string().trim().min(1),
  resolutionType: numbatrakComplaintResolutionTypeSchema,
});
export type ResolveNumbatrakComplaintRequest = z.infer<typeof resolveNumbatrakComplaintRequestSchema>;

export const numbatrakMorePurchaseSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string().nullable(),
  feedbackCallId: z.string().uuid().nullable(),
  productId: z.string().nullable(),
  productName: z.string().nullable(),
  quantity: z.number().int(),
  amount: z.number(),
  cogs: z.number(),
  deliveryCost: z.number(),
  profit: z.number(),
  agentId: z.string().nullable(),
  status: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakMorePurchase = z.infer<typeof numbatrakMorePurchaseSchema>;

export const createNumbatrakMorePurchaseRequestSchema = z.object({
  customerId: z.string().uuid(),
  feedbackCallId: z.string().uuid().nullable().optional(),
  productId: z.string().nullable().optional(),
  productName: z.string().trim().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  amount: z.number().nonnegative(),
  cogs: z.number().nonnegative().default(0),
  deliveryCost: z.number().nonnegative().default(0),
});
export type CreateNumbatrakMorePurchaseRequest = z.infer<typeof createNumbatrakMorePurchaseRequestSchema>;

export const numbatrakCampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  channel: z.enum(["email", "whatsapp"]),
  segmentFilter: z.string().nullable(),
  subject: z.string().nullable(),
  body: z.string(),
  recipientCount: z.number().int(),
  sentCount: z.number().int(),
  failedCount: z.number().int(),
  status: z.enum(["draft", "sending", "sent", "failed"]),
  sentAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type NumbatrakCampaign = z.infer<typeof numbatrakCampaignSchema>;

export const createNumbatrakCampaignRequestSchema = z.object({
  name: z.string().trim().min(1),
  channel: z.enum(["email", "whatsapp"]),
  segmentFilter: z.string().trim().nullable().optional(),
  subject: z.string().trim().nullable().optional(),
  body: z.string().trim().min(1),
});
export type CreateNumbatrakCampaignRequest = z.infer<typeof createNumbatrakCampaignRequestSchema>;

export const numbatrakCrmCreditSchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  balance: z.number().int(),
});
export type NumbatrakCrmCredit = z.infer<typeof numbatrakCrmCreditSchema>;

export const numbatrakFeedbackDashboardSchema = z.object({
  totalCalls: z.number().int(),
  attempted: z.number().int(),
  answerRate: z.number(),
  avgAttemptsToReach: z.number(),
  avgSatisfaction: z.number(),
  happyRate: z.number(),
  unhappyRate: z.number(),
  morePurchaseRevenue: z.number(),
  morePurchaseProfit: z.number(),
  profitPerCall: z.number(),
});
export type NumbatrakFeedbackDashboard = z.infer<typeof numbatrakFeedbackDashboardSchema>;

export const numbatrakComplaintDashboardSchema = z.object({
  total: z.number().int(),
  open: z.number().int(),
  escalated: z.number().int(),
  resolved: z.number().int(),
  resolutionRate: z.number(),
  refundCount: z.number().int(),
  replacementCount: z.number().int(),
  byType: z.array(z.object({ type: z.string(), count: z.number().int() })),
});
export type NumbatrakComplaintDashboard = z.infer<typeof numbatrakComplaintDashboardSchema>;
