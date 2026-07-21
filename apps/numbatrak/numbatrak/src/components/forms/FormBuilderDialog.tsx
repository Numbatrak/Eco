import { FormEvent, useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogClose } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Form, FormField, FormSchema, RadioOption, RadioOptionProduct } from "../../types/form";
import { Trash2, Plus, Eye, EyeOff, Package, Type, Mail, Phone, Hash, FileText, List, Radio, GripVertical, Sparkles } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useOrganization } from "../../contexts/OrganizationContext";
import { fetchProducts } from "../../services/products";
import { Product } from "../../types/product";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { useConfirm } from "../../contexts/ConfirmContext";

interface FormBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  form: Form | null;
  formName: string;
  onFormNameChange: (name: string) => void;
  formToken: string;
  onFormTokenChange: (token: string) => void;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function FormBuilderDialog({
  open,
  onOpenChange,
  mode,
  form,
  formName,
  onFormNameChange,
  formToken,
  onFormTokenChange,
  active,
  onActiveChange,
  schema,
  onSchemaChange,
  error,
  saving,
  onSubmit,
}: FormBuilderDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedRadioField, setExpandedRadioField] = useState<string | null>(null);
  const [expandedRadioOption, setExpandedRadioOption] = useState<string | null>(null);

  // Load products when dialog opens
  useEffect(() => {
    if (open && currentOrganization) {
      loadProducts();
    }
  }, [open, currentOrganization]);

  const loadProducts = async () => {
    if (!currentOrganization) return;
    try {
      setProductsLoading(true);
      const data = await fetchProducts(currentOrganization.id, {
        activeOnly: true,
      });
      setProducts(data);
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setProductsLoading(false);
    }
  };

  const handleSubmitClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  const addField = () => {
    const fieldCount = schema.fields.length;
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: 'text',
      label: `Field ${fieldCount + 1}`,
      name: `field_${fieldCount + 1}`,
      required: false,
      placeholder: '',
    };
    onSchemaChange({
      ...schema,
      fields: [...schema.fields, newField],
    });
  };

  const addRadioOption = (fieldIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== 'radio-group') return;
    
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

  const updateRadioOption = (fieldIndex: number, optionIndex: number, updates: Partial<RadioOption>) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== 'radio-group' || !field.radioOptions) return;
    
    const newOptions = [...field.radioOptions];
    newOptions[optionIndex] = { ...newOptions[optionIndex], ...updates };
    updateField(fieldIndex, { radioOptions: newOptions });
  };

  const removeRadioOption = async (fieldIndex: number, optionIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== 'radio-group' || !field.radioOptions) return;

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
    if (field.type !== 'radio-group' || !field.radioOptions) return;
    
    const option = field.radioOptions[optionIndex];
    const newProduct: RadioOptionProduct = {
      product_id: products[0]?.id || '', // Already a string (UUID), no need for toString()
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
    if (field.type !== 'radio-group' || !field.radioOptions) return;
    
    const option = field.radioOptions[optionIndex];
    const newProducts = [...option.products];
    newProducts[productIndex] = { ...newProducts[productIndex], ...updates };
    
    updateRadioOption(fieldIndex, optionIndex, { products: newProducts });
  };

  const removeProductFromRadioOption = (fieldIndex: number, optionIndex: number, productIndex: number) => {
    const field = schema.fields[fieldIndex];
    if (field.type !== 'radio-group' || !field.radioOptions) return;
    
    const option = field.radioOptions[optionIndex];
    const newProducts = option.products.filter((_, i) => i !== productIndex);
    updateRadioOption(fieldIndex, optionIndex, { products: newProducts });
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...schema.fields];
    const currentField = newFields[index];
    
    // If changing to radio-group, initialize radioOptions
    if (updates.type === 'radio-group' && currentField.type !== 'radio-group') {
      updates.radioOptions = updates.radioOptions || [];
    }
    
    // If changing from radio-group to another type, remove radioOptions
    if (currentField.type === 'radio-group' && updates.type && updates.type !== 'radio-group') {
      const { radioOptions, ...rest } = updates;
      updates = rest;
    }
    
    newFields[index] = { ...currentField, ...updates };
    onSchemaChange({
      ...schema,
      fields: newFields,
    });
  };

  const removeField = async (index: number) => {
    const field = schema.fields[index];
    if (
      !(await confirm({
        title: "Remove field?",
        description: `Remove "${field.label}" from this form? Unsaved changes are not saved until you submit.`,
        confirmLabel: "Remove",
        destructive: true,
      }))
    ) {
      return;
    }

    const newFields = schema.fields.filter((_, i) => i !== index);
    onSchemaChange({
      ...schema,
      fields: newFields,
    });
  };

  const updateSubmitButton = (updates: Partial<FormSchema['submitButton']>) => {
    onSchemaChange({
      ...schema,
      submitButton: {
        text: "Submit Order",
        loadingText: "Processing...",
        ...schema.submitButton,
        ...updates,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden bg-card border border-border shadow-2xl p-0 flex flex-col">
        <BrandedDialogHero
          icon={<FileText className="h-7 w-7" aria-hidden />}
          title={mode === "create" ? "Create New Form" : "Edit Form"}
          description={
            mode === "create"
              ? "Build a custom form for order collection"
              : "Update form configuration"
          }
        />

        <form 
          ref={formRef} 
          onSubmit={onSubmit} 
          className="flex flex-col flex-1 overflow-hidden"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
        >
          <Tabs defaultValue="builder" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-8 mt-6 mb-0">
              <TabsTrigger value="builder">Form Builder</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="flex-1 overflow-y-auto px-8 py-6 space-y-6 mt-0">
              {error && (
                <div className="mb-4">
                  <ErrorAlert message={error} />
                </div>
              )}

              {/* Basic Info Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Basic Information</h3>
                
                <div>
                  <Label htmlFor="form-name" className="text-base font-semibold">
                    Form Name *
                  </Label>
                  <Input
                    id="form-name"
                    type="text"
                    value={formName}
                    onChange={(e) => onFormNameChange(e.target.value)}
                    placeholder="e.g., Product Order Form"
                    className="mt-2"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="form-token" className="text-base font-semibold">
                    Form Token *
                  </Label>
                  <Input
                    id="form-token"
                    type="text"
                    value={formToken}
                    onChange={(e) => onFormTokenChange(e.target.value)}
                    placeholder="e.g., form_live_abc123"
                    className="mt-2 font-mono text-sm"
                    required
                    disabled={mode === "edit"}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {mode === "create"
                      ? "Unique token for embedding (auto-generated, can be changed)"
                      : "Form token cannot be changed"}
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <Label htmlFor="form-active" className="text-base font-semibold">
                      Active
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Only active forms can be embedded and used
                    </p>
                  </div>
                  <Switch
                    id="form-active"
                    checked={active}
                    onCheckedChange={onActiveChange}
                  />
                </div>
              </div>

              {/* Form Fields Section */}
              <div className="space-y-4">
                <Card className="border-2 border-dashed border-border bg-gradient-to-br from-muted to-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/15 rounded-lg">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Form Fields</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            Add fields to collect customer information or create product selection groups
                          </CardDescription>
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        onClick={addField} 
                        size="sm" 
                        className="bg-primary hover:bg-primary/90 text-white shadow-sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Field
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                  {schema.fields.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/15 mb-4">
                        <Sparkles className="w-8 h-8 text-primary" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">No fields added yet</h4>
                      <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
                        Start building your form by adding fields. You can create text inputs, radio groups with products, or other field types.
                      </p>
                      <Button 
                        type="button" 
                        onClick={addField} 
                        variant="outline"
                        className="border-primary/40 text-primary hover:bg-primary/10"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Field
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {schema.fields.map((field, index) => {
                    const getFieldIcon = (type: string) => {
                      switch (type) {
                        case 'text': return <Type className="w-4 h-4" />;
                        case 'email': return <Mail className="w-4 h-4" />;
                        case 'phone': return <Phone className="w-4 h-4" />;
                        case 'number': return <Hash className="w-4 h-4" />;
                        case 'textarea': return <FileText className="w-4 h-4" />;
                        case 'select': return <List className="w-4 h-4" />;
                        case 'radio-group': return <Radio className="w-4 h-4" />;
                        default: return <Type className="w-4 h-4" />;
                      }
                    };

                    const getFieldTypeLabel = (type: string) => {
                      switch (type) {
                        case 'text': return 'Text';
                        case 'email': return 'Email';
                        case 'phone': return 'Phone';
                        case 'number': return 'Number';
                        case 'textarea': return 'Textarea';
                        case 'select': return 'Select';
                        case 'radio-group': return 'Radio Group';
                        default: return type;
                      }
                    };

                    return (
                      <Card key={field.id} className="border border-border shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="p-2 bg-muted rounded-lg text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {getFieldIcon(field.type)}
                              </div>
                              <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {getFieldTypeLabel(field.type)}
                                  </Badge>
                                  {field.required && (
                                    <Badge variant="destructive" className="text-xs">
                                      Required
                                    </Badge>
                                  )}
                                  {field.type === 'radio-group' && field.radioOptions && (
                                    <Badge variant="secondary" className="text-xs">
                                      {field.radioOptions.length} {field.radioOptions.length === 1 ? 'option' : 'options'}
                                    </Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium text-foreground">Field Type</Label>
                                    <Select
                                      value={field.type}
                                      onValueChange={(value: FormField['type']) => updateField(index, { type: value })}
                                    >
                                      <SelectTrigger className="mt-1.5 h-9">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="text">
                                          <div className="flex items-center gap-2">
                                            <Type className="w-4 h-4" />
                                            <span>Text</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="email">
                                          <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4" />
                                            <span>Email</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="phone">
                                          <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4" />
                                            <span>Phone</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="number">
                                          <div className="flex items-center gap-2">
                                            <Hash className="w-4 h-4" />
                                            <span>Number</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="textarea">
                                          <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            <span>Textarea</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="select">
                                          <div className="flex items-center gap-2">
                                            <List className="w-4 h-4" />
                                            <span>Select</span>
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="radio-group">
                                          <div className="flex items-center gap-2">
                                            <Radio className="w-4 h-4" />
                                            <span>Radio Group</span>
                                          </div>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-end">
                                    <div className="flex items-center gap-2 w-full bg-muted p-3 rounded-lg">
                                      <Switch
                                        checked={field.required}
                                        onCheckedChange={(checked) => updateField(index, { required: checked })}
                                      />
                                      <Label className="text-sm font-medium text-foreground">Required Field</Label>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium text-foreground">Field Label</Label>
                                    <Input
                                      value={field.label}
                                      onChange={(e) => updateField(index, { label: e.target.value })}
                                      placeholder="e.g., Full Name"
                                      className="mt-1.5 h-9"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium text-foreground">Field Name</Label>
                                    <Input
                                      value={field.name}
                                      onChange={(e) => updateField(index, { name: e.target.value })}
                                      placeholder="field_name"
                                      className="mt-1.5 h-9 font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Used in form submission</p>
                                  </div>
                                </div>

                                {field.type !== 'radio-group' && (
                                  <div>
                                    <Label className="text-sm font-medium text-foreground">Placeholder (optional)</Label>
                                    <Input
                                      value={field.placeholder || ''}
                                      onChange={(e) => updateField(index, { placeholder: e.target.value })}
                                      placeholder="Enter placeholder text..."
                                      className="mt-1.5 h-9"
                                    />
                                  </div>
                                )}

                                {/* Radio Group Options */}
                                {field.type === 'radio-group' && (
                                  <div className="mt-4 pt-4 border-t border-border">
                                    <div className="flex items-center justify-between mb-4">
                                      <div>
                                        <Label className="text-sm font-semibold text-foreground">Radio Options</Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">Each option can have multiple products attached</p>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addRadioOption(index)}
                                        className="border-primary/40 text-primary hover:bg-primary/10"
                                      >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Option
                                      </Button>
                                    </div>

                                    {(!field.radioOptions || field.radioOptions.length === 0) && (
                                      <div className="text-center py-8 border-2 border-dashed border-border rounded-lg bg-gradient-to-br from-muted to-card">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/15 mb-3">
                                          <Radio className="w-6 h-6 text-primary" />
                                        </div>
                                        <p className="text-sm font-medium text-foreground mb-1">No options added yet</p>
                                        <p className="text-xs text-muted-foreground mb-4">Create options that users can select from</p>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => addRadioOption(index)}
                                          className="border-primary/40 text-primary hover:bg-primary/10"
                                        >
                                          <Plus className="w-4 h-4 mr-2" />
                                          Add First Option
                                        </Button>
                                      </div>
                                    )}

                                    {field.radioOptions && field.radioOptions.map((option, optIndex) => (
                                  <Card key={option.id} className="mb-3 border border-border bg-gradient-to-br from-card to-muted">
                                    <CardContent className="p-4">
                                      <div className="flex items-start gap-3">
                                        <div className="p-1.5 bg-primary/15 rounded text-primary mt-1">
                                          <Radio className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 space-y-3">
                                          <div className="space-y-2">
                                            <Input
                                              value={option.title}
                                              onChange={(e) => updateRadioOption(index, optIndex, { title: e.target.value })}
                                              placeholder="Option title (e.g., 4 Medium Super Absorbant Mat + Free Delivery)"
                                              className="text-sm h-9 font-medium"
                                            />
                                            <Input
                                              value={option.value}
                                              onChange={(e) => updateRadioOption(index, optIndex, { value: e.target.value })}
                                              placeholder="Option value (for form submission)"
                                              className="text-xs font-mono h-8"
                                            />
                                            <div className="flex items-center gap-2">
                                              <Label className="text-xs font-semibold text-foreground whitespace-nowrap">
                                                Price (₦):
                                              </Label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={option.price ?? 0}
                                                onChange={(e) => {
                                                  const price = parseFloat(e.target.value) || 0;
                                                  updateRadioOption(index, optIndex, { price });
                                                }}
                                                placeholder="0.00"
                                                className="text-sm h-8"
                                                required
                                              />
                                            </div>
                                          </div>

                                          {/* Products attached to this option */}
                                          <div className="pt-3 border-t border-border">
                                            <div className="flex items-center justify-between mb-3">
                                              <div className="flex items-center gap-2">
                                                <Package className="w-4 h-4 text-muted-foreground" />
                                                <Label className="text-xs font-semibold text-foreground">
                                                  Products ({option.products.length})
                                                </Label>
                                              </div>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => addProductToRadioOption(index, optIndex)}
                                                disabled={productsLoading || products.length === 0}
                                                className="text-xs h-7 border-primary/40 text-primary hover:bg-primary/10"
                                                title={productsLoading ? "Loading products..." : products.length === 0 ? "No products available. Create products first." : "Add product"}
                                              >
                                                <Plus className="w-3 h-3 mr-1" />
                                                Add Product
                                              </Button>
                                            </div>

                                            {option.products.length === 0 && (
                                              <div className="text-center py-4 border-2 border-dashed border-border rounded-lg bg-muted">
                                                <Package className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                                                <p className="text-xs text-muted-foreground">No products attached</p>
                                                <p className="text-xs text-muted-foreground mt-1">Add products to this option</p>
                                              </div>
                                            )}

                                            {option.products.map((product, prodIndex) => (
                                              <div key={prodIndex} className="flex items-center gap-2 p-2.5 bg-card rounded-lg border border-border shadow-sm hover:shadow transition-shadow">
                                                <Select
                                                  value={product.product_id}
                                                  onValueChange={(value) => updateRadioOptionProduct(index, optIndex, prodIndex, { product_id: value })}
                                                  disabled={productsLoading}
                                                >
                                                  <SelectTrigger className="flex-1 text-xs h-8 border-border">
                                                    <SelectValue placeholder={productsLoading ? "Loading..." : products.length === 0 ? "No products" : "Select product"} />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {productsLoading ? (
                                                      <SelectItem value="" disabled>Loading products...</SelectItem>
                                                    ) : products.length === 0 ? (
                                                      <SelectItem value="" disabled>No products available</SelectItem>
                                                    ) : (
                                                      products.map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                          {p.name}
                                                        </SelectItem>
                                                      ))
                                                    )}
                                                  </SelectContent>
                                                </Select>
                                                <Input
                                                  type="number"
                                                  min="1"
                                                  value={product.quantity}
                                                  onChange={(e) => updateRadioOptionProduct(index, optIndex, prodIndex, { quantity: parseInt(e.target.value) || 1 })}
                                                  placeholder="Qty"
                                                  className="w-20 text-xs h-8"
                                                />
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => removeProductFromRadioOption(index, optIndex, prodIndex)}
                                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              if (expandedRadioOption === option.id) {
                                                setExpandedRadioOption(null);
                                              } else {
                                                setExpandedRadioOption(option.id);
                                              }
                                            }}
                                            className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                                            title={expandedRadioOption === option.id ? "Hide products" : "Show products"}
                                          >
                                            {expandedRadioOption === option.id ? (
                                              <EyeOff className="w-4 h-4" />
                                            ) : (
                                              <Eye className="w-4 h-4" />
                                            )}
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeRadioOption(index, optIndex)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                            title="Remove option"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                  </div>
                                )}

                                <div className="flex justify-end pt-4 mt-4 border-t border-border">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeField(index)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Remove Field
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                    </div>
                  )}
                  </CardContent>
                </Card>
              </div>

              {/* Submit Button Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Submit Button</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="submit-text" className="text-sm font-medium">Button Text</Label>
                    <Input
                      id="submit-text"
                      type="text"
                      value={schema.submitButton?.text || "Submit Order"}
                      onChange={(e) => updateSubmitButton({ text: e.target.value })}
                      placeholder="Submit Order"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="loading-text" className="text-sm font-medium">Loading Text (optional)</Label>
                    <Input
                      id="loading-text"
                      type="text"
                      value={schema.submitButton?.loadingText || ""}
                      onChange={(e) => updateSubmitButton({ loadingText: e.target.value })}
                      placeholder="Processing..."
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-y-auto px-8 py-6 mt-0">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Form Preview</h3>
                <div className="p-6 bg-muted rounded-lg border border-border">
                  <form className="space-y-4">
                    {schema.fields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label className="text-sm font-medium">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        
                        {field.type === 'radio-group' && field.radioOptions ? (
                          <div className="space-y-2">
                            {field.radioOptions.map((option) => (
                              <label key={option.id} className="flex items-start gap-2 p-3 border border-border rounded-lg bg-card hover:bg-muted cursor-pointer">
                                <input
                                  type="radio"
                                  name={field.name}
                                  value={option.value}
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-sm">
                                    {option.title}
                                    {option.price > 0 && (
                                      <span className="ml-2 text-sm font-bold text-primary">
                                        ₦{option.price.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                  {option.products.length > 0 && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Products: {option.products.map((p, idx) => {
                                        const product = products.find(pr => pr.id === p.product_id);
                                        return `${product?.name || 'Unknown'} (${p.quantity})`;
                                      }).join(', ')}
                                    </div>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : field.type === 'select' && field.options ? (
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            className="w-full px-3 py-2 border border-border rounded-md text-sm"
                            placeholder={field.placeholder}
                            rows={3}
                          />
                        ) : (
                          <Input
                            type={field.type}
                            placeholder={field.placeholder}
                            className="text-sm"
                          />
                        )}
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      className="w-full mt-4"
                      disabled
                    >
                      {schema.submitButton?.text || "Submit Order"}
                    </Button>
                  </form>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="dialog-footer-bar">
            <DialogClose asChild>
              <button type="button" className="dialog-cancel-button">
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={saving || !formName.trim() || !formToken.trim()}
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
                  {mode === "edit" ? "Save Changes" : "Create Form"}
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
