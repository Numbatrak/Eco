import { FormEvent, useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Plus, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import "./FormBuilderPage.css";
import { useOrganization } from "../../contexts/OrganizationContext";
import { API_BASE_URL } from "../../lib/apiClient";
import {
  createForm,
  updateForm,
  fetchFormById,
  generateFormToken,
  updateFormFieldMapping,
  rotateFormWebhookSecret,
} from "../../services/forms";
import { fetchProducts } from "../../services/products";
import { fetchOffersForProducts } from "../../services/productOffers";
import { fetchVariantsForProducts } from "../../services/productVariants";
import { Product, ProductOffer, ProductVariant } from "../../types/product";
import { FormField, FormSchema, RadioOption, RadioOptionProduct, FieldMapping } from "../../types/form";
import { validateFormSchema, isRequiredField, getDefaultRequiredFields, ensureRequiredFields } from "../../utils/formValidation";
import { useConfirm } from "../../contexts/ConfirmContext";
import { PageLayout } from "../layout/PageLayout";
import { LoadingState } from "../ui/LoadingState";
import { FormCanvas } from "./builder/FormCanvas";
import { FieldPalette } from "./builder/FieldPalette";
import { FieldSettingsPanel } from "./builder/FieldSettingsPanel";
import { BasicSettingsPanel } from "./builder/BasicSettingsPanel";
import { IntegrationsPanel } from "./builder/IntegrationsPanel";

const EMPTY_FIELD_MAPPING: FieldMapping = { contactFields: {}, valueToOptionId: {} };

/** True for a blank title or the auto-generated "Option N" default - i.e. one an offer selection is still free to fill in. */
function isPlaceholderOptionTitle(title: string): boolean {
  return !title.trim() || /^Option \d+$/.test(title.trim());
}

export default function FormBuilderPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();

  const [products, setProducts] = useState<Product[]>([]);
  const [offersByProduct, setOffersByProduct] = useState<Record<string, ProductOffer[]>>({});
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariant[]>>({});
  const [productsLoading, setProductsLoading] = useState(false);

  const [expandedRadioOptions, setExpandedRadioOptions] = useState<Set<string>>(new Set());
  const [formName, setFormName] = useState("");
  const [formToken, setFormToken] = useState("");
  const [subBrand, setSubBrand] = useState("");
  const [funnelName, setFunnelName] = useState("");
  const [active, setActive] = useState(true);
  const [schema, setSchema] = useState<FormSchema>({
    fields: [],
    submitButton: { text: "Submit Order", loadingText: "Processing..." },
  });
  const [activeTab, setActiveTab] = useState<"fields" | "settings" | "integrations">("fields");
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>(EMPTY_FIELD_MAPPING);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!id;
  const mode: "create" | "edit" = isEditMode ? "edit" : "create";

  const selectedFieldIndex = schema.fields.findIndex((f) => f.id === selectedFieldId);
  const selectedField = selectedFieldIndex >= 0 ? schema.fields[selectedFieldIndex] : null;

  const saveDisabledReason = saving
    ? null
    : !formName.trim() && !formToken.trim()
    ? "Form name and Form token are required to save."
    : !formName.trim()
    ? "Form name is required to save."
    : !formToken.trim()
    ? "Form token is required to save."
    : null;

  const showTransientError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 3000);
  };

  useEffect(() => {
    if (currentOrganization) {
      loadProducts();
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (isEditMode && id) {
      loadFormData(id);
    } else if (!isEditMode && !formToken) {
      const token = generateFormToken();
      setFormToken(token);
      const defaultFields = getDefaultRequiredFields();
      setSchema({
        fields: defaultFields,
        submitButton: { text: "Submit Order", loadingText: "Processing..." },
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
          return { ...field, orderBump: { ...nextBump, products: productsClean } };
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
      const data = await fetchProducts(currentOrganization.id, { activeOnly: true });
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
        const schemaWithRequired = ensureRequiredFields(form.schema);
        setSchema(schemaWithRequired);
        setFieldMapping(form.field_mapping ?? EMPTY_FIELD_MAPPING);
        setHasWebhookSecret(form.has_webhook_secret ?? false);
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

    const validation = validateFormSchema(schema);
    if (!validation.isValid) {
      setError(
        `Form is missing required fields:\n${validation.missingFields.map((f) => `• ${f}`).join("\n")}\n\n` +
          `Every form must include: First Name, Last Name, WhatsApp Number, Phone Number, State, Address, and Package selection.`
      );
      return;
    }
    if (validation.warnings.length > 0) {
      console.warn("Form validation warnings:", validation.warnings);
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditMode && id) {
        await updateForm(id, {
          name: formName.trim(),
          form_token: formToken.trim(),
          schema,
          active,
          sub_brand: subBrand.trim() || null,
          funnel_name: funnelName.trim() || null,
        });
      } else {
        await createForm({
          name: formName.trim(),
          organization_id: currentOrganization.id,
          form_token: formToken.trim(),
          schema,
          active,
          sub_brand: subBrand.trim() || null,
          funnel_name: funnelName.trim() || null,
        });
      }

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
      label: `${fieldType === "radio-group" ? "Radio Group" : fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} Field ${fieldCount + 1}`,
      name: `field_${fieldCount + 1}`,
      required: false,
    };

    let newField: FormField;

    if (fieldType === "radio-group") {
      newField = { ...baseField, type: "radio-group", radioOptions: [] } as FormField;
    } else if (fieldType === "order-bump") {
      newField = {
        ...baseField,
        type: "order-bump",
        label: "Order Bump",
        name: `order_bump_${fieldCount + 1}`,
        orderBump: { id: `bump_${Date.now()}`, title: "Add extra item", value: "order_bump", price: 0, products: [] },
      } as FormField;
    } else if (fieldType === "select") {
      newField = { ...baseField, type: "select", options: [], placeholder: "" } as FormField;
    } else if (fieldType === "state") {
      newField = { ...baseField, type: "state", placeholder: "Select a state" } as FormField;
    } else {
      newField = { ...baseField, type: fieldType, placeholder: "" } as FormField;
    }

    setSchema({ ...schema, fields: [...schema.fields, newField] });
    setSelectedFieldId(newField.id);
    setMobilePaletteOpen(false);
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
    if (currentField.type === "radio-group" && updates.type && updates.type !== "radio-group") {
      const { radioOptions, ...rest } = updates;
      updates = rest;
    }

    newFields[index] = { ...currentField, ...updates };
    setSchema({ ...schema, fields: newFields });
  };

  const removeField = async (index: number) => {
    const field = schema.fields[index];

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
    setSchema({ ...schema, fields: newFields });
    if (selectedFieldId === field.id) setSelectedFieldId(null);
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    const newFields = [...schema.fields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, removed);
    setSchema({ ...schema, fields: newFields });
  };

  const addRadioOption = (fieldIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group") return;

    const newOption: RadioOption = {
      id: `option_${Date.now()}`,
      title: `Option ${(field.radioOptions?.length || 0) + 1}`,
      value: `option_${(field.radioOptions?.length || 0) + 1}`,
      price: 0,
      products: [],
    };

    updateField(fieldIndex, { radioOptions: [...(field.radioOptions || []), newOption] });
  };

  const updateRadioOption = (fieldIndex: number, optionIndex: number, updates: Partial<RadioOption>) => {
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
    const firstProduct = products.length > 0 ? products[0] : null;
    const newProduct: RadioOptionProduct = { product_id: firstProduct?.id || "", quantity: 1 };

    updateRadioOption(fieldIndex, optionIndex, { products: [...option.products, newProduct] });
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

    const optionUpdates: Partial<RadioOption> = { products: newProducts };
    if (updates.offer_id && isPlaceholderOptionTitle(option.title)) {
      for (const list of Object.values(offersByProduct)) {
        const offer = list.find((o) => o.id === updates.offer_id && o.active);
        if (offer) {
          optionUpdates.title = offer.label;
          break;
        }
      }
    }

    updateRadioOption(fieldIndex, optionIndex, optionUpdates);
  };

  const applyOfferToRadioOption = (fieldIndex: number, optionIndex: number, offerId: string | null) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group" || !field.radioOptions) return;
    const option = field.radioOptions[optionIndex];
    const updates: Partial<RadioOption> = { offer_id: offerId || null };
    if (offerId) {
      for (const list of Object.values(offersByProduct)) {
        const offer = list.find((o) => o.id === offerId && o.active);
        if (offer) {
          updates.price = offer.price;
          if (isPlaceholderOptionTitle(option.title)) updates.title = offer.label;
          break;
        }
      }
    }
    updateRadioOption(fieldIndex, optionIndex, updates);
  };

  const removeProductFromRadioOption = (fieldIndex: number, optionIndex: number, productIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== "radio-group" || !field.radioOptions) return;

    const option = field.radioOptions[optionIndex];
    const newProducts = option.products.filter((_, i) => i !== productIndex);
    updateRadioOption(fieldIndex, optionIndex, { products: newProducts });
  };

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

  const radioGroupHandlers = {
    expandedRadioOptions,
    onToggleExpand: toggleRadioOption,
    onAddOption: addRadioOption,
    onUpdateOption: updateRadioOption,
    onRemoveOption: removeRadioOption,
    onAddProduct: addProductToRadioOption,
    onUpdateProduct: updateRadioOptionProduct,
    onRemoveProduct: removeProductFromRadioOption,
    onApplyOffer: applyOfferToRadioOption,
  };

  const productsContext = { products, offersByProduct, variantsByProduct, productsLoading };

  const fieldSettingsPanel = selectedField && (
    <FieldSettingsPanel
      field={selectedField}
      fieldIndex={selectedFieldIndex}
      allFields={schema.fields}
      onUpdateField={updateField}
      onRemoveField={removeField}
      onClose={() => setSelectedFieldId(null)}
      onError={showTransientError}
      productsContext={productsContext}
      radioGroupHandlers={radioGroupHandlers}
    />
  );

  return (
    <PageLayout className="gap-4 !min-h-0">
      <div className="form-builder-shell">
        <div className="form-builder-toolbar">
          <div className="form-builder-toolbar-content">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => navigate("/forms")} className="btn-secondary">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back to Forms</span>
                </button>
                <div className="h-8 w-px bg-border hidden sm:block" />
                <div>
                  <h1 className="form-builder-title">{mode === "create" ? "Create New Form" : "Edit Form"}</h1>
                  <p className="form-builder-subtitle hidden sm:block">Build a custom form for order collection</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {saveDisabledReason && (
                  <span className="text-xs text-amber-600 font-medium" title={saveDisabledReason}>
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

        {error && (
          <div className="form-builder-error-banner mx-4 mt-4 sm:mx-6">
            <p className="text-sm font-medium whitespace-pre-line">{error}</p>
          </div>
        )}

        {loading && (
          <div className="form-builder-loading">
            <LoadingState label="Loading form…" size="lg" className="py-16" />
          </div>
        )}

        {!loading && (
          <form ref={formRef} onSubmit={handleSubmit} className="form-builder-main">
            <Tabs
              value={activeTab}
              onValueChange={(v: string) => setActiveTab(v as "fields" | "settings" | "integrations")}
              className="flex-1 min-h-0 flex flex-col"
            >
              <div className="form-builder-tabs-bar">
                <TabsList>
                  <TabsTrigger value="fields">Fields ({schema.fields.length})</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                  <TabsTrigger value="integrations">Integrations</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="fields" className="flex-1 min-h-0">
                <div className="builder-workspace">
                  <div className="builder-canvas-col">
                    <FormCanvas
                      fields={schema.fields}
                      selectedFieldId={selectedFieldId}
                      onSelectField={setSelectedFieldId}
                      onMoveField={moveField}
                      onRemoveField={removeField}
                    />
                  </div>
                  <div className="builder-panel-col hidden lg:block">
                    {selectedField ? fieldSettingsPanel : <FieldPalette onAddField={addField} />}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobilePaletteOpen(true)}
                  className="mobile-add-field-fab lg:hidden"
                >
                  <Plus className="w-4 h-4" />
                  Add Field
                </button>
              </TabsContent>

              <TabsContent value="settings" className="flex-1 min-h-0 overflow-y-auto">
                <BasicSettingsPanel
                  mode={mode}
                  formName={formName}
                  onFormNameChange={setFormName}
                  formToken={formToken}
                  funnelName={funnelName}
                  onFunnelNameChange={setFunnelName}
                  subBrand={subBrand}
                  onSubBrandChange={setSubBrand}
                  active={active}
                  onActiveChange={setActive}
                  schema={schema}
                  onSchemaChange={(updates) => setSchema({ ...schema, ...updates })}
                />
              </TabsContent>

              <TabsContent value="integrations" className="flex-1 min-h-0 overflow-y-auto">
                <IntegrationsPanel
                  formId={id ?? null}
                  formToken={formToken}
                  schema={schema}
                  fieldMapping={fieldMapping}
                  hasWebhookSecret={hasWebhookSecret}
                  onSaveMapping={async (mapping) => {
                    if (!id) return;
                    const updated = await updateFormFieldMapping(id, mapping);
                    setFieldMapping(updated.field_mapping);
                  }}
                  onRotateSecret={async () => {
                    if (!id) throw new Error("Save the form first");
                    const secret = await rotateFormWebhookSecret(id);
                    setHasWebhookSecret(true);
                    return secret;
                  }}
                  onCopy={copyToClipboard}
                />
              </TabsContent>
            </Tabs>
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
                    <p className="text-muted-foreground mt-1">Go to Settings → CRM Form Embed and paste your API base URL:</p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">{API_BASE_URL}</code>
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
                    <p className="text-muted-foreground mt-1">Paste this shortcode into any WordPress page or post:</p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">{`[crm_form form="${formToken}"]`}</code>
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
                      The plugin checks for updates automatically — WordPress will show "Update available" on the Plugins
                      page whenever a new version ships, so there's no need to manually re-download it.
                    </p>
                  </li>
                </ol>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Sheet open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto lg:hidden">
          <SheetHeader>
            <SheetTitle>Add a field</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FieldPalette onAddField={addField} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedField} onOpenChange={(open: boolean) => !open && setSelectedFieldId(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto lg:hidden">
          <SheetHeader>
            <SheetTitle>Edit field</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{fieldSettingsPanel}</div>
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
}
