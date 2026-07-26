"use client";

import { apiRequest } from "../lib/apiClient";

interface InvoiceLineItemDto {
  name: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceDto {
  id: string;
  orderId: string | null;
  invoiceNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  lineItems: InvoiceLineItemDto[];
  notes: string | null;
  status: string;
  sentAt: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface InvoiceLineItem {
  name: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: string;
  order_id: string | null;
  invoice_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  line_items: InvoiceLineItem[];
  notes: string | null;
  status: string;
  sent_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function invoiceFromDto(d: InvoiceDto): Invoice {
  return {
    id: d.id,
    order_id: d.orderId,
    invoice_number: d.invoiceNumber,
    customer_name: d.customerName,
    customer_phone: d.customerPhone,
    customer_address: d.customerAddress,
    subtotal: d.subtotal,
    delivery_fee: d.deliveryFee,
    total: d.total,
    line_items: d.lineItems.map((i) => ({ name: i.name, quantity: i.quantity, unit_price: i.unitPrice })),
    notes: d.notes,
    status: d.status,
    sent_at: d.sentAt,
    created_by: d.createdBy,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  };
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const { invoices } = await apiRequest<{ invoices: InvoiceDto[] }>("/org/numbatrak/invoices");
  return invoices.map(invoiceFromDto);
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  const dto = await apiRequest<InvoiceDto>(`/org/numbatrak/invoices/${id}`);
  return invoiceFromDto(dto);
}

export async function createInvoice(body: {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  lineItems?: { name: string; quantity: number; unitPrice: number }[];
  deliveryFee?: number;
  notes?: string;
}): Promise<Invoice> {
  const dto = await apiRequest<InvoiceDto>("/org/numbatrak/invoices", { method: "POST", body });
  return invoiceFromDto(dto);
}

export async function createInvoiceFromOrder(orderId: string): Promise<Invoice> {
  const dto = await apiRequest<InvoiceDto>(`/org/numbatrak/invoices/from-order/${orderId}`, { method: "POST" });
  return invoiceFromDto(dto);
}

export async function sendInvoice(id: string): Promise<Invoice> {
  const dto = await apiRequest<InvoiceDto>(`/org/numbatrak/invoices/${id}/send`, { method: "POST" });
  return invoiceFromDto(dto);
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  const dto = await apiRequest<InvoiceDto>(`/org/numbatrak/invoices/${id}/paid`, { method: "POST" });
  return invoiceFromDto(dto);
}

export async function voidInvoice(id: string): Promise<Invoice> {
  const dto = await apiRequest<InvoiceDto>(`/org/numbatrak/invoices/${id}/void`, { method: "POST" });
  return invoiceFromDto(dto);
}
