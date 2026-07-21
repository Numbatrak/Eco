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

// ---------- products (minimal read-only list, full CRUD is a later slice) ----------

export const numbatrakProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string().nullable(),
  active: z.boolean(),
  basePrice: z.string(),
  costPrice: z.string(),
});
export type NumbatrakProduct = z.infer<typeof numbatrakProductSchema>;

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
