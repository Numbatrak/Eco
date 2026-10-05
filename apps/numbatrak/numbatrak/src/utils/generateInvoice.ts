import jsPDF from "jspdf";
import { OrderWithRelations } from "../types/order";

export interface InvoiceBrandingOptions {
  organizationName?: string;
  /** Public URL of the org's logo (e.g. Organization.logo_url) - fetched and embedded if reachable. */
  logoUrl?: string | null;
  /** Free-text business address shown under the org name. */
  businessAddress?: string | null;
}

/** Fetches an image URL and converts it to a data: URL jsPDF's addImage can embed - returns null on any failure (network, CORS, non-image), so a broken/unreachable logo never blocks invoice generation. */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

/**
 * Generate and download a PDF invoice for an order
 */
export async function generateInvoicePDF(
  order: OrderWithRelations,
  branding?: InvoiceBrandingOptions | string
): Promise<void> {
  // Accept the old `organizationName?: string` positional form too, so
  // existing callers that haven't moved to the options object keep working.
  const options: InvoiceBrandingOptions =
    typeof branding === "string" ? { organizationName: branding } : (branding ?? {});
  const { organizationName, logoUrl, businessAddress } = options;

  const logoDataUrl = logoUrl ? await fetchImageAsDataUrl(logoUrl) : null;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  if (logoDataUrl) {
    try {
      const logoHeight = 16;
      const logoWidth = 16;
      doc.addImage(logoDataUrl, imageFormatFromDataUrl(logoDataUrl), margin, yPosition, logoWidth, logoHeight);
    } catch {
      // Malformed image data - skip the logo rather than fail the whole invoice.
    }
  }

  // Helper function to format currency
  const formatCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return "₦0";
    return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  // Helper function to format date
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number): void => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - margin, yPosition, { align: "right" });
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  if (organizationName) {
    doc.text(organizationName, pageWidth - margin, yPosition, { align: "right" });
    yPosition += 6;
  }
  if (businessAddress) {
    doc.setFontSize(9);
    const addressLines = doc.splitTextToSize(businessAddress, 80);
    doc.text(addressLines, pageWidth - margin, yPosition, { align: "right" });
    yPosition += addressLines.length * 5;
    doc.setFontSize(12);
  }
  yPosition += 10;

  // Invoice Details Section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Details", margin, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.text(`Invoice Number: #${order.id}`, margin, yPosition);
  yPosition += 6;
  doc.text(`Invoice Date: ${formatDate(order.order_date)}`, margin, yPosition);
  yPosition += 6;
  if (order.delivery_date) {
    doc.text(`Delivery Date: ${formatDate(order.delivery_date)}`, margin, yPosition);
    yPosition += 6;
  }
  yPosition += 5;

  // Customer Information
  checkPageBreak(30);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To", margin, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.text(order.customer_name || "N/A", margin, yPosition);
  yPosition += 6;
  if (order.phone_number) {
    doc.text(`Phone: ${order.phone_number}`, margin, yPosition);
    yPosition += 6;
  }
  if (order.location) {
    doc.text(`Location: ${order.location}`, margin, yPosition);
    yPosition += 6;
  }
  yPosition += 10;

  // Items Table Header
  checkPageBreak(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const tableStartY = yPosition;
  doc.text("Item", margin, yPosition);
  doc.text("Quantity", margin + 80, yPosition);
  doc.text("Unit Price", margin + 120, yPosition);
  doc.text("Total", pageWidth - margin - 30, yPosition, { align: "right" });
  yPosition += 8;

  // Draw line under header
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  // Items
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  // Product 1
  if (order.product_name) {
    checkPageBreak(20);
    const quantity = order.quantity || order.mail_quan || order.agent_quan || 1;
    // If there's a product2, we'll show product1 with its portion of the total
    // Otherwise, show the full sales_price for product1
    const hasProduct2 = !!order.product2;
    const product1Total = hasProduct2 
      ? (order.sales_price ? order.sales_price * 0.6 : 0) // Estimate 60% for product1 if both exist
      : (order.sales_price || 0);
    const unitPrice = quantity > 0 ? product1Total / quantity : 0;

    doc.text(order.product_name, margin, yPosition);
    doc.text(quantity.toString(), margin + 80, yPosition);
    doc.text(formatCurrency(unitPrice), margin + 120, yPosition);
    doc.text(formatCurrency(product1Total), pageWidth - margin - 30, yPosition, { align: "right" });
    yPosition += 8;
  }

  // Product 2
  if (order.product2) {
    checkPageBreak(20);
    const quantity2 = order.quantity2 || order.mail_quan2 || order.agent_quan2 || 1;
    // Calculate product2 total as the remaining portion
    const product1Total = order.product_name 
      ? (order.sales_price ? order.sales_price * 0.6 : 0)
      : 0;
    const product2Total = order.sales_price ? order.sales_price - product1Total : 0;
    const unitPrice2 = quantity2 > 0 ? product2Total / quantity2 : 0;

    doc.text(order.product2, margin, yPosition);
    doc.text(quantity2.toString(), margin + 80, yPosition);
    doc.text(formatCurrency(unitPrice2), margin + 120, yPosition);
    doc.text(formatCurrency(product2Total), pageWidth - margin - 30, yPosition, { align: "right" });
    yPosition += 8;
  }

  yPosition += 5;

  // Draw line before totals
  checkPageBreak(30);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Totals Section
  doc.setFontSize(10);
  const subtotal = order.sales_price || 0;
  const deliveryFee = order.delivery_fee || 0;
  const total = subtotal + deliveryFee;

  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", pageWidth - margin - 60, yPosition, { align: "right" });
  doc.text(formatCurrency(subtotal), pageWidth - margin - 30, yPosition, { align: "right" });
  yPosition += 8;

  if (deliveryFee > 0) {
    doc.text("Delivery Fee:", pageWidth - margin - 60, yPosition, { align: "right" });
    doc.text(formatCurrency(deliveryFee), pageWidth - margin - 30, yPosition, { align: "right" });
    yPosition += 8;
  }

  // Total
  checkPageBreak(15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total:", pageWidth - margin - 60, yPosition, { align: "right" });
  doc.text(formatCurrency(total), pageWidth - margin - 30, yPosition, { align: "right" });
  yPosition += 15;

  // Payment Information
  checkPageBreak(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Payment Information", margin, yPosition);
  yPosition += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Payment Method: Pay on Delivery", margin, yPosition);
  yPosition += 6;
  doc.text(`Order Status: ${order.order_status || "Pending"}`, margin, yPosition);
  yPosition += 10;

  // Notes
  if (order.note) {
    checkPageBreak(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Notes", margin, yPosition);
    yPosition += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const splitNote = doc.splitTextToSize(order.note, pageWidth - 2 * margin);
    doc.text(splitNote, margin, yPosition);
    yPosition += splitNote.length * 5;
  }

  // Footer
  const footerY = pageHeight - 20;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(128, 128, 128);
  doc.text(
    "Thank you for your business!",
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // Generate filename
  const invoiceNumber = `INV-${order.id}`;
  const customerName = order.customer_name?.replace(/[^a-z0-9]/gi, "_") || "Customer";
  const filename = `${invoiceNumber}_${customerName}.pdf`;

  // Save the PDF
  doc.save(filename);
}

