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
