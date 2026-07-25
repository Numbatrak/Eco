import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import {
  fetchInvoices,
  createInvoice,
  sendInvoice,
  markInvoicePaid,
  voidInvoice,
  type Invoice,
} from "../../services/invoicing";
import { generateInvoicePDF } from "../../utils/generateInvoice";
import { Plus, Send, CheckCircle, XCircle, Download } from "lucide-react";

function currency(v: number): string {
  return `₦${v.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  void: "bg-red-100 text-red-700",
};

export function InvoicingPage() {
  const { currentOrganization } = useOrganization();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<{ name: string; quantity: number; unitPrice: number }[]>([
    { name: "", quantity: 1, unitPrice: 0 },
  ]);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const list = await fetchInvoices();
      setInvoices(list);
    } catch (e) {
      console.error("Failed to load invoices", e);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    try {
      await createInvoice({
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerAddress: customerAddress || undefined,
        lineItems: lineItems.filter((i) => i.name),
        deliveryFee,
        notes: notes || undefined,
      });
      setShowCreate(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDeliveryFee(0);
      setNotes("");
      setLineItems([{ name: "", quantity: 1, unitPrice: 0 }]);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create invoice");
    }
  }

  async function handleAction(id: string, action: "send" | "paid" | "void") {
    try {
      if (action === "send") await sendInvoice(id);
      else if (action === "paid") await markInvoicePaid(id);
      else await voidInvoice(id);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    }
  }

  function handleDownload(invoice: Invoice) {
    const orderLike = {
      id: invoice.invoice_number,
      order_date: invoice.created_at,
      delivery_date: null,
      customer_name: invoice.customer_name,
      phone_number: invoice.customer_phone,
      location: invoice.customer_address,
      product_name: invoice.line_items[0]?.name ?? null,
      quantity: invoice.line_items[0]?.quantity ?? 1,
      sales_price: invoice.subtotal,
      delivery_fee: invoice.delivery_fee,
      order_status: invoice.status,
      note: invoice.notes,
      product2: invoice.line_items.length > 1 ? invoice.line_items[1]?.name : null,
      quantity2: invoice.line_items.length > 1 ? invoice.line_items[1]?.quantity : null,
      mail_quan: null,
      agent_quan: null,
      mail_quan2: null,
      agent_quan2: null,
    } as any;
    generateInvoicePDF(orderLike, currentOrganization?.name ?? undefined);
  }

  function addLineItem() {
    setLineItems([...lineItems, { name: "", quantity: 1, unitPrice: 0 }]);
  }

  function updateLineItem(idx: number, field: string, value: string | number) {
    setLineItems(lineItems.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function removeLineItem(idx: number) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoicing</h1>
            <p className="text-sm text-muted-foreground">Generate and manage invoices</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90">
            <Plus size={16} /> New Invoice
          </button>
        </div>

        {showCreate && (
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold">Create Invoice</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input placeholder="Customer Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="border rounded px-3 py-2 text-sm bg-background" />
              <input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="border rounded px-3 py-2 text-sm bg-background" />
              <input placeholder="Address" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="border rounded px-3 py-2 text-sm bg-background" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Line Items</label>
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input placeholder="Item name" value={item.name} onChange={(e) => updateLineItem(idx, "name", e.target.value)} className="border rounded px-2 py-1 text-sm flex-1 bg-background" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateLineItem(idx, "quantity", Number(e.target.value))} className="border rounded px-2 py-1 text-sm w-20 bg-background" />
                  <input type="number" placeholder="Price" value={item.unitPrice} onChange={(e) => updateLineItem(idx, "unitPrice", Number(e.target.value))} className="border rounded px-2 py-1 text-sm w-28 bg-background" />
                  {lineItems.length > 1 && (
                    <button onClick={() => removeLineItem(idx)} className="text-red-500 text-sm">Remove</button>
                  )}
                </div>
              ))}
              <button onClick={addLineItem} className="text-sm text-primary hover:underline">+ Add item</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="number" placeholder="Delivery Fee" value={deliveryFee} onChange={(e) => setDeliveryFee(Number(e.target.value))} className="border rounded px-3 py-2 text-sm bg-background" />
              <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-3 py-2 text-sm bg-background" />
            </div>

            <div className="flex gap-2">
              <button onClick={handleCreate} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">Create</button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded text-sm hover:bg-muted">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : invoices.length === 0 ? (
          <p className="text-muted-foreground">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Invoice #</th>
                  <th className="py-2 pr-4 font-medium">Customer</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 pr-4 font-mono">{inv.invoice_number}</td>
                    <td className="py-2 pr-4">{inv.customer_name || "-"}</td>
                    <td className="py-2 pr-4">{currency(inv.total)}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] ?? ""}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{formatDate(inv.created_at)}</td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button onClick={() => handleDownload(inv)} title="Download PDF" className="p-1 hover:bg-muted rounded">
                          <Download size={14} />
                        </button>
                        {inv.status === "draft" && (
                          <button onClick={() => handleAction(inv.id, "send")} title="Mark Sent" className="p-1 hover:bg-muted rounded text-blue-600">
                            <Send size={14} />
                          </button>
                        )}
                        {(inv.status === "draft" || inv.status === "sent") && (
                          <button onClick={() => handleAction(inv.id, "paid")} title="Mark Paid" className="p-1 hover:bg-muted rounded text-green-600">
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {inv.status !== "void" && inv.status !== "paid" && (
                          <button onClick={() => handleAction(inv.id, "void")} title="Void" className="p-1 hover:bg-muted rounded text-red-600">
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
