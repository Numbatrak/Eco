import { FormEvent, useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Trash2,
  Plus,
  Eye,
  Package,
  Type,
  Mail,
  Phone,
  Hash,
  FileText,
  List,
  Radio,
  Sparkles,
  ArrowLeft,
  Save,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Settings,
  Zap,
  ChevronUp,
  CheckSquare,
  Download,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import "./FormBuilderPage.css";
import { useOrganization } from "../../contexts/OrganizationContext";
import { API_BASE_URL } from "../../lib/apiClient";
import {
  createForm,
  updateForm,
  fetchFormById,
  generateFormToken,
} from "../../services/forms";
import { fetchProducts } from "../../services/products";
import { fetchOffersForProducts } from "../../services/productOffers";
import { fetchVariantsForProducts } from "../../services/productVariants";
import { Product, ProductOffer, ProductVariant } from "../../types/product";
import {
  FormField,
  FormSchema,
  RadioOption,
  RadioOptionProduct,
} from "../../types/form";
import {
  validateFormBeforeSave,
  validateFormSchema,
  getFieldMappingSuggestions,
  isRequiredField,
  getDefaultRequiredFields,
  ensureRequiredFields,
} from "../../utils/formValidation";
import { useConfirm } from "../../contexts/ConfirmContext";
import { PageLayout } from "../layout/PageLayout";
import { LoadingState } from "../ui/LoadingState";
import {
  offerLabel,
  offersForProduct,
  offersForRadioOption,
} from "../../utils/formOfferItems";

export default function FormBuilderPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();

  // Fetch products from database
  const [products, setProducts] = useState<Product[]>([]);
  const [offersByProduct, setOffersByProduct] = useState<
    Record<string, ProductOffer[]>
  >({});
  const [variantsByProduct, setVariantsByProduct] = useState<
    Record<string, ProductVariant[]>
  >({});
  const [productsLoading, setProductsLoading] = useState(false);

  const [expandedRadioOptions, setExpandedRadioOptions] = useState<Set<string>>(
    new Set()
  );
  const [formName, setFormName] = useState("");
  const [formToken, setFormToken] = useState("");
  const [subBrand, setSubBrand] = useState("");
  const [funnelName, setFunnelName] = useState("");
  const [active, setActive] = useState(true);
  const [schema, setSchema] = useState<FormSchema>({
    fields: [],
    submitButton: {
      text: "Submit Order",
      loadingText: "Processing...",
    },
  });
  const [draggedField, setDraggedField] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<"builder" | "preview">("builder");
  const [saving, setSaving] = useState(false);
  const [showFieldTypeMenu, setShowFieldTypeMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!id;
  const mode: "create" | "edit" = isEditMode ? "edit" : "create";

  // Reason Save is disabled (so user knows what to fill in)
  const saveDisabledReason = saving
    ? null
    : !formName.trim() && !formToken.trim()
    ? "Form name and Form token are required to save."
    : !formName.trim()
    ? "Form name is required to save."
    : !formToken.trim()
    ? "Form token is required to save."
    : null;

  // Load products when organization is available
  useEffect(() => {
    if (currentOrganization) {
      loadProducts();
    }
  }, [currentOrganization?.id]);

  // Load form data if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      loadFormData(id);
    } else if (!isEditMode && !formToken) {
      // Generate a new token for new forms
      const token = generateFormToken();
      setFormToken(token);
      // Auto-add required fields for new forms
      const defaultFields = getDefaultRequiredFields();
      setSchema({
        fields: defaultFields,
        submitButton: {
          text: "Submit Order",
          loadingText: "Processing...",
        },
      });
    }
  }, [id, isEditMode, formToken]);

  // Strip unavailable products and inactive offers when catalog loads/updates
  useEffect(() => {
    if (products.length === 0) return;
    const productIds = new Set(products.map((p) => p.id));
    const activeOfferIds = new Set<string>();
    for (const list of Object.values(offersByProduct)) {
      for (const o of list) {
        if (o.active) activeOfferIds.add(o.id);
      }
    }
    const activeVariantIds = new Set<string>();
    for (const list of Object.values(variantsByProduct)) {
      for (const v of list) {
        if (v.active) activeVariantIds.add(v.id);
      }
    }

    setSchema((prev) => {
      if (!prev.fields?.length) return prev;
      let didChange = false;

      const cleanProducts = (lines: RadioOptionProduct[]): RadioOptionProduct[] =>
        lines
          .filter((p) => {
            if (p.product_id && !productIds.has(p.product_id)) {
              didChange = true;
              return false;
            }
            return true;
          })
          .map((p) => {
            let next = p;
            if (p.offer_id && !activeOfferIds.has(p.offer_id)) {
              didChange = true;
              next = { ...next, offer_id: null };
            }
            if (p.variant_id && !activeVariantIds.has(p.variant_id)) {
              didChange = true;
              next = { ...next, variant_id: null };
            }
            return next;
          });

      const cleanedFields = prev.fields.map((field) => {
        if (field.type === "radio-group" && field.radioOptions) {
          const radioOptions = field.radioOptions.map((option) => {
            let opt = option;
            if (option.offer_id && !activeOfferIds.has(option.offer_id)) {
              didChange = true;
              opt = { ...opt, offer_id: null };
            }
            const productsClean = cleanProducts(option.products ?? []);
            if (productsClean.length !== (option.products?.length ?? 0)) {
              opt = { ...opt, products: productsClean };
            } else if (productsClean.some((p, i) => p !== option.products[i])) {
              opt = { ...opt, products: productsClean };
            }
            return opt;
          });
          return { ...field, radioOptions };
        }
        if (field.type === "order-bump" && field.orderBump) {
          const bump = field.orderBump;
          let nextBump = bump;
          if (bump.offer_id && !activeOfferIds.has(bump.offer_id)) {
            didChange = true;
            nextBump = { ...nextBump, offer_id: null };
          }
          const productsClean = cleanProducts(bump.products ?? []);
          return {
            ...field,
            orderBump: { ...nextBump, products: productsClean },
          };
        }
        return field;
      });

      if (!didChange) return prev;
      return { ...prev, fields: cleanedFields };
    });
  }, [products, offersByProduct, variantsByProduct]);

  const loadProducts = async () => {
    if (!currentOrganization) return;
    try {
      setProductsLoading(true);
      const data = await fetchProducts(currentOrganization.id, {
        activeOnly: true,
      });
      setProducts(data);
      const ids = data.map((p) => p.id);
      const [offers, variants] = await Promise.all([
        fetchOffersForProducts(currentOrganization.id, ids),
        fetchVariantsForProducts(currentOrganization.id, ids),
      ]);
      setOffersByProduct(offers);
      setVariantsByProduct(variants);
    } catch (err) {
      console.error("Error loading products:", err);
      setError("Failed to load products. Please refresh the page.");
    } finally {
      setProductsLoading(false);
    }
  };

  const loadFormData = async (formId: string) => {
    try {
      setLoading(true);
      setError(null);
      const form = await fetchFormById(formId);
      if (form) {
        setFormName(form.name);
        setFormToken(form.form_token);
        setSubBrand(form.sub_brand ?? "");
        setFunnelName(form.funnel_name ?? "");
        setActive(form.active);
        // Ensure required fields exist when loading (in case they were deleted)
        const schemaWithRequired = ensureRequiredFields(form.schema);
        setSchema(schemaWithRequired);
      } else {
        setError("Form not found");
      }
    } catch (err: any) {
      console.error("Error loading form:", err);
      setError(err.message || "Failed to load form");
    } finally {
      setLoading(false);
    }
  };

  const toggleRadioOption = (optionId: string) => {
    setExpandedRadioOptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(optionId)) {
        newSet.delete(optionId);
      } else {
        newSet.add(optionId);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!currentOrganization) {
      setError("No organization selected");
      return;
    }

    if (!formName.trim()) {
      setError("Form name is required");
      return;
    }

    if (!formToken.trim()) {
      setError("Form token is required");
      return;
    }

    // Validate form schema has minimum required fields
    const validation = validateFormSchema(schema);
    if (!validation.isValid) {
      setError(
        `Form is missing required fields:\n${validation.missingFields
          .map((f) => `• ${f}`)
          .join("\n")}\n\n` +
          `Every form must include: First Name, Last Name, WhatsApp Number, Phone Number, State, Address, and Package selection.`
      );
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      console.warn("Form validation warnings:", validation.warnings);
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditMode && id) {
        // Update existing form
        await updateForm(id, {
          name: formName.trim(),
          form_token: formToken.trim(),
          schema: schema,
          active: active,
          sub_brand: subBrand.trim() || null,
          funnel_name: funnelName.trim() || null,
        });
      } else {
        // Create new form
        await createForm({
          name: formName.trim(),
          organization_id: currentOrganization.id,
          form_token: formToken.trim(),
          schema: schema,
          active: active,
          sub_brand: subBrand.trim() || null,
          funnel_name: funnelName.trim() || null,
        });
      }

      // Navigate back to forms list
      navigate("/forms");
    } catch (err: any) {
      console.error("Error saving form:", err);
      setError(err.message || "Failed to save form. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addField = (fieldType: FormField["type"] = "text") => {
    const fieldCount = schema.fields.length;
    const baseField: Partial<FormField> = {
      id: `field_${Date.now()}`,
      type: fieldType,
      label: `${
        fieldType === "radio-group"
          ? "Radio Group"
          : fieldType.charAt(0).toUpperCase() + fieldType.slice(1)
      } Field ${fieldCount + 1}`,
      name: `field_${fieldCount + 1}`,
      required: false,
    };

    let newField: FormField;

    if (fieldType === "radio-group") {
      newField = {
        ...baseField,
        type: "radio-group",
        radioOptions: [],
      } as FormField;
    } else if (fieldType === "order-bump") {
      newField = {
        ...baseField,
        type: "order-bump",
        label: "Order Bump",
        name: `order_bump_${fieldCount + 1}`,
        orderBump: {
          id: `bump_${Date.now()}`,
          title: "Add extra item",
          value: "order_bump",
          price: 0,
          products: [],
        },
      } as FormField;
    } else if (fieldType === "select") {
      newField = {
        ...baseField,
        type: "select",
        options: [],
        placeholder: "",
      } as FormField;
    } else {
      newField = {
        ...baseField,
        type: fieldType,
        placeholder: "",
      } as FormField;
    }

    setSchema({
      ...schema,
      fields: [...schema.fields, newField],
    });
    setShowFieldTypeMenu(false);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...schema.fields];
    const currentField = newFields[index];

    if (updates.type === "radio-group" && currentField.type !== "radio-group") {
      updates.radioOptions = updates.radioOptions || [];
    }

    if (updates.type === "order-bump" && currentField.type !== "order-bump") {
      updates.orderBump = updates.orderBump || {
        id: `bump_${Date.now()}`,
        title: "Add extra item",
        value: "order_bump",
        price: 0,
        products: [],
      };
    }

    if (
      currentField.type === "radio-group" &&
      updates.type &&
      updates.type !== "radio-group"
    ) {
      const { radioOptions, ...rest } = updates;
      updates = rest;
    }

    newFields[index] = { ...currentField, ...updates };
    setSchema({
      ...schema,
      fields: newFields,
    });
  };

  const removeField = async (index: number) => {
    const field = schema.fields[index];

    // Prevent deletion of required fields
    if (isRequiredField(field)) {
      setError(
        `Cannot delete required field "${field.label}". Required fields (First Name, Last Name, WhatsApp Number, Phone Number, State, Address, Package) cannot be deleted but can be moved.`
      );
      setTimeout(() => setError(null), 5000);
      return;
    }

    if (
      !(await confirm({
        title: "Remove field?",
        description: `Remove "${field.label}" from this form? Unsaved changes are not saved until you click Save.`,
        confirmLabel: "Remove",
        destructive: true,
      }))
    ) {
      return;
    }

    const newFields = schema.fields.filter((_, i) => i !== index);
    setSchema({
      ...schema,
      fields: newFields,
    });
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    const newFields = [...schema.fields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, removed);
    setSchema({
      ...schema,
      fields: newFields,
    });
  };

  const handleDragStart = (index: number) => {
    setDraggedField(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedField === null || draggedField === index) return;
    moveField(draggedField, index);
    setDraggedField(index);
  };

  const handleDragEnd = () => {
    setDraggedField(null);
  };

  const addRadioOption = (fieldIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group") return;

    const newOption: RadioOption = {
      id: `option_${Date.now()}`,
      title: `Option ${(field.radioOptions?.length || 0) + 1}`,
      value: `option_${(field.radioOptions?.length || 0) + 1}`,
      price: 0, // Default price - user must set it
      products: [],
    };

    updateField(fieldIndex, {
      radioOptions: [...(field.radioOptions || []), newOption],
    });
  };

  const updateRadioOption = (
    fieldIndex: number,
    optionIndex: number,
    updates: Partial<RadioOption>
  ) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group" || !field.radioOptions) return;

    const newOptions = [...field.radioOptions];
    newOptions[optionIndex] = { ...newOptions[optionIndex], ...updates };
    updateField(fieldIndex, { radioOptions: newOptions });
  };

  const removeRadioOption = async (fieldIndex: number, optionIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group" || !field.radioOptions) return;

    const option = field.radioOptions[optionIndex];
    if (
      !(await confirm({
        title: "Remove option?",
        description: `Remove "${option.title || option.value}" from this radio group?`,
        confirmLabel: "Remove",
        destructive: true,
      }))
    ) {
      return;
    }

    const newOptions = field.radioOptions.filter((_, i) => i !== optionIndex);
    updateField(fieldIndex, { radioOptions: newOptions });
  };

  const addProductToRadioOption = (fieldIndex: number, optionIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group" || !field.radioOptions) return;

    const option = field.radioOptions[optionIndex];
    // Use first available product, or empty string if no products
    const firstProduct = products.length > 0 ? products[0] : null;
    const newProduct: RadioOptionProduct = {
      product_id: firstProduct?.id || "", // UUID as string
      quantity: 1,
    };

    updateRadioOption(fieldIndex, optionIndex, {
      products: [...option.products, newProduct],
    });
  };

  const updateRadioOptionProduct = (
    fieldIndex: number,
    optionIndex: number,
    productIndex: number,
    updates: Partial<RadioOptionProduct>
  ) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group" || !field.radioOptions) return;

    const option = field.radioOptions[optionIndex];
    const newProducts = [...option.products];
    const merged = { ...newProducts[productIndex], ...updates };

    if (updates.product_id !== undefined && updates.product_id !== merged.product_id) {
      merged.offer_id = null;
      merged.variant_id = null;
    }

    newProducts[productIndex] = merged;
    updateRadioOption(fieldIndex, optionIndex, { products: newProducts });
  };

  const applyOfferToRadioOption = (
    fieldIndex: number,
    optionIndex: number,
    offerId: string | null
  ) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group" || !field.radioOptions) return;
    const option = field.radioOptions[optionIndex];
    const updates: Partial<RadioOption> = { offer_id: offerId || null };
    if (offerId) {
      for (const list of Object.values(offersByProduct)) {
        const offer = list.find((o) => o.id === offerId && o.active);
        if (offer) {
          updates.price = offer.price;
          if (!option.title.trim()) updates.title = offer.label;
          break;
        }
      }
    }
    updateRadioOption(fieldIndex, optionIndex, updates);
  };

  const removeProductFromRadioOption = (
    fieldIndex: number,
    optionIndex: number,
    productIndex: number
  ) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group" || !field.radioOptions) return;

    const option = field.radioOptions[optionIndex];
    const newProducts = option.products.filter((_, i) => i !== productIndex);
    updateRadioOption(fieldIndex, optionIndex, { products: newProducts });
  };

  const updateSubmitButton = (
    updates: Partial<NonNullable<FormSchema["submitButton"]>>
  ) => {
    setSchema({
      ...schema,
      submitButton: {
        text: updates.text ?? schema.submitButton?.text ?? "Submit Order",
        loadingText: updates.loadingText ?? schema.submitButton?.loadingText,
      },
    });
  };

  const getFieldIcon = (type: string) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case "text":
        return <Type className={iconClass} />;
      case "email":
        return <Mail className={iconClass} />;
      case "phone":
        return <Phone className={iconClass} />;
      case "number":
        return <Hash className={iconClass} />;
      case "textarea":
        return <FileText className={iconClass} />;
      case "select":
        return <List className={iconClass} />;
      case "radio-group":
        return <Radio className={iconClass} />;
      case "order-bump":
        return <CheckSquare className={iconClass} />;
      default:
        return <Type className={iconClass} />;
    }
  };

  const fieldTypes: Array<{
    type: FormField["type"];
    label: string;
    icon: React.ReactElement;
  }> = [
    { type: "text", label: "Text", icon: <Type className="w-4 h-4" /> },
    { type: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
    { type: "phone", label: "Phone", icon: <Phone className="w-4 h-4" /> },
    { type: "number", label: "Number", icon: <Hash className="w-4 h-4" /> },
    {
      type: "textarea",
      label: "Textarea",
      icon: <FileText className="w-4 h-4" />,
    },
    { type: "select", label: "Select", icon: <List className="w-4 h-4" /> },
    {
      type: "radio-group",
      label: "Radio Group",
      icon: <Radio className="w-4 h-4" />,
    },
    {
      type: "order-bump",
      label: "Order Bump",
      icon: <CheckSquare className="w-4 h-4" />,
    },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showFieldTypeMenu && !target.closest(".field-type-menu-container")) {
        setShowFieldTypeMenu(false);
      }
    };

    if (showFieldTypeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFieldTypeMenu]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`, { description: text, duration: 3000 });
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast.success(`${label} copied to clipboard!`, { description: text, duration: 3000 });
      } catch {
        toast.error(`Failed to copy ${label.toLowerCase()}`);
      }
      document.body.removeChild(textArea);
    }
  };

  const renderPreview = () => (
    <div className="preview-container">
      <form className="space-y-6">
        {schema.fields.map((field) => (
          <div key={field.id} className="preview-field">
            <label className="preview-label">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {field.type === "radio-group" && field.radioOptions ? (
              <div className="space-y-3">
                {field.radioOptions.map((option) => (
                  <label key={option.id} className="preview-radio-option">
                    <input
                      type="radio"
                      name={field.name}
                      value={option.value}
                      className="mt-1 w-4 h-4 text-foreground focus:ring-primary"
                    />
                    <div className="preview-radio-content">
                      <div className="preview-radio-title">
                        {option.title}
                        {option.price > 0 && (
                          <span className="ml-2 text-sm font-bold text-primary">
                            ₦
                            {option.price.toLocaleString("en-NG", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </div>
                      {option.products.length > 0 && (
                        <div className="preview-radio-products">
                          <Package className="w-3 h-3 inline mr-1" />
                          {option.products.map((p, idx) => {
                            const product = products.find(
                              (pr) => pr.id === p.product_id
                            );
                            const lineOffer = p.offer_id
                              ? offersByProduct[p.product_id]?.find(
                                  (o) => o.id === p.offer_id
                                )
                              : option.offer_id
                                ? offersByProduct[p.product_id]?.find(
                                    (o) => o.id === option.offer_id
                                  )
                                : null;
                            return (
                              <span key={idx}>
                                {product?.name || "Unknown"} (×{p.quantity})
                                {lineOffer ? ` · ${lineOffer.label}` : ""}
                                {idx < option.products.length - 1 && ", "}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ) : field.type === "textarea" ? (
              <textarea
                className="form-input"
                placeholder={field.placeholder}
                rows={4}
              />
            ) : (
              <input
                type={field.type}
                placeholder={field.placeholder}
                className="form-input"
              />
            )}
          </div>
        ))}

        <button type="button" className="preview-submit-btn" disabled>
          {schema.submitButton?.text || "Submit Order"}
        </button>
      </form>
    </div>
  );

  return (
    <PageLayout className="gap-4 !min-h-0">
      <div className="form-builder-shell">
      {/* Toolbar */}
      <div className="form-builder-toolbar">
        <div className="form-builder-toolbar-content">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/forms")}
                className="btn-secondary"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Forms</span>
              </button>
              <div className="h-8 w-px bg-border hidden sm:block" />
              <div>
                <h1 className="form-builder-title">
                  {mode === "create" ? "Create New Form" : "Edit Form"}
                </h1>
                <p className="form-builder-subtitle hidden sm:block">
                  Build a custom form for order collection
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {saveDisabledReason && (
                <span
                  className="text-xs text-amber-600 font-medium"
                  title={saveDisabledReason}
                >
                  {saveDisabledReason}
                </span>
              )}
              <button
                onClick={() => formRef.current?.requestSubmit()}
                disabled={saving || !formName.trim() || !formToken.trim()}
                className="btn-primary"
                title={saveDisabledReason ?? undefined}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span className="hidden sm:inline">Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">Save Form</span>
                    <span className="sm:hidden">Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="form-builder-error-banner mx-4 mt-4 sm:mx-6">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="form-builder-loading">
          <LoadingState label="Loading form…" size="lg" className="py-16" />
        </div>
      )}

      {/* Main Content */}
      {!loading && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="form-builder-main"
        >
          {/* Desktop: Side-by-side */}
          <div className="hidden lg:grid form-builder-split">
            {/* Builder Side */}
            <div className="form-builder-side">
              <div className="form-section">
                {/* Basic Info */}
                <div className="space-y-6">
                  <div className="section-header">
                    <Settings className="section-icon" />
                    <h2 className="section-title">Basic Settings</h2>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Form Name *
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g., Product Order Form"
                        className="w-full px-4 py-3 border-2 border-border rounded-lg text-sm focus:border-primary focus:ring-0 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        Form Token *
                      </label>
                      <input
                        type="text"
                        value={formToken}
                        onChange={(e) => setFormToken(e.target.value)}
                        placeholder="e.g., form_live_abc123"
                        className="w-full px-4 py-3 border-2 border-border rounded-lg text-sm font-mono focus:border-primary focus:ring-0 transition-colors disabled:bg-muted disabled:cursor-not-allowed"
                        required
                        disabled={mode === "edit"}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {mode === "create"
                          ? "Unique identifier for embedding this form"
                          : "Token cannot be changed after creation"}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                          Funnel Name
                        </label>
                        <input
                          type="text"
                          value={funnelName}
                          onChange={(e) => setFunnelName(e.target.value)}
                          placeholder="Defaults to form name on orders"
                          className="w-full px-4 py-3 border-2 border-border rounded-lg text-sm focus:border-primary focus:ring-0 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                          Sub-brand
                        </label>
                        <input
                          type="text"
                          value={subBrand}
                          onChange={(e) => setSubBrand(e.target.value)}
                          placeholder="Optional filter tag"
                          className="w-full px-4 py-3 border-2 border-border rounded-lg text-sm focus:border-primary focus:ring-0 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg border-2 border-border">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          Form Status
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {active
                            ? "Form is live and accepting submissions"
                            : "Form is disabled"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActive(!active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          active ? "bg-primary" : "bg-muted-foreground/40"
                        }`}
                        aria-label="Toggle form status"
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                            active ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-4 border-2 border-border rounded-lg space-y-4">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          After Submit
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Thank-you message or redirect. Use {"{{field_name}}"} for field values.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="form-label text-xs">Confirmation type</label>
                          <select
                            value={schema.confirmation?.type ?? "message"}
                            onChange={(e) =>
                              setSchema({
                                ...schema,
                                confirmation: {
                                  ...schema.confirmation,
                                  type: e.target.value as "message" | "redirect",
                                  message:
                                    schema.confirmation?.message ??
                                    "Thank you for your order. We'll be in touch soon.",
                                  redirectUrl: schema.confirmation?.redirectUrl ?? "",
                                },
                              })
                            }
                            className="form-input text-sm"
                          >
                            <option value="message">Thank-you message</option>
                            <option value="redirect">Redirect to URL</option>
                          </select>
                        </div>
                        <div>
                          {(schema.confirmation?.type ?? "message") === "redirect" ? (
                            <>
                              <label className="form-label text-xs">Redirect URL</label>
                              <input
                                type="url"
                                value={schema.confirmation?.redirectUrl ?? ""}
                                onChange={(e) =>
                                  setSchema({
                                    ...schema,
                                    confirmation: {
                                      type: "redirect",
                                      redirectUrl: e.target.value,
                                      message: schema.confirmation?.message,
                                    },
                                  })
                                }
                                placeholder="https://example.com/thank-you?phone={{phone}}"
                                className="form-input text-sm"
                              />
                            </>
                          ) : (
                            <>
                              <label className="form-label text-xs">Thank-you message</label>
                              <textarea
                                value={
                                  schema.confirmation?.message ??
                                  "Thank you for your order. We'll be in touch soon."
                                }
                                onChange={(e) =>
                                  setSchema({
                                    ...schema,
                                    confirmation: {
                                      type: "message",
                                      message: e.target.value,
                                      redirectUrl: schema.confirmation?.redirectUrl,
                                    },
                                  })
                                }
                                rows={2}
                                className="form-input text-sm"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-6">
                  <div className="section-header">
                    <Zap className="section-icon" />
                    <h2 className="section-title">Form Fields</h2>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({schema.fields.length})
                    </span>
                    <div className="field-type-menu-container relative ml-auto">
                      <button
                        type="button"
                        onClick={() => setShowFieldTypeMenu(!showFieldTypeMenu)}
                        className="btn-primary text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Field
                        {showFieldTypeMenu ? (
                          <ChevronUp className="w-4 h-4 ml-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 ml-1" />
                        )}
                      </button>
                      {showFieldTypeMenu && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-card border-2 border-border rounded-lg shadow-lg z-50 overflow-hidden">
                          <div className="p-2">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                              Select Field Type
                            </div>
                            {fieldTypes.map((fieldType) => (
                              <button
                                key={fieldType.type}
                                type="button"
                                onClick={() => addField(fieldType.type)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-foreground transition-colors rounded-md"
                              >
                                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
                                  {fieldType.icon}
                                </div>
                                <span>{fieldType.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {schema.fields.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Sparkles className="w-8 h-8" />
                      </div>
                      <h3 className="empty-state-title">No fields yet</h3>
                      <p className="empty-state-description">
                        Start building your form by adding fields to collect
                        information
                      </p>
                      <div className="field-type-menu-container relative inline-block">
                        <button
                          type="button"
                          onClick={() =>
                            setShowFieldTypeMenu(!showFieldTypeMenu)
                          }
                          className="btn-primary"
                        >
                          <Plus className="w-4 h-4" />
                          Add Your First Field
                          {showFieldTypeMenu ? (
                            <ChevronUp className="w-4 h-4 ml-1" />
                          ) : (
                            <ChevronDown className="w-4 h-4 ml-1" />
                          )}
                        </button>
                        {showFieldTypeMenu && (
                          <div className="absolute left-0 top-full mt-2 w-56 bg-card border-2 border-border rounded-lg shadow-lg z-50 overflow-hidden">
                            <div className="p-2">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                                Select Field Type
                              </div>
                              {fieldTypes.map((fieldType) => (
                                <button
                                  key={fieldType.type}
                                  type="button"
                                  onClick={() => addField(fieldType.type)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-foreground transition-colors rounded-md"
                                >
                                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
                                    {fieldType.icon}
                                  </div>
                                  <span>{fieldType.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {schema.fields.map((field, index) => (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`field-card ${
                            draggedField === index ? "opacity-50 scale-105" : ""
                          }`}
                        >
                          <div className="p-5">
                            {/* Field Header */}
                            <div className="field-card-header">
                              <button
                                type="button"
                                className="btn-icon mt-1 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-5 h-5" />
                              </button>
                              <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="field-badge">
                                    {getFieldIcon(field.type)}
                                    <span>
                                      {field.type
                                        .toUpperCase()
                                        .replace("-", " ")}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {field.required && (
                                      <div className="field-badge field-badge-required">
                                        REQUIRED
                                      </div>
                                    )}
                                    {isRequiredField(field) && (
                                      <div
                                        className="field-badge bg-blue-100 text-blue-800 border-blue-300"
                                        title="This field is required for order processing and cannot be deleted"
                                      >
                                        SYSTEM
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Field Configuration */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="form-label text-xs">
                                      Field Type{" "}
                                      {isRequiredField(field) && (
                                        <span
                                          className="text-blue-600"
                                          title="This field type is required for order processing"
                                        >
                                          🔒
                                        </span>
                                      )}
                                    </label>
                                    <select
                                      value={field.type}
                                      onChange={(e) => {
                                        if (isRequiredField(field)) {
                                          setError(
                                            "Cannot change field type for required system fields. This field type is needed for order processing."
                                          );
                                          setTimeout(
                                            () => setError(null),
                                            3000
                                          );
                                          return;
                                        }
                                        updateField(index, {
                                          type: e.target
                                            .value as FormField["type"],
                                        });
                                      }}
                                      className={`form-input text-sm ${
                                        isRequiredField(field)
                                          ? "bg-muted cursor-not-allowed"
                                          : ""
                                      }`}
                                      disabled={isRequiredField(field)}
                                      title={
                                        isRequiredField(field)
                                          ? "Field type cannot be changed for required system fields"
                                          : "Select field type"
                                      }
                                    >
                                      <option value="text">Text</option>
                                      <option value="email">Email</option>
                                      <option value="phone">Phone</option>
                                      <option value="number">Number</option>
                                      <option value="textarea">Textarea</option>
                                      <option value="select">Select</option>
                                      <option value="radio-group">
                                        Radio Group
                                      </option>
                                      <option value="order-bump">
                                        Order Bump
                                      </option>
                                    </select>
                                  </div>
                                  <div className="flex items-end">
                                    <label className="flex items-center gap-2 w-full px-3 py-2 bg-muted rounded-lg border-2 border-border cursor-pointer hover:bg-accent transition-colors">
                                      <input
                                        type="checkbox"
                                        checked={field.required}
                                        onChange={(e) =>
                                          updateField(index, {
                                            required: e.target.checked,
                                          })
                                        }
                                        className="w-4 h-4 text-foreground rounded focus:ring-primary"
                                      />
                                      <span className="text-sm font-semibold text-foreground">
                                        Required
                                      </span>
                                    </label>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="form-label text-xs">
                                      Label
                                    </label>
                                    <input
                                      type="text"
                                      value={field.label}
                                      onChange={(e) =>
                                        updateField(index, {
                                          label: e.target.value,
                                        })
                                      }
                                      placeholder="Field Label"
                                      className="form-input text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="form-label text-xs">
                                      Name{" "}
                                      {isRequiredField(field) && (
                                        <span
                                          className="text-blue-600"
                                          title="This field name is required for order processing"
                                        >
                                          🔒
                                        </span>
                                      )}
                                    </label>
                                    <input
                                      type="text"
                                      value={field.name}
                                      onChange={(e) => {
                                        if (isRequiredField(field)) {
                                          setError(
                                            "Cannot change field name for required system fields. This field name is needed for order processing."
                                          );
                                          setTimeout(
                                            () => setError(null),
                                            3000
                                          );
                                          return;
                                        }
                                        updateField(index, {
                                          name: e.target.value,
                                        });
                                      }}
                                      placeholder="field_name"
                                      className={`form-input text-sm font-mono ${
                                        isRequiredField(field)
                                          ? "bg-muted cursor-not-allowed"
                                          : ""
                                      }`}
                                      disabled={isRequiredField(field)}
                                      title={
                                        isRequiredField(field)
                                          ? "Field name cannot be changed for required system fields"
                                          : "Field name (used in form submission)"
                                      }
                                    />
                                  </div>
                                </div>

                                {field.type !== "radio-group" &&
                                  field.type !== "order-bump" && (
                                  <div>
                                    <label className="form-label text-xs">
                                      Placeholder
                                    </label>
                                    <input
                                      type="text"
                                      value={field.placeholder || ""}
                                      onChange={(e) =>
                                        updateField(index, {
                                          placeholder: e.target.value,
                                        })
                                      }
                                      placeholder="Enter placeholder..."
                                      className="form-input text-sm"
                                    />
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="form-label text-xs">
                                      Show when field
                                    </label>
                                    <select
                                      value={field.showWhen?.fieldName ?? ""}
                                      onChange={(e) => {
                                        const fieldName = e.target.value;
                                        if (!fieldName) {
                                          updateField(index, { showWhen: undefined });
                                          return;
                                        }
                                        updateField(index, {
                                          showWhen: {
                                            fieldName,
                                            equals: field.showWhen?.equals ?? "",
                                          },
                                        });
                                      }}
                                      className="form-input text-sm"
                                    >
                                      <option value="">Always visible</option>
                                      {schema.fields
                                        .filter((_, i) => i !== index)
                                        .map((f) => (
                                          <option key={f.id} value={f.name}>
                                            {f.label} ({f.name})
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                  {field.showWhen?.fieldName && (
                                    <div>
                                      <label className="form-label text-xs">
                                        Equals value
                                      </label>
                                      <input
                                        type="text"
                                        value={field.showWhen.equals}
                                        onChange={(e) =>
                                          updateField(index, {
                                            showWhen: {
                                              fieldName: field.showWhen!.fieldName,
                                              equals: e.target.value,
                                            },
                                          })
                                        }
                                        placeholder="e.g. Lagos"
                                        className="form-input text-sm"
                                      />
                                    </div>
                                  )}
                                </div>

                                {field.type === "order-bump" && field.orderBump && (
                                  <div className="mt-6 pt-6 border-t-2 border-border space-y-4">
                                    <div className="flex items-center gap-2">
                                      <CheckSquare className="w-4 h-4 text-muted-foreground" />
                                      <span className="text-sm font-bold text-foreground">
                                        Order Bump Offer
                                      </span>
                                    </div>
                                    <input
                                      type="text"
                                      value={field.orderBump.title}
                                      onChange={(e) =>
                                        updateField(index, {
                                          orderBump: {
                                            ...field.orderBump!,
                                            title: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder="Bump title (e.g. Add 1 extra mat)"
                                      className="form-input text-sm"
                                    />
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                        Price (₦):
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={field.orderBump.price ?? 0}
                                        onChange={(e) =>
                                          updateField(index, {
                                            orderBump: {
                                              ...field.orderBump!,
                                              price: parseFloat(e.target.value) || 0,
                                            },
                                          })
                                        }
                                        className="form-input text-sm flex-1"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <span className="text-xs font-semibold text-muted-foreground">
                                        ATTACHED PRODUCTS
                                      </span>
                                      {(field.orderBump.products ?? []).map(
                                        (product, prodIndex) => (
                                          <div
                                            key={`${product.product_id}-${prodIndex}`}
                                            className="flex items-center gap-2"
                                          >
                                            <select
                                              value={product.product_id}
                                              onChange={(e) => {
                                                const products = [
                                                  ...(field.orderBump!.products ?? []),
                                                ];
                                                products[prodIndex] = {
                                                  ...products[prodIndex],
                                                  product_id: e.target.value,
                                                };
                                                updateField(index, {
                                                  orderBump: {
                                                    ...field.orderBump!,
                                                    products,
                                                  },
                                                });
                                              }}
                                              className="form-input text-sm flex-1"
                                            >
                                              <option value="">Select product</option>
                                              {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                  {p.name}
                                                </option>
                                              ))}
                                            </select>
                                            <input
                                              type="number"
                                              min="1"
                                              value={product.quantity}
                                              onChange={(e) => {
                                                const products = [
                                                  ...(field.orderBump!.products ?? []),
                                                ];
                                                products[prodIndex] = {
                                                  ...products[prodIndex],
                                                  quantity:
                                                    parseInt(e.target.value, 10) || 1,
                                                };
                                                updateField(index, {
                                                  orderBump: {
                                                    ...field.orderBump!,
                                                    products,
                                                  },
                                                });
                                              }}
                                              className="form-input text-sm w-20"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const products = (
                                                  field.orderBump!.products ?? []
                                                ).filter((_, i) => i !== prodIndex);
                                                updateField(index, {
                                                  orderBump: {
                                                    ...field.orderBump!,
                                                    products,
                                                  },
                                                });
                                              }}
                                              className="btn-icon btn-icon-danger"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        )
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const products = [
                                            ...(field.orderBump!.products ?? []),
                                            { product_id: "", quantity: 1 },
                                          ];
                                          updateField(index, {
                                            orderBump: {
                                              ...field.orderBump!,
                                              products,
                                            },
                                          });
                                        }}
                                        className="btn-secondary text-sm"
                                      >
                                        <Plus className="w-4 h-4" />
                                        Add Product
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Radio Group Options */}
                                {field.type === "radio-group" && (
                                  <div className="mt-6 pt-6 border-t-2 border-border">
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-2">
                                        <Radio className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-bold text-foreground">
                                          Options
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          ({field.radioOptions?.length || 0})
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => addRadioOption(index)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-all"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        Add Option
                                      </button>
                                    </div>

                                    {!field.radioOptions ||
                                    field.radioOptions.length === 0 ? (
                                      <div className="text-center py-8 border-2 border-dashed border-border rounded-lg bg-muted">
                                        <Radio className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-sm font-medium text-muted-foreground mb-1">
                                          No options yet
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-4">
                                          Add options for users to choose from
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => addRadioOption(index)}
                                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-all"
                                        >
                                          <Plus className="w-4 h-4" />
                                          Add First Option
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="space-y-3">
                                        {field.radioOptions.map(
                                          (option, optIndex) => {
                                            const isExpanded =
                                              expandedRadioOptions.has(
                                                option.id
                                              );
                                            return (
                                              <div
                                                key={option.id}
                                                className="radio-option-card"
                                              >
                                                {/* Option Header */}
                                                <div className="p-4">
                                                  <div className="radio-option-header">
                                                    <div className="radio-indicator">
                                                      <Radio className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="radio-option-content">
                                                      <input
                                                        type="text"
                                                        value={option.title}
                                                        onChange={(e) =>
                                                          updateRadioOption(
                                                            index,
                                                            optIndex,
                                                            {
                                                              title:
                                                                e.target.value,
                                                            }
                                                          )
                                                        }
                                                        placeholder="Option title (e.g., 4 Medium Mats + Free Delivery)"
                                                        className="radio-option-title-input"
                                                      />
                                                      <input
                                                        type="text"
                                                        value={option.value}
                                                        onChange={(e) =>
                                                          updateRadioOption(
                                                            index,
                                                            optIndex,
                                                            {
                                                              value:
                                                                e.target.value,
                                                            }
                                                          )
                                                        }
                                                        placeholder="option_value"
                                                        className="radio-option-value-input"
                                                      />
                                                      <div className="flex items-center gap-2">
                                                        <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                                          Price (₦):
                                                        </label>
                                                        <input
                                                          type="number"
                                                          step="0.01"
                                                          min="0"
                                                          value={
                                                            option.price ?? 0
                                                          }
                                                          onChange={(e) => {
                                                            const price =
                                                              parseFloat(
                                                                e.target.value
                                                              ) || 0;
                                                            updateRadioOption(
                                                              index,
                                                              optIndex,
                                                              { price }
                                                            );
                                                          }}
                                                          placeholder="0.00"
                                                          className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                          required
                                                        />
                                                      </div>
                                                      {(() => {
                                                        const totalCost =
                                                          option.products.reduce(
                                                            (
                                                              sum,
                                                              {
                                                                product_id,
                                                                quantity,
                                                              }
                                                            ) => {
                                                              const product =
                                                                products.find(
                                                                  (p) =>
                                                                    p.id ===
                                                                    product_id
                                                                );
                                                              const cost =
                                                                product?.cost_price ??
                                                                0;
                                                              return (
                                                                sum +
                                                                cost *
                                                                  (quantity ||
                                                                    1)
                                                              );
                                                            },
                                                            0
                                                          );
                                                        const packageProfit =
                                                          (option.price ?? 0) -
                                                          totalCost;
                                                        return (
                                                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                                                            <span>
                                                              Total cost: ₦
                                                              {totalCost.toLocaleString(
                                                                "en-NG",
                                                                {
                                                                  minimumFractionDigits: 2,
                                                                  maximumFractionDigits: 2,
                                                                }
                                                              )}
                                                            </span>
                                                            <span
                                                              className={
                                                                packageProfit >=
                                                                0
                                                                  ? "text-green-600 font-semibold"
                                                                  : "text-red-600 font-semibold"
                                                              }
                                                            >
                                                              Profit: ₦
                                                              {packageProfit.toLocaleString(
                                                                "en-NG",
                                                                {
                                                                  minimumFractionDigits: 2,
                                                                  maximumFractionDigits: 2,
                                                                }
                                                              )}
                                                            </span>
                                                          </div>
                                                        );
                                                      })()}

                                                      {offersForRadioOption(
                                                        option.products,
                                                        offersByProduct
                                                      ).length > 0 && (
                                                        <div className="flex items-center gap-2 mt-2">
                                                          <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                                            Package offer:
                                                          </label>
                                                          <select
                                                            value={
                                                              option.offer_id ??
                                                              ""
                                                            }
                                                            onChange={(e) =>
                                                              applyOfferToRadioOption(
                                                                index,
                                                                optIndex,
                                                                e.target.value ||
                                                                  null
                                                              )
                                                            }
                                                            className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                                          >
                                                            <option value="">
                                                              None (use display price)
                                                            </option>
                                                            {offersForRadioOption(
                                                              option.products,
                                                              offersByProduct
                                                            ).map((o) => (
                                                              <option
                                                                key={o.id}
                                                                value={o.id}
                                                              >
                                                                {offerLabel(o)}
                                                              </option>
                                                            ))}
                                                          </select>
                                                        </div>
                                                      )}

                                                      {/* Products Toggle */}
                                                      <div className="product-attachment-header">
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            toggleRadioOption(
                                                              option.id
                                                            )
                                                          }
                                                          className="btn-secondary text-sm"
                                                        >
                                                          {isExpanded ? (
                                                            <ChevronDown className="w-4 h-4" />
                                                          ) : (
                                                            <ChevronRight className="w-4 h-4" />
                                                          )}
                                                          <Package className="w-4 h-4" />
                                                          Products (
                                                          {
                                                            option.products
                                                              .length
                                                          }
                                                          )
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            removeRadioOption(
                                                              index,
                                                              optIndex
                                                            )
                                                          }
                                                          className="btn-icon btn-icon-danger"
                                                          title="Remove option"
                                                        >
                                                          <Trash2 className="w-4 h-4" />
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>

                                                {/* Expandable Products Section */}
                                                {isExpanded && (
                                                  <div className="product-attachment-section bg-card">
                                                    <div className="product-attachment-header">
                                                      <span className="text-xs font-semibold text-muted-foreground">
                                                        ATTACHED PRODUCTS
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          addProductToRadioOption(
                                                            index,
                                                            optIndex
                                                          )
                                                        }
                                                        disabled={
                                                          productsLoading ||
                                                          products.length === 0
                                                        }
                                                        className="btn-primary text-xs"
                                                        title={
                                                          productsLoading
                                                            ? "Loading products..."
                                                            : products.length ===
                                                              0
                                                            ? "No products available. Create products first."
                                                            : "Add product"
                                                        }
                                                      >
                                                        <Plus className="w-3 h-3" />
                                                        Add
                                                      </button>
                                                    </div>

                                                    {option.products.length ===
                                                    0 ? (
                                                      <div className="text-center py-6 border-2 border-dashed border-border rounded-lg bg-muted">
                                                        <Package className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                                                        <p className="text-xs text-muted-foreground">
                                                          No products attached
                                                        </p>
                                                      </div>
                                                    ) : (
                                                      <div className="space-y-2">
                                                        {option.products.map(
                                                          (
                                                            product,
                                                            prodIndex
                                                          ) => (
                                                            <div
                                                              key={prodIndex}
                                                              className="product-item space-y-2"
                                                            >
                                                              <div className="flex items-center gap-2 flex-wrap">
                                                              <select
                                                                value={
                                                                  product.product_id
                                                                }
                                                                onChange={(e) =>
                                                                  updateRadioOptionProduct(
                                                                    index,
                                                                    optIndex,
                                                                    prodIndex,
                                                                    {
                                                                      product_id:
                                                                        e.target
                                                                          .value,
                                                                    }
                                                                  )
                                                                }
                                                                className="product-select"
                                                                disabled={
                                                                  productsLoading ||
                                                                  products.length ===
                                                                    0
                                                                }
                                                              >
                                                                {productsLoading ? (
                                                                  <option value="">
                                                                    Loading
                                                                    products...
                                                                  </option>
                                                                ) : products.length ===
                                                                  0 ? (
                                                                  <option value="">
                                                                    No products
                                                                    available
                                                                  </option>
                                                                ) : (
                                                                  products.map(
                                                                    (p) => (
                                                                      <option
                                                                        key={
                                                                          p.id
                                                                        }
                                                                        value={
                                                                          p.id
                                                                        }
                                                                      >
                                                                        {p.name}
                                                                      </option>
                                                                    )
                                                                  )
                                                                )}
                                                              </select>
                                                              <input
                                                                type="number"
                                                                min="1"
                                                                value={
                                                                  product.quantity
                                                                }
                                                                onChange={(e) =>
                                                                  updateRadioOptionProduct(
                                                                    index,
                                                                    optIndex,
                                                                    prodIndex,
                                                                    {
                                                                      quantity:
                                                                        parseInt(
                                                                          e
                                                                            .target
                                                                            .value
                                                                        ) || 1,
                                                                    }
                                                                  )
                                                                }
                                                                className="product-quantity"
                                                              />
                                                              <button
                                                                type="button"
                                                                onClick={() =>
                                                                  removeProductFromRadioOption(
                                                                    index,
                                                                    optIndex,
                                                                    prodIndex
                                                                  )
                                                                }
                                                                className="btn-icon btn-icon-danger"
                                                                title="Remove product"
                                                              >
                                                                <Trash2 className="w-4 h-4" />
                                                              </button>
                                                              </div>
                                                              {product.product_id &&
                                                                (variantsByProduct[
                                                                  product.product_id
                                                                ]?.filter(
                                                                  (v) => v.active
                                                                ).length ?? 0) >
                                                                  0 && (
                                                                  <select
                                                                    value={
                                                                      product.variant_id ??
                                                                      ""
                                                                    }
                                                                    onChange={(e) =>
                                                                      updateRadioOptionProduct(
                                                                        index,
                                                                        optIndex,
                                                                        prodIndex,
                                                                        {
                                                                          variant_id:
                                                                            e.target
                                                                              .value ||
                                                                            null,
                                                                        }
                                                                      )
                                                                    }
                                                                    className="product-select text-xs"
                                                                  >
                                                                    <option value="">
                                                                      No variant
                                                                    </option>
                                                                    {variantsByProduct[
                                                                      product.product_id
                                                                    ]
                                                                      ?.filter(
                                                                        (v) =>
                                                                          v.active
                                                                      )
                                                                      .map((v) => (
                                                                        <option
                                                                          key={
                                                                            v.id
                                                                          }
                                                                          value={
                                                                            v.id
                                                                          }
                                                                        >
                                                                          {v.name}
                                                                        </option>
                                                                      ))}
                                                                  </select>
                                                                )}
                                                              {product.product_id &&
                                                                offersForProduct(
                                                                  offersByProduct,
                                                                  product.product_id
                                                                ).length >
                                                                  0 && (
                                                                  <select
                                                                    value={
                                                                      product.offer_id ??
                                                                      ""
                                                                    }
                                                                    onChange={(e) =>
                                                                      updateRadioOptionProduct(
                                                                        index,
                                                                        optIndex,
                                                                        prodIndex,
                                                                        {
                                                                          offer_id:
                                                                            e.target
                                                                              .value ||
                                                                            null,
                                                                        }
                                                                      )
                                                                    }
                                                                    className="product-select text-xs"
                                                                  >
                                                                    <option value="">
                                                                      {option.offer_id
                                                                        ? "Use package offer"
                                                                        : "No line offer"}
                                                                    </option>
                                                                    {offersForProduct(
                                                                      offersByProduct,
                                                                      product.product_id
                                                                    ).map((o) => (
                                                                      <option
                                                                        key={o.id}
                                                                        value={
                                                                          o.id
                                                                        }
                                                                      >
                                                                        {offerLabel(
                                                                          o
                                                                        )}
                                                                      </option>
                                                                    ))}
                                                                  </select>
                                                                )}
                                                            </div>
                                                          )
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeField(index)}
                                disabled={isRequiredField(field)}
                                className={`p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${
                                  isRequiredField(field)
                                    ? "text-muted-foreground cursor-not-allowed bg-muted"
                                    : "text-red-600 hover:bg-red-50"
                                }`}
                                title={
                                  isRequiredField(field)
                                    ? "This field is required for order processing and cannot be deleted. You can move it to reorder."
                                    : "Delete field"
                                }
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="space-y-6">
                  <div className="section-header">
                    <Zap className="section-icon" />
                    <h2 className="section-title">Submit Button</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                    <div>
                      <label className="form-label">Button Text</label>
                      <input
                        type="text"
                        value={schema.submitButton?.text || "Submit Order"}
                        onChange={(e) =>
                          updateSubmitButton({ text: e.target.value })
                        }
                        placeholder="Submit Order"
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label">Loading Text</label>
                      <input
                        type="text"
                        value={schema.submitButton?.loadingText || ""}
                        onChange={(e) =>
                          updateSubmitButton({ loadingText: e.target.value })
                        }
                        placeholder="Processing..."
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Side — hidden from layout; kept for future use */}
            <div className="form-preview-side form-builder-preview-hidden" aria-hidden="true">
              <div className="preview-header">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-foreground" />
                  <div>
                    <h2 className="preview-title">Live Preview</h2>
                    <p className="preview-subtitle">See how your form looks</p>
                  </div>
                </div>
              </div>
              <div className="preview-content">{renderPreview()}</div>
            </div>
          </div>

          {/* Mobile: Tabs */}
          <div className="lg:hidden mobile-tabs-container">
            <div className="mobile-tabs-list">
              <button
                type="button"
                onClick={() => setMobileTab("builder")}
                className={`mobile-tab-trigger ${
                  mobileTab === "builder" ? "active" : ""
                }`}
                data-state={mobileTab === "builder" ? "active" : "inactive"}
              >
                <Settings className="w-4 h-4" />
                Builder
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("preview")}
                className={`mobile-tab-trigger ${
                  mobileTab === "preview" ? "active" : ""
                }`}
                data-state={mobileTab === "preview" ? "active" : "inactive"}
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            </div>

            <div className="mobile-tab-content">
              {mobileTab === "builder" ? (
                <div className="space-y-6">
                  {/* Mobile Builder Content - Simplified version */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-foreground">
                      Basic Settings
                    </h3>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Form Name"
                      className="form-input"
                    />
                    <input
                      type="text"
                      value={formToken}
                      onChange={(e) => setFormToken(e.target.value)}
                      placeholder="Form Token"
                      className="form-input font-mono"
                      disabled={mode === "edit"}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-foreground">
                        Fields ({schema.fields.length})
                      </h3>
                      <div className="field-type-menu-container relative">
                        <button
                          type="button"
                          onClick={() =>
                            setShowFieldTypeMenu(!showFieldTypeMenu)
                          }
                          className="btn-primary text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Field
                          {showFieldTypeMenu ? (
                            <ChevronUp className="w-4 h-4 ml-1" />
                          ) : (
                            <ChevronDown className="w-4 h-4 ml-1" />
                          )}
                        </button>
                        {showFieldTypeMenu && (
                          <div className="absolute right-0 top-full mt-2 w-56 bg-card border-2 border-border rounded-lg shadow-lg z-50 overflow-hidden">
                            <div className="p-2">
                              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2">
                                Select Field Type
                              </div>
                              {fieldTypes.map((fieldType) => (
                                <button
                                  key={fieldType.type}
                                  type="button"
                                  onClick={() => addField(fieldType.type)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent hover:text-foreground transition-colors rounded-md"
                                >
                                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
                                    {fieldType.icon}
                                  </div>
                                  <span>{fieldType.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {schema.fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="p-4 bg-muted border-2 border-border rounded-lg"
                      >
                        <div className="space-y-3">
                          {isRequiredField(field) && (
                            <div className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded border border-blue-300">
                              🔒 SYSTEM FIELD - Required for order processing
                            </div>
                          )}
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) =>
                              updateField(index, { label: e.target.value })
                            }
                            placeholder="Field Label"
                            className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm focus:border-primary focus:ring-0"
                          />
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => {
                              if (isRequiredField(field)) {
                                setError(
                                  "Cannot change field name for required system fields."
                                );
                                setTimeout(() => setError(null), 3000);
                                return;
                              }
                              updateField(index, { name: e.target.value });
                            }}
                            placeholder="field_name"
                            disabled={isRequiredField(field)}
                            className={`w-full px-3 py-2 border-2 border-border rounded-lg text-sm font-mono focus:border-primary focus:ring-0 ${
                              isRequiredField(field)
                                ? "bg-muted cursor-not-allowed"
                                : ""
                            }`}
                          />
                          <select
                            value={field.type}
                            onChange={(e) => {
                              if (isRequiredField(field)) {
                                setError(
                                  "Cannot change field type for required system fields."
                                );
                                setTimeout(() => setError(null), 3000);
                                return;
                              }
                              updateField(index, {
                                type: e.target.value as FormField["type"],
                              });
                            }}
                            disabled={isRequiredField(field)}
                            className={`w-full px-3 py-2 border-2 border-border rounded-lg text-sm focus:border-primary focus:ring-0 ${
                              isRequiredField(field)
                                ? "bg-muted cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <option value="text">Text</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                            <option value="radio-group">Radio Group</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeField(index)}
                            disabled={isRequiredField(field)}
                            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                              isRequiredField(field)
                                ? "text-muted-foreground bg-muted cursor-not-allowed"
                                : "text-red-600 bg-red-50 hover:bg-red-100"
                            }`}
                            title={
                              isRequiredField(field)
                                ? "This field is required for order processing and cannot be deleted"
                                : "Remove field"
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                            {isRequiredField(field) ? "Locked" : "Remove"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-6 bg-muted">{renderPreview()}</div>
              )}
            </div>
          </div>
        </form>
      )}

      {!loading && formToken && (
        <div className="mx-4 mb-6 sm:mx-6">
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="btn-secondary">
                <Download className="w-4 h-4" />
                Add this form to WordPress
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add this form to WordPress</DialogTitle>
              </DialogHeader>
              <ol className="mt-2 space-y-5 text-sm text-foreground">
            <li>
              <p className="font-semibold">1. Download the plugin</p>
              <a
                href="/wordpress-plugin/crm-form-embed.zip"
                download="crm-form-embed.zip"
                className="btn-secondary inline-flex mt-2"
              >
                <Download className="w-4 h-4" />
                Download Plugin
              </a>
            </li>
            <li>
              <p className="font-semibold">2. Install &amp; activate it</p>
              <p className="text-muted-foreground mt-1">
                In WordPress: Plugins → Add New → Upload Plugin → choose the downloaded zip → Install Now → Activate.
              </p>
            </li>
            <li>
              <p className="font-semibold">3. Configure the API URL</p>
              <p className="text-muted-foreground mt-1">
                Go to Settings → CRM Form Embed and paste your API base URL:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">
                  {API_BASE_URL}
                </code>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(API_BASE_URL, "API base URL")}
                  className="btn-secondary shrink-0"
                  title="Copy API base URL"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                The embed script/style URLs are already pre-filled — most stores won't need to change them.
              </p>
            </li>
            <li>
              <p className="font-semibold">4. Add the form</p>
              <p className="text-muted-foreground mt-1">
                Paste this shortcode into any WordPress page or post:
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">
                  {`[crm_form form="${formToken}"]`}
                </code>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(`[crm_form form="${formToken}"]`, "Shortcode")}
                  className="btn-secondary shrink-0"
                  title="Copy shortcode"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </li>
            <li>
              <p className="font-semibold">5. Stay up to date</p>
              <p className="text-muted-foreground mt-1">
                The plugin checks for updates automatically — WordPress will show "Update available" on the
                Plugins page whenever a new version ships, so there's no need to manually re-download it.
              </p>
            </li>
              </ol>
            </DialogContent>
          </Dialog>
        </div>
      )}
      </div>
    </PageLayout>
  );
}
