import { FormEvent, useRef, useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { Pencil, Plus } from "lucide-react";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { OrderWithRelations } from "../../types/order";
import { fetchAgents, Agent } from "../../services/agents";
import { useOrganization } from "../../contexts/OrganizationContext";
import { fetchProducts, Product } from "../../services/products";
import { getProductPriceByName } from "../../services/products";
import { filterActiveAgents } from "../../utils/agentFilters";

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  order: OrderWithRelations | null;
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function OrderDialog({
  open,
  onOpenChange,
  mode,
  order,
  error,
  saving,
  onSubmit,
}: OrderDialogProps) {
  const { currentOrganization } = useOrganization();
  const formRef = useRef<HTMLFormElement>(null);
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [location, setLocation] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [orderMonth, setOrderMonth] = useState("");
  const [orderYear, setOrderYear] = useState("");
  const [productName, setProductName] = useState("");
  const [mailQuan, setMailQuan] = useState("");
  const [agentQuan, setAgentQuan] = useState("");
  const [quantity, setQuantity] = useState("");
  const [product2, setProduct2] = useState("");
  const [mailQuan2, setMailQuan2] = useState("");
  const [agentQuan2, setAgentQuan2] = useState("");
  const [quantity2, setQuantity2] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [salesPrice, setSalesPrice] = useState("");
  const [profit, setProfit] = useState("");
  const [orderStatus, setOrderStatus] = useState("Pending");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryMonth, setDeliveryMonth] = useState("");
  const [deliveryYear, setDeliveryYear] = useState("");
  const [confirmedDelivery, setConfirmedDelivery] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [note, setNote] = useState("");
  const [subject, setSubject] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [upsellProduct, setUpsellProduct] = useState("");
  const [upsellQuantity, setUpsellQuantity] = useState("");
  const [upsellPrice, setUpsellPrice] = useState("");

  const selectableAgents = useMemo(() => {
    const active = filterActiveAgents(agents);
    if (!agentName?.trim()) {
      return active;
    }
    const trimmed = agentName.trim().toLowerCase();
    const current = agents.find(
      (agent) => agent.name?.trim().toLowerCase() === trimmed
    );
    if (current && !active.some((agent) => agent.id === current.id)) {
      return [current, ...active];
    }
    return active;
  }, [agents, agentName]);

  // Fetch agents and products when dialog opens
  useEffect(() => {
    if (open && currentOrganization) {
      loadAgents();
      loadProducts();
    }
  }, [open, currentOrganization]);

  const loadAgents = async () => {
    if (!currentOrganization) return;
    try {
      setLoadingAgents(true);
      const agentsData = await fetchAgents(currentOrganization.id);
      setAgents(agentsData || []);
    } catch (err) {
      console.error("Error loading agents:", err);
      // Don't show error to user, just log it
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadProducts = async () => {
    if (!currentOrganization) return;
    try {
      setLoadingProducts(true);
      const productsData = await fetchProducts(currentOrganization.id, {
        activeOnly: true,
      });
      setProducts(productsData || []);
    } catch (err) {
      console.error("Error loading products:", err);
      // Don't show error to user, just log it
    } finally {
      setLoadingProducts(false);
    }
  };

  // Valid order status values
  const validOrderStatuses = ["Pending", "Delivered", "Cancelled"];

  useEffect(() => {
    if (open) {
      if (order && mode === "edit") {
        setCustomerName(order.customer_name || "");
        setPhoneNumber(order.phone_number || "");
        setLocation(order.location || "");
        setOrderDate(order.order_date || "");
        setOrderMonth(order.order_month || "");
        setOrderYear(order.order_year || "");
        setProductName(order.product_name || "");
        setMailQuan(order.mail_quan?.toString() || "");
        setAgentQuan(order.agent_quan?.toString() || "");
        setQuantity(order.quantity?.toString() || "");
        setProduct2(order.product2 || "");
        setMailQuan2(order.mail_quan2?.toString() || "");
        setAgentQuan2(order.agent_quan2?.toString() || "");
        setQuantity2(order.quantity2?.toString() || "");
        setUpsellProduct(order.product2 || "");
        setUpsellQuantity(order.quantity2?.toString() || "");
        // Note: Upsell price will be calculated in useEffect when orderDate is set
        setCostPrice(order.cost_price?.toString() || "");
        setDeliveryFee(order.delivery_fee?.toString() || "");
        setSalesPrice(order.sales_price?.toString() || "");
        setProfit(order.profit?.toString() || "");
        // Validate order status - default to "Pending" if invalid
        const orderStatusValue = order.order_status || "Pending";
        setOrderStatus(
          validOrderStatuses.includes(orderStatusValue)
            ? orderStatusValue
            : "Pending"
        );
        setDeliveryDate(order.delivery_date || "");
        setDeliveryMonth(order.delivery_month || "");
        setDeliveryYear(order.delivery_year || "");
        setConfirmedDelivery(order.confirmed_delivery || false);
        // Ensure agent_name is a valid string
        const agentNameValue =
          order.agent_name && typeof order.agent_name === "string"
            ? order.agent_name.trim()
            : "";
        setAgentName(agentNameValue);
        setNote(order.note || "");
        setSubject(order.subject || "");
      } else {
        // Reset form for create mode
        const today = new Date();
        setCustomerName("");
        setPhoneNumber("");
        setLocation("");
        setOrderDate(today.toISOString().split("T")[0]);
        setOrderMonth(today.toLocaleString("default", { month: "long" }));
        setOrderYear(today.getFullYear().toString());
        setProductName("");
        setMailQuan("");
        setAgentQuan("");
        setQuantity("");
        setProduct2("");
        setMailQuan2("");
        setAgentQuan2("");
        setQuantity2("");
        setUpsellProduct("");
        setUpsellQuantity("");
        setUpsellPrice("");
        setCostPrice("");
        setDeliveryFee("");
        setSalesPrice("");
        setProfit("");
        setOrderStatus("Pending");
        setDeliveryDate("");
        setDeliveryMonth("");
        setDeliveryYear("");
        setConfirmedDelivery(false);
        setAgentName("");
        setNote("");
        setSubject("");
      }
    }
  }, [open, order, mode]);

  const handleSubmitClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  // Calculate product price and auto-fill cost_price and sales_price
  const calculateProductPrice = async (productName: string, qty: number) => {
    if (mode === "edit" || !productName || !currentOrganization || !orderDate) return;

    try {
      const price = await getProductPriceByName(
        productName,
        currentOrganization.id,
        orderDate,
        qty || 1
      );

      if (price) {
        const totalCost = price.unit_cost * (qty || 1);
        const totalSales = price.sales_price * (qty || 1);
        
        // Only auto-fill if fields are empty or if user hasn't manually changed them
        if (!costPrice || costPrice === "") {
          setCostPrice(totalCost.toFixed(2));
        }
        if (!salesPrice || salesPrice === "") {
          setSalesPrice(totalSales.toFixed(2));
        }
        
        // Recalculate profit
        calculateProfit();
      }
    } catch (err) {
      console.error("Error calculating product price:", err);
    }
  };

  // Calculate upsell price
  const calculateUpsellPrice = async (upsellProductName: string, qty: number, date?: string) => {
    if (mode === "edit" || !upsellProductName || !currentOrganization) return;

    try {
      const price = await getProductPriceByName(
        upsellProductName,
        currentOrganization.id,
        date || orderDate,
        qty || 1
      );

      if (price) {
        const totalSales = price.sales_price * (qty || 1);
        setUpsellPrice(totalSales.toFixed(2));
        
        // Recalculate total profit including upsell
        calculateProfit();
      }
    } catch (err) {
      console.error("Error calculating upsell price:", err);
    }
  };

  // Calculate profit automatically
  const calculateProfit = () => {
    const cost = parseFloat(costPrice || "0");
    const sales = parseFloat(salesPrice || "0");
    const delivery = parseFloat(deliveryFee || "0");
    const upsell = parseFloat(upsellPrice || "0");
    
    const totalCost = cost;
    const totalSales = sales + upsell;
    const profitValue = totalSales - totalCost - delivery;
    
    setProfit(profitValue.toFixed(2));
  };

  // Format currency for display
  const formatCurrency = (value: number | null | string) => {
    if (value === null || value === undefined || value === "") return "₦0.00";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return "₦0.00";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
    }).format(numValue);
  };

  // Get calculated profit value as number
  const getCalculatedProfit = (): number => {
    const cost = parseFloat(costPrice || "0");
    const sales = parseFloat(salesPrice || "0");
    const delivery = parseFloat(deliveryFee || "0");
    const upsell = parseFloat(upsellPrice || "0");
    
    const totalCost = cost;
    const totalSales = sales + upsell;
    return totalSales - totalCost - delivery;
  };

  // Handle product name change
  const handleProductNameChange = async (value: string) => {
    setProductName(value);
    if (value && quantity) {
      await calculateProductPrice(value, parseInt(quantity) || 1);
    }
  };

  // Handle quantity change
  const handleQuantityChange = async (value: string) => {
    setQuantity(value);
    if (productName && value) {
      await calculateProductPrice(productName, parseInt(value) || 1);
    }
    calculateProfit();
  };

  // Handle cost price, sales price, or delivery fee change
  const handlePriceChange = (field: "cost" | "sales" | "delivery", value: string) => {
    if (field === "cost") setCostPrice(value);
    if (field === "sales") setSalesPrice(value);
    if (field === "delivery") setDeliveryFee(value);
    // Recalculate profit after a short delay to allow state to update
    setTimeout(() => calculateProfit(), 100);
  };

  // Handle upsell product change
  const handleUpsellProductChange = async (value: string) => {
    // Handle the special "__none__" value
    if (value === "__none__") {
      setUpsellProduct("");
      setUpsellPrice("");
      setProduct2("");
      calculateProfit();
      return;
    }
    setUpsellProduct(value);
    setProduct2(value);
    if (value && upsellQuantity) {
      await calculateUpsellPrice(value, parseInt(upsellQuantity) || 1);
    }
  };

  // Handle upsell quantity change
  const handleUpsellQuantityChange = async (value: string) => {
    setUpsellQuantity(value);
    setQuantity2(value);
    if (upsellProduct && value) {
      await calculateUpsellPrice(upsellProduct, parseInt(value) || 1);
    }
    calculateProfit();
  };

  // Recalculate catalog prices on create only (economics are immutable on edit)
  useEffect(() => {
    if (mode !== "create" || !open) return;
    if (productName && quantity && orderDate && currentOrganization) {
      calculateProductPrice(productName, parseInt(quantity) || 1);
    }
    if (upsellProduct && upsellQuantity && orderDate && currentOrganization) {
      calculateUpsellPrice(upsellProduct, parseInt(upsellQuantity) || 1, orderDate);
    }
  }, [mode, open, orderDate, currentOrganization, productName, quantity, upsellProduct, upsellQuantity]);

  // Recalculate profit whenever relevant values change
  useEffect(() => {
    if (open) {
      calculateProfit();
    }
  }, [open, costPrice, salesPrice, deliveryFee, upsellPrice]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={
            mode === "edit" ? (
              <Pencil className="h-7 w-7" aria-hidden />
            ) : (
              <Plus className="h-7 w-7" aria-hidden />
            )
          }
          title={mode === "edit" ? "Edit Order" : "Create New Order"}
          description={
            mode === "edit"
              ? "Update order information"
              : "Add a new order entry"
          }
        />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
            {error && <ErrorAlert message={error} />}

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                Customer Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="customer_name"
                    className="text-sm font-semibold text-foreground"
                  >
                    Customer Name *
                  </Label>
                  <Input
                    id="customer_name"
                    name="customer_name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="phone_number"
                    className="text-sm font-semibold text-foreground"
                  >
                    Phone Number
                  </Label>
                  <Input
                    id="phone_number"
                    name="phone_number"
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="location"
                    className="text-sm font-semibold text-foreground"
                  >
                    Location
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="order_status"
                    className="text-sm font-semibold text-foreground"
                  >
                    Order Status
                  </Label>
                  <Select
                    value={
                      validOrderStatuses.includes(orderStatus)
                        ? orderStatus
                        : "Pending"
                    }
                    onValueChange={(value) => {
                      if (validOrderStatuses.includes(value)) {
                        setOrderStatus(value);
                      } else {
                        setOrderStatus("Pending");
                      }
                    }}
                  >
                    <SelectTrigger id="order_status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Delivered">Delivered</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    name="order_status"
                    value={orderStatus}
                  />
                </div>
              </div>
            </div>

            {/* Order Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                Order Information
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="order_date"
                    className="text-sm font-semibold text-foreground"
                  >
                    Order Date *
                  </Label>
                  <Input
                    id="order_date"
                    name="order_date"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="order_month"
                    className="text-sm font-semibold text-foreground"
                  >
                    Order Month
                  </Label>
                  <Input
                    id="order_month"
                    name="order_month"
                    type="text"
                    value={orderMonth}
                    onChange={(e) => setOrderMonth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="order_year"
                    className="text-sm font-semibold text-foreground"
                  >
                    Order Year
                  </Label>
                  <Input
                    id="order_year"
                    name="order_year"
                    type="text"
                    value={orderYear}
                    onChange={(e) => setOrderYear(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Product Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                Product Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="product_name"
                    className="text-sm font-semibold text-foreground"
                  >
                    Product Name
                  </Label>
                  <Select
                    value={productName}
                    onValueChange={handleProductNameChange}
                    disabled={loadingProducts}
                  >
                    <SelectTrigger id="product_name">
                      <SelectValue
                        placeholder={
                          loadingProducts
                            ? "Loading products..."
                            : "Select a product or type to add new"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.name}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder="Or type a new product name"
                    value={productName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProductName(value);
                      // If it's not in the products list, allow manual entry
                      if (value && quantity) {
                        calculateProductPrice(value, parseInt(quantity) || 1);
                      }
                    }}
                    className="mt-2"
                  />
                  <input
                    type="hidden"
                    name="product_name"
                    value={productName || ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="quantity"
                    className="text-sm font-semibold text-foreground"
                  >
                    Quantity
                  </Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="mail_quan"
                    className="text-sm font-semibold text-foreground"
                  >
                    Mail Quantity
                  </Label>
                  <Input
                    id="mail_quan"
                    name="mail_quan"
                    type="number"
                    min="0"
                    value={mailQuan}
                    onChange={(e) => setMailQuan(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="agent_quan"
                    className="text-sm font-semibold text-foreground"
                  >
                    Agent Quantity
                  </Label>
                  <Input
                    id="agent_quan"
                    name="agent_quan"
                    type="number"
                    min="0"
                    value={agentQuan}
                    onChange={(e) => setAgentQuan(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Upsell Items */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                Upsell Items (e.g., Mop, Accessories)
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="upsell_product"
                    className="text-sm font-semibold text-foreground"
                  >
                    Upsell Product
                  </Label>
                  <Select
                    value={upsellProduct || "__none__"}
                    onValueChange={handleUpsellProductChange}
                    disabled={loadingProducts}
                  >
                    <SelectTrigger id="upsell_product">
                      <SelectValue
                        placeholder={
                          loadingProducts
                            ? "Loading products..."
                            : "Select upsell product"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.name}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder="Or type a new product name"
                    value={upsellProduct}
                    onChange={(e) => {
                      const value = e.target.value;
                      setUpsellProduct(value);
                      setProduct2(value);
                      if (value && upsellQuantity) {
                        calculateUpsellPrice(value, parseInt(upsellQuantity) || 1);
                      }
                    }}
                    className="mt-2"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="upsell_quantity"
                    className="text-sm font-semibold text-foreground"
                  >
                    Upsell Quantity
                  </Label>
                  <Input
                    id="upsell_quantity"
                    name="upsell_quantity"
                    type="number"
                    min="0"
                    value={upsellQuantity}
                    onChange={(e) => handleUpsellQuantityChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="upsell_price"
                    className="text-sm font-semibold text-foreground"
                  >
                    Upsell Price (₦)
                  </Label>
                  <Input
                    id="upsell_price"
                    name="upsell_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={upsellPrice}
                    onChange={(e) => {
                      setUpsellPrice(e.target.value);
                      calculateProfit();
                    }}
                    placeholder="Auto-calculated"
                    className="bg-muted"
                    title="Price is automatically calculated from product prices"
                  />
                </div>
              </div>
              <input type="hidden" name="product2" value={upsellProduct || ""} />
              <input type="hidden" name="quantity2" value={upsellQuantity || ""} />
            </div>

            {/* Pricing Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                Pricing Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="cost_price"
                    className="text-sm font-semibold text-foreground"
                  >
                    Cost Price (₦)
                  </Label>
                  <Input
                    id="cost_price"
                    name="cost_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => handlePriceChange("cost", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="delivery_fee"
                    className="text-sm font-semibold text-foreground"
                  >
                    Delivery Fee (₦)
                  </Label>
                  <Input
                    id="delivery_fee"
                    name="delivery_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryFee}
                    onChange={(e) => handlePriceChange("delivery", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="sales_price"
                    className="text-sm font-semibold text-foreground"
                  >
                    Sales Price (₦)
                  </Label>
                  <Input
                    id="sales_price"
                    name="sales_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={salesPrice}
                    onChange={(e) => handlePriceChange("sales", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="profit"
                    className="text-sm font-semibold text-foreground"
                  >
                    Profit / Loss (₦)
                  </Label>
                  <div
                    id="profit"
                    className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-semibold items-center text-foreground"
                  >
                    <span
                      className={
                        getCalculatedProfit() >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {formatCurrency(getCalculatedProfit())}
                    </span>
                    {getCalculatedProfit() < 0 && (
                      <span className="ml-2 text-xs text-red-600">(Loss)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                Delivery Information
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="delivery_date"
                    className="text-sm font-semibold text-foreground"
                  >
                    Delivery Date
                  </Label>
                  <Input
                    id="delivery_date"
                    name="delivery_date"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="delivery_month"
                    className="text-sm font-semibold text-foreground"
                  >
                    Delivery Month
                  </Label>
                  <Input
                    id="delivery_month"
                    name="delivery_month"
                    type="text"
                    value={deliveryMonth}
                    onChange={(e) => setDeliveryMonth(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="delivery_year"
                    className="text-sm font-semibold text-foreground"
                  >
                    Delivery Year
                  </Label>
                  <Input
                    id="delivery_year"
                    name="delivery_year"
                    type="text"
                    value={deliveryYear}
                    onChange={(e) => setDeliveryYear(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="agent_name"
                    className="text-sm font-semibold text-foreground"
                  >
                    Agent Name
                  </Label>
                  <Select
                    value={(() => {
                      // Ensure the value matches an available option
                      if (!agentName || agentName.trim() === "") {
                        return "__unassigned__";
                      }
                      const trimmedName = agentName.trim();
                      // Return trimmed name - it will match either an agent item or the "Not in list" item
                      return trimmedName;
                    })()}
                    onValueChange={(value) => {
                      // Convert "__unassigned__" back to empty string for form submission
                      if (value === "__unassigned__") {
                        setAgentName("");
                      } else {
                        setAgentName(value || "");
                      }
                    }}
                    disabled={loadingAgents}
                  >
                    <SelectTrigger id="agent_name">
                      <SelectValue
                        placeholder={
                          loadingAgents
                            ? "Loading agents..."
                            : "Select an agent (optional)"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {(() => {
                        // Track seen names to avoid duplicates (case-insensitive)
                        const seenNames = new Set<string>();
                        const trimmedAgentName =
                          agentName && typeof agentName === "string"
                            ? agentName.trim()
                            : "";

                        // Check if current agent name exists in the list (case-insensitive, trimmed comparison)
                        const existsInList = trimmedAgentName
                          ? selectableAgents.some(
                              (agent) =>
                                agent.name &&
                                typeof agent.name === "string" &&
                                agent.name.trim().toLowerCase() ===
                                  trimmedAgentName.toLowerCase()
                            )
                          : false;

                        // First, render all valid agents
                        const agentItems = selectableAgents
                          .filter((agent) => {
                            // Ensure agent has valid id and name
                            if (
                              !agent ||
                              agent.id == null ||
                              agent.id === undefined
                            ) {
                              return false;
                            }
                            if (
                              !agent.name ||
                              typeof agent.name !== "string" ||
                              agent.name.trim() === ""
                            ) {
                              return false;
                            }
                            const name = agent.name.trim();
                            // If we've seen this name before (case-insensitive), skip it
                            if (seenNames.has(name.toLowerCase())) {
                              return false;
                            }
                            seenNames.add(name.toLowerCase());
                            return true;
                          })
                          .map((agent) => {
                            // Ensure we have valid values - always use trimmed version
                            const agentNameValue = agent.name
                              ? String(agent.name).trim()
                              : "";
                            // Skip if empty (we already have "Unassigned")
                            if (!agentNameValue) {
                              return null;
                            }
                            // Ensure id is valid for key
                            const agentKey =
                              agent.id != null
                                ? String(agent.id)
                                : `agent-${agentNameValue}`;
                            return (
                              <SelectItem key={agentKey} value={agentNameValue}>
                                {agentNameValue}
                              </SelectItem>
                            );
                          })
                          .filter((item) => item !== null);

                        // Then, if current agent name is not in list and not already seen, add it
                        if (
                          trimmedAgentName &&
                          !existsInList &&
                          !seenNames.has(trimmedAgentName.toLowerCase())
                        ) {
                          seenNames.add(trimmedAgentName.toLowerCase());
                          agentItems.push(
                            <SelectItem
                              key={`missing-${trimmedAgentName}`}
                              value={trimmedAgentName}
                            >
                              {trimmedAgentName} (Not in list)
                            </SelectItem>
                          );
                        }

                        return agentItems;
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center gap-2">
                    <input
                      id="confirmed_delivery"
                      name="confirmed_delivery"
                      type="checkbox"
                      checked={confirmedDelivery}
                      onChange={(e) => setConfirmedDelivery(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <Label
                      htmlFor="confirmed_delivery"
                      className="text-sm font-semibold text-foreground"
                    >
                      Confirmed Delivery
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                Additional Information
              </h3>
              <div className="space-y-2">
                <Label
                  htmlFor="note"
                  className="text-sm font-semibold text-foreground"
                >
                  Note
                </Label>
                <Textarea
                  id="note"
                  name="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="subject"
                  className="text-sm font-semibold text-foreground"
                >
                  Subject
                </Label>
                <Input
                  id="subject"
                  name="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            </div>

            {/* Hidden fields for form submission */}
            <input type="hidden" name="order_month" value={orderMonth} />
            <input type="hidden" name="order_year" value={orderYear} />
            <input type="hidden" name="mail_quan" value={mailQuan || ""} />
            <input type="hidden" name="agent_quan" value={agentQuan || ""} />
            <input type="hidden" name="quantity" value={quantity || ""} />
            <input type="hidden" name="product2" value={upsellProduct || ""} />
            <input type="hidden" name="mail_quan2" value={mailQuan2 || ""} />
            <input type="hidden" name="agent_quan2" value={agentQuan2 || ""} />
            <input type="hidden" name="quantity2" value={upsellQuantity || ""} />
            <input type="hidden" name="cost_price" value={costPrice || ""} />
            <input
              type="hidden"
              name="delivery_fee"
              value={deliveryFee || ""}
            />
            <input type="hidden" name="sales_price" value={salesPrice || ""} />
            <input type="hidden" name="profit" value={profit || ""} />
            <input
              type="hidden"
              name="delivery_date"
              value={deliveryDate || ""}
            />
            <input
              type="hidden"
              name="delivery_month"
              value={deliveryMonth || ""}
            />
            <input
              type="hidden"
              name="delivery_year"
              value={deliveryYear || ""}
            />
            <input
              type="hidden"
              name="confirmed_delivery"
              value={confirmedDelivery ? "true" : "false"}
            />
            <input type="hidden" name="agent_name" value={agentName || ""} />
            <input type="hidden" name="note" value={note || ""} />
            <input type="hidden" name="subject" value={subject || ""} />
            <input
              type="hidden"
              name="phone_number"
              value={phoneNumber || ""}
            />
            <input type="hidden" name="location" value={location || ""} />
            <input
              type="hidden"
              name="product_name"
              value={productName || ""}
            />
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
            disabled={saving || !customerName || !orderDate}
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
                Processing...
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
                {mode === "edit" ? "Update Order" : "Create Order"}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
