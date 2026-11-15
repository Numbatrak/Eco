import { FormEvent, useRef, useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Plus, Download, Copy, Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import "./FormBuilderPage.css";
import { useOrganization } from "../../contexts/OrganizationContext";
import { PUBLIC_API_BASE_URL } from "../../lib/apiClient";
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
import { FormField, RadioOptionProduct, FieldMapping } from "../../types/form";
import {
  validateFormSchema,
  describeFieldLock,
  getDefaultRequiredFields,
  ensureRequiredFields,
} from "../../utils/formValidation";
import {
  createId,
  generateFieldNaming,
  generateCopyNaming,
  generateOptionNaming,
} from "../../utils/formSchemaUtils";
import {
  buildPackageCatalog,
  applyPackageToOption,
  createEmptyPackageOption,
  PackageChoice,
} from "../../utils/formPackages";
import { useConfirm } from "../../contexts/ConfirmContext";
import { useIsDesktop } from "../../hooks/useMediaQuery";
import { PageLayout } from "../layout/PageLayout";
import { LoadingState } from "../ui/LoadingState";
import { FormCanvas } from "./builder/FormCanvas";
import { FieldPalette } from "./builder/FieldPalette";
import { FieldSettingsPanel } from "./builder/FieldSettingsPanel";
import { BasicSettingsPanel } from "./builder/BasicSettingsPanel";
import { IntegrationsPanel } from "./builder/IntegrationsPanel";
import { useSchemaHistory } from "./builder/schemaHistory";
import { FIELD_TYPE_LABELS } from "./builder/fieldTypes";

const EMPTY_FIELD_MAPPING: FieldMapping = { contactFields: {}, valueToOptionId: {} };

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

  const [formName, setFormName] = useState("");
  const [formToken, setFormToken] = useState("");
  const [subBrand, setSubBrand] = useState("");
  const [funnelName, setFunnelName] = useState("");
  const [active, setActive] = useState(true);
  // Every schema edit goes through this - see schemaHistory.ts. `commitSchema`
  // records an undo step (coalescing rapid edits to the same property);
  // `replaceSchema` applies an edit the app made on the user's behalf without
  // polluting their undo history.
  const {
    schema,
    commitSchema,
    replaceSchema,
    resetSchema,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSchemaHistory({
    fields: [],
    submitButton: { text: "Submit Order", loadingText: "Processing..." },
  });
  const [activeTab, setActiveTab] = useState<"fields" | "settings" | "integrations">("fields");
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>(EMPTY_FIELD_MAPPING);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [railTab, setRailTab] = useState<"add" | "edit">("add");
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!id;
  const mode: "create" | "edit" = isEditMode ? "edit" : "create";

  // Drives whether the field settings live in the side rail or in a sheet.
  // Read as a media query rather than a CSS class so the sheet is never
  // *mounted* on desktop - an open Radix dialog still renders its overlay,
  // locks body scroll and traps focus even when its content is display:none.
  const isDesktop = useIsDesktop();

  const selectField = (id: string) => {
    setSelectedFieldId(id);
    setRailTab("edit");
  };

  const selectedFieldIndex = schema.fields.findIndex((f) => f.id === selectedFieldId);
  const selectedField = selectedFieldIndex >= 0 ? schema.fields[selectedFieldIndex] : null;

  // Undo, a reconciliation sweep or a delete can remove the selected field.
  useEffect(() => {
    if (selectedFieldId && !schema.fields.some((f) => f.id === selectedFieldId)) {
      setSelectedFieldId(null);
    }
  }, [schema.fields, selectedFieldId]);

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

  // The catalog sweep below runs on catalog changes, not schema changes, so
  // it reads the live schema through a ref rather than closing over a stale one.
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

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
      resetSchema({
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

    {
      const prev = schemaRef.current;
      if (!prev.fields?.length) return;
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
            // An offer-backed option IS its package - nulling the offer would
            // quietly turn it into an option that takes money for nothing. Leave
            // it pointing at the missing offer; the picker surfaces that the
            // package is gone and asks for another.
            if (option.offer_id && !activeOfferIds.has(option.offer_id) && option.source !== "offer") {
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
          if (bump.offer_id && !activeOfferIds.has(bump.offer_id) && bump.source !== "offer") {
            didChange = true;
            nextBump = { ...nextBump, offer_id: null };
          }
          const productsClean = cleanProducts(bump.products ?? []);
          return { ...field, orderBump: { ...nextBump, products: productsClean } };
        }
        return field;
      });

      // Not the user's edit, so it must not land on their undo stack.
      if (didChange) replaceSchema({ ...prev, fields: cleanedFields });
    }
  }, [products, offersByProduct, variantsByProduct, replaceSchema]);

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
        // Loading is the new baseline - there is nothing to undo back past it.
        resetSchema(schemaWithRequired);
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
      const parts: string[] = [];

      if (validation.missingFields.length > 0) {
        parts.push(
          `This form can't take orders yet — it still needs:\n${validation.missingFields
            .map((f) => `• ${f}`)
            .join("\n")}`,
        );
      }

      // Two fields sharing an answer key silently merge their answers, so this
      // blocks the save. Existing forms are never auto-renamed - the merchant
      // chooses which one to change, because integrations may point at either.
      if (validation.duplicateNames.length > 0) {
        parts.push(
          `Two fields can't share an answer key:\n${validation.duplicateNames
            .map((d) => `• "${d.name}" is used by ${d.labels.map((l) => `"${l}"`).join(" and ")}`)
            .join("\n")}\n` +
            `Open each one and give it a different answer key.`,
        );
      }

      setError(parts.join("\n\n"));
      return;
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

  /**
   * Insert a field at `index` (default: append). Dragging a palette entry onto
   * a gap in the canvas supplies an index; clicking one does not.
   */
  const insertField = (fieldType: FormField["type"] = "text", index?: number) => {
    // Names and labels are checked against the whole schema rather than
    // derived from its length: `fields.length + 1` repeats a name as soon as
    // anything has been deleted, and `name` is the key submissions arrive under.
    const naming = generateFieldNaming(schema.fields, `${FIELD_TYPE_LABELS[fieldType]} Field`);
    const baseField: Partial<FormField> = {
      id: createId("field"),
      type: fieldType,
      label: naming.label,
      name: naming.name,
      required: false,
    };

    let newField: FormField;

    if (fieldType === "radio-group") {
      newField = { ...baseField, type: "radio-group", radioOptions: [] } as FormField;
    } else if (fieldType === "order-bump") {
      newField = {
        ...baseField,
        type: "order-bump",
        orderBump: {
          id: createId("bump"),
          title: "Add extra item",
          value: "order_bump",
          price: 0,
          products: [],
        },
      } as FormField;
    } else if (fieldType === "select") {
      newField = { ...baseField, type: "select", options: [], placeholder: "" } as FormField;
    } else if (fieldType === "state") {
      newField = { ...baseField, type: "state", placeholder: "Select a state" } as FormField;
    } else {
      newField = { ...baseField, type: fieldType, placeholder: "" } as FormField;
    }

    const at = index === undefined ? schema.fields.length : Math.max(0, Math.min(index, schema.fields.length));
    const nextFields = [...schema.fields];
    nextFields.splice(at, 0, newField);
    commitSchema({ ...schema, fields: nextFields });
    setSelectedFieldId(newField.id);
    setRailTab("edit");
    setMobilePaletteOpen(false);
  };

  /** Click-to-add from the palette always appends. */
  const addField = (fieldType: FormField["type"] = "text") => insertField(fieldType);

  const duplicateField = (index: number) => {
    const source = schema.fields[index];
    if (!source) return;
    // A duplicate must not inherit the original's id or `name` - `name` is the
    // key submissions arrive under, so two fields sharing one would collide.
    const naming = generateCopyNaming(schema.fields, source);
    const copy = {
      ...structuredClone(source),
      id: createId("field"),
      name: naming.name,
      label: naming.label,
    } as FormField;
    if (copy.type === "radio-group" && copy.radioOptions) {
      copy.radioOptions = copy.radioOptions.map((o) => ({ ...o, id: createId("option") }));
    }
    if (copy.type === "order-bump" && copy.orderBump) {
      copy.orderBump = { ...copy.orderBump, id: createId("bump") };
    }
    const nextFields = [...schema.fields];
    nextFields.splice(index + 1, 0, copy);
    commitSchema({ ...schema, fields: nextFields });
    setSelectedFieldId(copy.id);
    setRailTab("edit");
  };

  /**
   * Patch one field.
   *
   * `coalesceKey` groups rapid repeated edits into a single undo step:
   *  - omitted: derive a key from the property names, so typing in a label
   *    collapses but switching type then editing the label does not;
   *  - a string: use that key, for callers that patch one property through a
   *    shared container (an order bump's title and price both patch `orderBump`);
   *  - `null`: never coalesce - for structural edits like adding or removing
   *    an option, each of which deserves its own undo step.
   */
  const updateField = (
    index: number,
    updates: Partial<FormField>,
    coalesceKey?: string | null,
  ) => {
    const newFields = [...schema.fields];
    const currentField = newFields[index];
    if (!currentField) return;

    if (updates.type === "radio-group" && currentField.type !== "radio-group") {
      updates.radioOptions = updates.radioOptions || [];
    }
    if (updates.type === "order-bump" && currentField.type !== "order-bump") {
      updates.orderBump = updates.orderBump || {
        id: createId("bump"),
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
    const key =
      coalesceKey === null
        ? undefined
        : (coalesceKey ?? `field:${currentField.id}:${Object.keys(updates).sort().join(",")}`);
    commitSchema({ ...schema, fields: newFields }, key);
  };

  const removeField = async (index: number) => {
    const field = schema.fields[index];
    if (!field) return;

    // Only the *last* field covering a requirement is locked, and the message
    // names that field and that requirement rather than listing all seven.
    const lockReason = describeFieldLock(field, schema.fields);
    if (lockReason) {
      setError(lockReason);
      setTimeout(() => setError(null), 8000);
      return;
    }

    if (
      !(await confirm({
        title: `Remove "${field.label || field.name}"?`,
        description: "You can undo this straight after. Nothing is live until you save the form.",
        confirmLabel: "Remove field",
        destructive: true,
      }))
    ) {
      return;
    }

    const newFields = schema.fields.filter((_, i) => i !== index);
    commitSchema({ ...schema, fields: newFields });
    if (selectedFieldId === field.id) setSelectedFieldId(null);
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= schema.fields.length || fromIndex === toIndex) return;
    const newFields = [...schema.fields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, removed);
    commitSchema({ ...schema, fields: newFields });
  };

  const addRadioOption = (fieldIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field?.type !== "radio-group") return;

    const existing = field.radioOptions ?? [];
    // The answer value is what a submission carries and what the Elementor
    // mapping keys on, so it has to be unique within the field even after
    // options have been deleted. It is set once here and never changes.
    const naming = generateOptionNaming(existing);
    const option = createEmptyPackageOption(naming.value);

    updateField(fieldIndex, { radioOptions: [...existing, option] }, null);
  };

  const removeRadioOption = async (fieldIndex: number, optionIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field?.type !== "radio-group" || !field.radioOptions) return;

    const option = field.radioOptions[optionIndex];
    if (!option) return;

    const name = option.title || option.value;
    if (
      !(await confirm({
        title: `Remove "${name}"?`,
        description: "Customers will no longer be able to choose this package. The package itself stays in Products.",
        confirmLabel: "Remove package",
        destructive: true,
      }))
    ) {
      return;
    }

    updateField(
      fieldIndex,
      { radioOptions: field.radioOptions.filter((_, i) => i !== optionIndex) },
      null,
    );
  };

  /**
   * Point one of a picker's choices at a package.
   *
   * The option's id and answer value survive untouched - a saved form's
   * submissions and its Elementor value->option mapping are both keyed on
   * them, so swapping the package must not invalidate either.
   */
  const choosePackageForOption = (
    fieldIndex: number,
    optionIndex: number,
    choice: PackageChoice | null,
  ) => {
    const field = schema.fields[fieldIndex];
    if (field?.type !== "radio-group" || !field.radioOptions) return;
    const option = field.radioOptions[optionIndex];
    if (!option) return;

    const next = choice
      ? applyPackageToOption(option, choice)
      : { ...option, source: "offer" as const, offer_id: null, products: [], title: "", price: 0 };

    const radioOptions = [...field.radioOptions];
    radioOptions[optionIndex] = next;
    updateField(fieldIndex, { radioOptions }, null);
  };

  /** Same, for the optional checkout add-on. */
  const choosePackageForBump = (fieldIndex: number, choice: PackageChoice | null) => {
    const field = schema.fields[fieldIndex];
    if (field?.type !== "order-bump" || !field.orderBump) return;

    const bump = field.orderBump;
    const next = choice
      ? applyPackageToOption(bump, choice)
      : { ...bump, source: "offer" as const, offer_id: null, products: [], title: "", price: 0 };

    updateField(fieldIndex, { orderBump: next }, null);
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

  const packageHandlers = {
    onAddOption: addRadioOption,
    onRemoveOption: removeRadioOption,
    onChoosePackage: choosePackageForOption,
    onChooseBumpPackage: choosePackageForBump,
  };

  // Every active offer in the catalog, as a pickable package. Derived from
  // data already loaded, so the picker costs no extra request.
  const packageCatalog = useMemo(
    () => buildPackageCatalog(products, offersByProduct, variantsByProduct),
    [products, offersByProduct, variantsByProduct],
  );

  const productsContext = { productsLoading, packageCatalog };

  // A package picker with no packages to pick is a dead end, so the palette
  // says so up front rather than handing over a field that can't be finished.
  const noPackagesReason =
    !productsLoading && packageCatalog.choices.length === 0
      ? "You haven't set up any packages yet. A package is the offer or bundle customers choose — create one under Products, then add this field."
      : undefined;
  const paletteUnavailable = noPackagesReason
    ? { "radio-group": noPackagesReason, "order-bump": noPackagesReason }
    : {};

  const explainUnavailable = (_type: FormField["type"], reason: string) => {
    toast("Set up a package first", {
      description: reason,
      duration: 8000,
      action: {
        label: "Open Products",
        // New tab on purpose - navigating away would lose unsaved work.
        onClick: () => window.open("/products", "_blank", "noopener"),
      },
    });
  };

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
      packageHandlers={packageHandlers}
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
                <div className="h-8 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={!canUndo}
                    className="btn-icon"
                    title="Undo"
                    aria-label="Undo"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={!canRedo}
                    className="btn-icon"
                    title="Redo"
                    aria-label="Redo"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
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
                      onSelectField={selectField}
                      onMoveField={moveField}
                      onRemoveField={removeField}
                      onDuplicateField={duplicateField}
                      onInsertAt={(index, type) => insertField(type ?? "text", index)}
                    />
                  </div>
                  {/* Both the palette and the field settings stay reachable. The
                      rail used to swap one for the other on selection, so adding
                      a second field meant deselecting the first.

                      Rendered only on desktop - below `lg` the same panel lives
                      in a sheet, and mounting both at once would duplicate every
                      input id and label in the DOM. */}
                  {isDesktop && (
                    <div className="builder-panel-col flex">
                      <div className="builder-rail-tabs" role="tablist">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={railTab === "add"}
                          onClick={() => setRailTab("add")}
                          className={`builder-rail-tab ${railTab === "add" ? "builder-rail-tab-active" : ""}`}
                        >
                          Add field
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={railTab === "edit"}
                          onClick={() => setRailTab("edit")}
                          disabled={!selectedField}
                          title={selectedField ? undefined : "Pick a field on the left to edit it"}
                          className={`builder-rail-tab ${railTab === "edit" ? "builder-rail-tab-active" : ""}`}
                        >
                          Edit field
                        </button>
                      </div>
                      <div className="builder-rail-body">
                        {railTab === "edit" && selectedField ? (
                          fieldSettingsPanel
                        ) : railTab === "edit" ? (
                          <p className="builder-rail-empty">Select a field on the left to edit it.</p>
                        ) : (
                          <FieldPalette
                          onAddField={addField}
                          unavailable={paletteUnavailable}
                          onUnavailable={explainUnavailable}
                        />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!isDesktop && (
                  <button
                    type="button"
                    onClick={() => setMobilePaletteOpen(true)}
                    className="mobile-add-field-fab"
                  >
                    <Plus className="w-4 h-4" />
                    Add Field
                  </button>
                )}
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
                  onSchemaChange={(updates, coalesceKey) =>
                    commitSchema({ ...schema, ...updates }, coalesceKey ?? undefined)
                  }
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
                    <p className="text-muted-foreground mt-1">Go to Settings → Numbatrak Forms and paste your API base URL:</p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">{PUBLIC_API_BASE_URL}</code>
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(PUBLIC_API_BASE_URL, "API base URL")}
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

      {/* Mobile only. `lg:hidden` on the content was not enough: Radix renders
          the overlay, locks body scroll and traps focus whenever the dialog is
          open, so on desktop selecting a field dimmed the whole page behind an
          invisible panel. Gate the mount, not the visibility. */}
      {!isDesktop && (
        <>
          <Sheet open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen}>
            <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Add a field</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">
                <FieldPalette
                  onAddField={addField}
                  unavailable={paletteUnavailable}
                  onUnavailable={explainUnavailable}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet
            open={!!selectedField}
            onOpenChange={(open: boolean) => !open && setSelectedFieldId(null)}
          >
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Edit field</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">{fieldSettingsPanel}</div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </PageLayout>
  );
}
