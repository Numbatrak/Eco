import { FormEvent, useRef, useState, useEffect } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { AbandonedCartWithRelations } from "../../types/abandonedCart";
import { parseSelectedItems } from "../../utils/parseSelectedItems";
import { ShoppingCart } from "lucide-react";

interface AbandonedCartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: AbandonedCartWithRelations | null;
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function AbandonedCartDialog({
  open,
  onOpenChange,
  cart,
  error,
  saving,
  onSubmit,
}: AbandonedCartDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [state, setState] = useState("");
  const [location, setLocation] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [selectedItems, setSelectedItems] = useState("");
  const [productName, setProductName] = useState("");
  const [mailQuan, setMailQuan] = useState("");
  const [agentQuan, setAgentQuan] = useState("");
  const [quantity, setQuantity] = useState("");
  const [product2, setProduct2] = useState("");
  const [mailQuan2, setMailQuan2] = useState("");
  const [agentQuan2, setAgentQuan2] = useState("");
  const [quantity2, setQuantity2] = useState("");
  const [salesPrice, setSalesPrice] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [filledFieldsCount, setFilledFieldsCount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open && cart) {
      setCustomerName(cart.customer_name || "");
      setPhoneNumber(cart.phone_number || "");
      setWhatsappNumber(cart.whatsapp_number || "");
      setDeliveryAddress(cart.delivery_address || "");
      setState(cart.state || "");
      setLocation(cart.location || "");
      setSelectedPackage(cart.selected_package || "");
      setSelectedItems(cart.selected_items || "");
      setProductName(cart.product_name || "");
      setMailQuan(cart.mail_quan?.toString() || "");
      setAgentQuan(cart.agent_quan?.toString() || "");
      setQuantity(cart.quantity?.toString() || "");
      setProduct2(cart.product2 || "");
      setMailQuan2(cart.mail_quan2?.toString() || "");
      setAgentQuan2(cart.agent_quan2?.toString() || "");
      setQuantity2(cart.quantity2?.toString() || "");
      setSalesPrice(cart.sales_price?.toString() || "");
      setPageUrl(cart.page_url || "");
      setFilledFieldsCount(cart.filled_fields_count?.toString() || "");
      setNote(cart.note || "");
    } else if (open && !cart) {
      // Reset form if no cart (shouldn't happen in edit mode, but just in case)
      setCustomerName("");
      setPhoneNumber("");
      setWhatsappNumber("");
      setDeliveryAddress("");
      setState("");
      setLocation("");
      setSelectedPackage("");
      setSelectedItems("");
      setProductName("");
      setMailQuan("");
      setAgentQuan("");
      setQuantity("");
      setProduct2("");
      setMailQuan2("");
      setAgentQuan2("");
      setQuantity2("");
      setSalesPrice("");
      setPageUrl("");
      setFilledFieldsCount("");
      setNote("");
    }
  }, [open, cart]);

  const handleSubmitClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  const parsedSelectedItems = parseSelectedItems(selectedItems);
  const parsedSelectedPackage = parseSelectedItems(selectedPackage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<ShoppingCart className="h-7 w-7" aria-hidden />}
          title="Edit Abandoned Cart"
          description="Update abandoned cart information"
        />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6 w-full">
            {error && <ErrorAlert message={error} />}

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="dialog-section-title">
                Customer Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="customer_name" className="dialog-field-label">
                    Customer Name
                  </Label>
                  <Input
                    id="customer_name"
                    name="customer_name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="phone_number" className="dialog-field-label">
                    Phone Number
                  </Label>
                  <Input
                    id="phone_number"
                    name="phone_number"
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="whatsapp_number" className="dialog-field-label">
                    WhatsApp Number
                  </Label>
                  <Input
                    id="whatsapp_number"
                    name="whatsapp_number"
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="delivery_address" className="dialog-field-label">
                    Delivery Address
                  </Label>
                  <Input
                    id="delivery_address"
                    name="delivery_address"
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="state" className="dialog-field-label">
                    State
                  </Label>
                  <Input
                    id="state"
                    name="state"
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="location" className="dialog-field-label">
                    Location (Combined)
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Auto-filled from address + state"
                    className="w-full max-w-none"
                  />
                </div>
              </div>
            </div>

            {/* Product Information */}
            <div className="space-y-4">
              <h3 className="dialog-section-title">
                Product Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="dialog-form-field space-y-2 md:col-span-2">
                  <Label htmlFor="selected_package" className="dialog-field-label">
                    Selected Package
                  </Label>
                  {parsedSelectedPackage.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {parsedSelectedPackage.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  <Input
                    id="selected_package"
                    name="selected_package"
                    type="text"
                    value={selectedPackage}
                    onChange={(e) => setSelectedPackage(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2 md:col-span-2">
                  <Label htmlFor="selected_items" className="dialog-field-label">
                    Selected Items
                  </Label>
                  {parsedSelectedItems.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="dialog-field-hint mb-2">Items from the abandoned form</p>
                      <ul className="flex flex-wrap gap-2">
                        {parsedSelectedItems.map((item) => (
                          <li
                            key={item}
                            className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Textarea
                    id="selected_items"
                    name="selected_items"
                    value={selectedItems}
                    onChange={(e) => setSelectedItems(e.target.value)}
                    rows={3}
                    placeholder="Comma-separated items or raw form value"
                    className="w-full max-w-none min-h-[5rem]"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="product_name" className="dialog-field-label">
                    Product Name
                  </Label>
                  <Input
                    id="product_name"
                    name="product_name"
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="quantity" className="dialog-field-label">
                    Quantity
                  </Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="mail_quan" className="dialog-field-label">
                    Mail Quantity
                  </Label>
                  <Input
                    id="mail_quan"
                    name="mail_quan"
                    type="number"
                    min="0"
                    value={mailQuan}
                    onChange={(e) => setMailQuan(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="agent_quan" className="dialog-field-label">
                    Agent Quantity
                  </Label>
                  <Input
                    id="agent_quan"
                    name="agent_quan"
                    type="number"
                    min="0"
                    value={agentQuan}
                    onChange={(e) => setAgentQuan(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="product2" className="dialog-field-label">
                    Product 2
                  </Label>
                  <Input
                    id="product2"
                    name="product2"
                    type="text"
                    value={product2}
                    onChange={(e) => setProduct2(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="quantity2" className="dialog-field-label">
                    Quantity 2
                  </Label>
                  <Input
                    id="quantity2"
                    name="quantity2"
                    type="number"
                    min="0"
                    value={quantity2}
                    onChange={(e) => setQuantity2(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="mail_quan2" className="dialog-field-label">
                    Mail Quantity 2
                  </Label>
                  <Input
                    id="mail_quan2"
                    name="mail_quan2"
                    type="number"
                    min="0"
                    value={mailQuan2}
                    onChange={(e) => setMailQuan2(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="agent_quan2" className="dialog-field-label">
                    Agent Quantity 2
                  </Label>
                  <Input
                    id="agent_quan2"
                    name="agent_quan2"
                    type="number"
                    min="0"
                    value={agentQuan2}
                    onChange={(e) => setAgentQuan2(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="sales_price" className="dialog-field-label">
                    Sales Price (₦)
                  </Label>
                  <Input
                    id="sales_price"
                    name="sales_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={salesPrice}
                    onChange={(e) => setSalesPrice(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
              </div>
            </div>

            {/* Tracking Information */}
            <div className="space-y-4">
              <h3 className="dialog-section-title">
                Tracking Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="page_url" className="dialog-field-label">
                    Page URL
                  </Label>
                  <Input
                    id="page_url"
                    name="page_url"
                    type="url"
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="filled_fields_count" className="dialog-field-label">
                    Fields Filled Count
                  </Label>
                  <Input
                    id="filled_fields_count"
                    name="filled_fields_count"
                    type="number"
                    min="0"
                    value={filledFieldsCount}
                    onChange={(e) => setFilledFieldsCount(e.target.value)}
                    className="w-full max-w-none"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="dialog-section-title">
                Additional Information
              </h3>
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="note" className="dialog-field-label">
                  Note
                </Label>
                <Textarea
                  id="note"
                  name="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full max-w-none"
                />
              </div>
            </div>

          </form>
        </div>

        <div className="dialog-footer-bar">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="dialog-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-primary-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Updating...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Update Cart
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}






