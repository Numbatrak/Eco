"use client";

import { apiRequest } from "../lib/apiClient";

// --- DTO interfaces ---

interface FeedbackSettingsDto {
  id: string;
  callWindowDays: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  whatsapp: string | null;
  location: string | null;
  firstClickSource: string | null;
  lastClickSource: string | null;
  notes: string | null;
  ltv: number;
  orderRevenue: number;
  morePurchaseRevenue: number;
  orderCount: number;
  morePurchaseCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface FeedbackCallDto {
  id: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  orderId: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  scheduledAt: string;
  disposition: string | null;
  satisfactionScore: number | null;
  reorderLikelihood: string | null;
  callbackAt: string | null;
  attempts: number;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ComplaintDto {
  id: string;
  customerId: string;
  customerName: string | null;
  orderId: string | null;
  complaintType: string | null;
  description: string;
  attachments: string | null;
  status: string;
  resolution: string | null;
  resolutionType: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface MorePurchaseDto {
  id: string;
  customerId: string;
  customerName: string | null;
  feedbackCallId: string | null;
  productId: string | null;
  productName: string | null;
  quantity: number;
  amount: number;
  cogs: number;
  deliveryCost: number;
  profit: number;
  agentId: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CampaignDto {
  id: string;
  name: string;
  channel: string;
  segmentFilter: string | null;
  subject: string | null;
  body: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: string;
  sentAt: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CreditDto {
  channel: string;
  balance: number;
}

interface FeedbackDashboardDto {
  totalCalls: number;
  attempted: number;
  answerRate: number;
  avgAttemptsToReach: number;
  avgSatisfaction: number;
  happyRate: number;
  unhappyRate: number;
  morePurchaseRevenue: number;
  morePurchaseProfit: number;
  profitPerCall: number;
}

interface ComplaintDashboardDto {
  total: number;
  open: number;
  escalated: number;
  resolved: number;
  resolutionRate: number;
  refundCount: number;
  replacementCount: number;
  byType: { type: string; count: number }[];
}

// --- Frontend types ---

export interface FeedbackSettings {
  id: string;
  call_window_days: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  whatsapp: string | null;
  location: string | null;
  first_click_source: string | null;
  last_click_source: string | null;
  notes: string | null;
  ltv: number;
  order_revenue: number;
  more_purchase_revenue: number;
  order_count: number;
  more_purchase_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface FeedbackCall {
  id: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  order_id: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  scheduled_at: string;
  disposition: string | null;
  satisfaction_score: number | null;
  reorder_likelihood: string | null;
  callback_at: string | null;
  attempts: number;
  completed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Complaint {
  id: string;
  customer_id: string;
  customer_name: string | null;
  order_id: string | null;
  complaint_type: string | null;
  description: string;
  attachments: string | null;
  status: string;
  resolution: string | null;
  resolution_type: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MorePurchase {
  id: string;
  customer_id: string;
  customer_name: string | null;
  feedback_call_id: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  amount: number;
  cogs: number;
  delivery_cost: number;
  profit: number;
  agent_id: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  segment_filter: string | null;
  subject: string | null;
  body: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  sent_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CrmCredit {
  channel: string;
  balance: number;
}

export interface FeedbackDashboard {
  total_calls: number;
  attempted: number;
  answer_rate: number;
  avg_attempts_to_reach: number;
  avg_satisfaction: number;
  happy_rate: number;
  unhappy_rate: number;
  more_purchase_revenue: number;
  more_purchase_profit: number;
  profit_per_call: number;
}

export interface ComplaintDashboard {
  total: number;
  open: number;
  escalated: number;
  resolved: number;
  resolution_rate: number;
  refund_count: number;
  replacement_count: number;
  by_type: { type: string; count: number }[];
}

// --- Converters ---

function feedbackSettingsFromDto(d: FeedbackSettingsDto): FeedbackSettings {
  return { id: d.id, call_window_days: d.callWindowDays, created_at: d.createdAt, updated_at: d.updatedAt };
}
function customerFromDto(d: CustomerDto): Customer {
  return { id: d.id, name: d.name, phone: d.phone, email: d.email, whatsapp: d.whatsapp, location: d.location, first_click_source: d.firstClickSource, last_click_source: d.lastClickSource, notes: d.notes, ltv: d.ltv, order_revenue: d.orderRevenue, more_purchase_revenue: d.morePurchaseRevenue, order_count: d.orderCount, more_purchase_count: d.morePurchaseCount, created_at: d.createdAt, updated_at: d.updatedAt };
}
function feedbackCallFromDto(d: FeedbackCallDto): FeedbackCall {
  return { id: d.id, customer_id: d.customerId, customer_name: d.customerName, customer_phone: d.customerPhone, order_id: d.orderId, assigned_to: d.assignedTo, assigned_to_name: d.assignedToName, scheduled_at: d.scheduledAt, disposition: d.disposition, satisfaction_score: d.satisfactionScore, reorder_likelihood: d.reorderLikelihood, callback_at: d.callbackAt, attempts: d.attempts, completed_at: d.completedAt, created_at: d.createdAt, updated_at: d.updatedAt };
}
function complaintFromDto(d: ComplaintDto): Complaint {
  return { id: d.id, customer_id: d.customerId, customer_name: d.customerName, order_id: d.orderId, complaint_type: d.complaintType, description: d.description, attachments: d.attachments, status: d.status, resolution: d.resolution, resolution_type: d.resolutionType, escalated_at: d.escalatedAt, resolved_at: d.resolvedAt, resolved_by: d.resolvedBy, created_at: d.createdAt, updated_at: d.updatedAt };
}
function morePurchaseFromDto(d: MorePurchaseDto): MorePurchase {
  return { id: d.id, customer_id: d.customerId, customer_name: d.customerName, feedback_call_id: d.feedbackCallId, product_id: d.productId, product_name: d.productName, quantity: d.quantity, amount: d.amount, cogs: d.cogs, delivery_cost: d.deliveryCost, profit: d.profit, agent_id: d.agentId, status: d.status, created_at: d.createdAt, updated_at: d.updatedAt };
}
function campaignFromDto(d: CampaignDto): Campaign {
  return { id: d.id, name: d.name, channel: d.channel, segment_filter: d.segmentFilter, subject: d.subject, body: d.body, recipient_count: d.recipientCount, sent_count: d.sentCount, failed_count: d.failedCount, status: d.status, sent_at: d.sentAt, created_by: d.createdBy, created_at: d.createdAt, updated_at: d.updatedAt };
}
function feedbackDashboardFromDto(d: FeedbackDashboardDto): FeedbackDashboard {
  return { total_calls: d.totalCalls, attempted: d.attempted, answer_rate: d.answerRate, avg_attempts_to_reach: d.avgAttemptsToReach, avg_satisfaction: d.avgSatisfaction, happy_rate: d.happyRate, unhappy_rate: d.unhappyRate, more_purchase_revenue: d.morePurchaseRevenue, more_purchase_profit: d.morePurchaseProfit, profit_per_call: d.profitPerCall };
}
function complaintDashboardFromDto(d: ComplaintDashboardDto): ComplaintDashboard {
  return { total: d.total, open: d.open, escalated: d.escalated, resolved: d.resolved, resolution_rate: d.resolutionRate, refund_count: d.refundCount, replacement_count: d.replacementCount, by_type: d.byType };
}

// --- API calls ---

export async function fetchFeedbackSettings(): Promise<FeedbackSettings> {
  const dto = await apiRequest<FeedbackSettingsDto>("/org/numbatrak/crm/settings");
  return feedbackSettingsFromDto(dto);
}

export async function updateFeedbackSettings(callWindowDays: number): Promise<FeedbackSettings> {
  const dto = await apiRequest<FeedbackSettingsDto>("/org/numbatrak/crm/settings", { method: "PATCH", body: { callWindowDays } });
  return feedbackSettingsFromDto(dto);
}

export async function fetchCustomers(): Promise<Customer[]> {
  const { customers } = await apiRequest<{ customers: CustomerDto[] }>("/org/numbatrak/crm/customers");
  return customers.map(customerFromDto);
}

export async function createCustomer(body: Record<string, unknown>): Promise<Customer> {
  const dto = await apiRequest<CustomerDto>("/org/numbatrak/crm/customers", { method: "POST", body });
  return customerFromDto(dto);
}

export async function updateCustomer(id: string, body: Record<string, unknown>): Promise<Customer> {
  const dto = await apiRequest<CustomerDto>(`/org/numbatrak/crm/customers/${id}`, { method: "PATCH", body });
  return customerFromDto(dto);
}

export async function fetchFeedbackCalls(): Promise<FeedbackCall[]> {
  const { calls } = await apiRequest<{ calls: FeedbackCallDto[] }>("/org/numbatrak/crm/feedback-calls");
  return calls.map(feedbackCallFromDto);
}

export async function createFeedbackCall(body: Record<string, unknown>): Promise<FeedbackCall> {
  const dto = await apiRequest<FeedbackCallDto>("/org/numbatrak/crm/feedback-calls", { method: "POST", body });
  return feedbackCallFromDto(dto);
}

export async function dispositionFeedbackCall(id: string, body: Record<string, unknown>): Promise<FeedbackCall> {
  const dto = await apiRequest<FeedbackCallDto>(`/org/numbatrak/crm/feedback-calls/${id}/disposition`, { method: "POST", body });
  return feedbackCallFromDto(dto);
}

export async function fetchComplaints(): Promise<Complaint[]> {
  const { complaints } = await apiRequest<{ complaints: ComplaintDto[] }>("/org/numbatrak/crm/complaints");
  return complaints.map(complaintFromDto);
}

export async function createComplaint(body: Record<string, unknown>): Promise<Complaint> {
  const dto = await apiRequest<ComplaintDto>("/org/numbatrak/crm/complaints", { method: "POST", body });
  return complaintFromDto(dto);
}

export async function escalateComplaint(id: string): Promise<Complaint> {
  const dto = await apiRequest<ComplaintDto>(`/org/numbatrak/crm/complaints/${id}/escalate`, { method: "POST" });
  return complaintFromDto(dto);
}

export async function resolveComplaint(id: string, body: { resolution: string; resolutionType: string }): Promise<Complaint> {
  const dto = await apiRequest<ComplaintDto>(`/org/numbatrak/crm/complaints/${id}/resolve`, { method: "POST", body });
  return complaintFromDto(dto);
}

export async function fetchMorePurchases(): Promise<MorePurchase[]> {
  const { purchases } = await apiRequest<{ purchases: MorePurchaseDto[] }>("/org/numbatrak/crm/more-purchases");
  return purchases.map(morePurchaseFromDto);
}

export async function createMorePurchase(body: Record<string, unknown>): Promise<MorePurchase> {
  const dto = await apiRequest<MorePurchaseDto>("/org/numbatrak/crm/more-purchases", { method: "POST", body });
  return morePurchaseFromDto(dto);
}

export async function updateMorePurchaseStatus(id: string, status: string): Promise<MorePurchase> {
  const dto = await apiRequest<MorePurchaseDto>(`/org/numbatrak/crm/more-purchases/${id}/status`, { method: "PATCH", body: { status } });
  return morePurchaseFromDto(dto);
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { campaigns } = await apiRequest<{ campaigns: CampaignDto[] }>("/org/numbatrak/crm/campaigns");
  return campaigns.map(campaignFromDto);
}

export async function createCampaign(body: Record<string, unknown>): Promise<Campaign> {
  const dto = await apiRequest<CampaignDto>("/org/numbatrak/crm/campaigns", { method: "POST", body });
  return campaignFromDto(dto);
}

export async function sendCampaign(id: string): Promise<Campaign> {
  const dto = await apiRequest<CampaignDto>(`/org/numbatrak/crm/campaigns/${id}/send`, { method: "POST" });
  return campaignFromDto(dto);
}

export async function fetchCredits(): Promise<CrmCredit[]> {
  const { credits } = await apiRequest<{ credits: CreditDto[] }>("/org/numbatrak/crm/credits");
  return credits;
}

export async function addCredits(channel: string, amount: number): Promise<CrmCredit> {
  return apiRequest<CrmCredit>("/org/numbatrak/crm/credits", { method: "POST", body: { channel, amount } });
}

export async function fetchFeedbackDashboard(): Promise<FeedbackDashboard> {
  const dto = await apiRequest<FeedbackDashboardDto>("/org/numbatrak/crm/feedback-dashboard");
  return feedbackDashboardFromDto(dto);
}

export async function fetchComplaintDashboard(): Promise<ComplaintDashboard> {
  const dto = await apiRequest<ComplaintDashboardDto>("/org/numbatrak/crm/complaint-dashboard");
  return complaintDashboardFromDto(dto);
}
