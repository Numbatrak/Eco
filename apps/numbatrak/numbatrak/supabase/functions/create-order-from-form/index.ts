// Supabase Edge Function: Create Form Response from Form Submission
// Form intake + normalization: raw_payload, normalized_payload, submission_status.
// Order path: FIFO inventory via RPC; abandoned_cart: no inventory.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Canonical fields every form submission must be normalized into when possible
const CANONICAL_KEYS = [
  "first_name",
  "last_name",
  "phone",
  "whatsapp",
  "state",
  "address",
  "items",
  "package",
  "offer_name",
  "submitted_at",
  "site_url",
] as const;

type FieldMapping = Record<string, string>; // external_key -> canonical_key

interface OrderItemInput {
  product_id: string;
  quantity: number;
  variant_id?: string;
  offer_id?: string;
  quantity_paid?: number;
  free_quantity?: number;
  true_unit_count?: number;
}

interface FormSubmissionData {
  form_token: string;
  customer_name?: string;
  customer_phone?: string | null;
  field_values?: Record<string, any>;
  items?: OrderItemInput[];
  source?: string;
  offer_name?: string;
  [key: string]: any;
}

interface FormSchemaField {
  name: string;
  type: string;
  required?: boolean;
  showWhen?: { fieldName: string; equals: string };
}

interface FormSchemaPayload {
  fields?: FormSchemaField[];
  confirmation?: {
    type: "message" | "redirect";
    message?: string;
    redirectUrl?: string;
  };
}

const NG_PHONE_REGEX =
  /^(?:\+?234|0)?(70[1-9]|80[2-9]|81[0-9]|90[1-9]|91[0-9])\d{7}$/;

function normalizePhoneInput(value: string): string {
  return value.replace(/[\s\-().]/g, "").trim();
}

function isValidNigerianPhone(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const normalized = normalizePhoneInput(value);
  return normalized.length > 0 && NG_PHONE_REGEX.test(normalized);
}

function isFieldVisible(
  field: FormSchemaField,
  fieldValues: Record<string, unknown>
): boolean {
  if (!field.showWhen?.fieldName) return true;
  const current = fieldValues[field.showWhen.fieldName];
  return String(current ?? "") === String(field.showWhen.equals ?? "");
}

function validateSubmissionAgainstSchema(
  schema: FormSchemaPayload | null | undefined,
  fieldValues: Record<string, unknown>
): string | null {
  if (!schema?.fields?.length) return null;

  for (const field of schema.fields) {
    if (!isFieldVisible(field, fieldValues)) continue;
    if (!field.required) continue;

    const value = fieldValues[field.name];
    const isEmpty =
      value == null ||
      (typeof value === "string" && value.trim() === "") ||
      (field.type === "radio-group" && !value);

    if (isEmpty) {
      return `Missing required field: ${field.name}`;
    }

    if (field.type === "phone") {
      if (!isValidNigerianPhone(String(value))) {
        return `Invalid phone number for field: ${field.name}`;
      }
    }
  }

  const phoneKeys = [
    "phone",
    "whatsapp_number",
    "whatsapp",
    "customer_phone",
    "phone_number",
  ];
  for (const key of phoneKeys) {
    const val = fieldValues[key];
    if (val != null && String(val).trim() !== "" && !isValidNigerianPhone(String(val))) {
      return `Invalid phone number: ${key}`;
    }
  }

  return null;
}

interface NormalizedResult {
  normalizedPayload: Record<string, any>;
  items: OrderItemInput[];
  package: string | null;
  offer_name: string | null;
  submissionStatus: "raw_submission" | "abandoned_cart";
}

/** Maps external fields to canonical. Every submission is normalized into canonical fields when possible. */
function normalizePayload(
  rawPayload: Record<string, any>,
  fieldMapping: FieldMapping | null
): NormalizedResult {
  const normalized: Record<string, any> = {};
  // field_mapping: external_key -> canonical_key
  if (fieldMapping && Object.keys(fieldMapping).length > 0) {
    for (const [externalKey, canonicalKey] of Object.entries(fieldMapping)) {
      const val = rawPayload[externalKey];
      if (val !== undefined && val !== null) normalized[canonicalKey] = val;
    }
  }
  for (const canonical of CANONICAL_KEYS) {
    if (normalized[canonical] != null) continue;
    const val = rawPayload[canonical];
    if (val !== undefined && val !== null) normalized[canonical] = val;
  }

  // Common aliases when no mapping (backward compat)
  if (normalized.first_name == null && rawPayload.customer_name != null)
    normalized.first_name = rawPayload.customer_name;
  if (
    normalized.last_name == null &&
    (rawPayload.last_name != null || rawPayload.surname != null)
  )
    normalized.last_name = rawPayload.last_name ?? rawPayload.surname;
  if (normalized.phone == null && rawPayload.customer_phone != null)
    normalized.phone = rawPayload.customer_phone;
  if (normalized.whatsapp == null && rawPayload.whatsapp_number != null)
    normalized.whatsapp = rawPayload.whatsapp_number;
  if (
    normalized.state == null &&
    (rawPayload.state_region != null ||
      rawPayload.region != null ||
      rawPayload.location != null)
  )
    normalized.state =
      rawPayload.state_region ?? rawPayload.region ?? rawPayload.location;
  if (
    normalized.address == null &&
    (rawPayload.delivery_address != null ||
      rawPayload.address_line != null ||
      rawPayload.full_address != null)
  )
    normalized.address =
      rawPayload.delivery_address ??
      rawPayload.address_line ??
      rawPayload.full_address;
  if (
    normalized.package == null &&
    (rawPayload.package_name != null || rawPayload.selected_package != null)
  )
    normalized.package = rawPayload.package_name ?? rawPayload.selected_package;

  // submitted_at: always set at normalization time (canonical)
  const submittedAt = new Date().toISOString();
  normalized.submitted_at = submittedAt;

  // site_url: page/site where form was submitted (canonical)
  const siteUrl =
    rawPayload.site_url ??
    rawPayload.page_url ??
    rawPayload.field_values?.site_url ??
    rawPayload.field_values?.page_url ??
    null;
  normalized.site_url = siteUrl ?? null;

  // items: structured if possible, otherwise preserve raw text
  let items: OrderItemInput[] = [];
  let itemsCanonical: OrderItemInput[] | string | null = null;
  if (Array.isArray(rawPayload.items)) {
    const structured = rawPayload.items
      .filter(
        (i: any) =>
          i && typeof i.product_id === "string" && Number(i.quantity) > 0
      )
      .map((i: any) => {
        const item: OrderItemInput = {
          product_id: String(i.product_id),
          quantity: Number(i.quantity),
        };
        if (i.variant_id) item.variant_id = String(i.variant_id);
        if (i.offer_id) item.offer_id = String(i.offer_id);
        if (i.quantity_paid != null) item.quantity_paid = Number(i.quantity_paid);
        if (i.free_quantity != null) item.free_quantity = Number(i.free_quantity);
        if (i.true_unit_count != null)
          item.true_unit_count = Number(i.true_unit_count);
        return item;
      });
    if (structured.length > 0) {
      items = structured;
      itemsCanonical = structured;
    } else {
      itemsCanonical = rawPayload.items_text ?? String(rawPayload.items ?? "");
    }
  } else if (rawPayload.items != null) {
    itemsCanonical =
      typeof rawPayload.items === "string"
        ? rawPayload.items
        : JSON.stringify(rawPayload.items);
  }
  normalized.items = itemsCanonical ?? items;

  const packageVal =
    normalized.package ??
    rawPayload.package ??
    rawPayload.package_name ??
    rawPayload.selected_package ??
    null;
  const offerName =
    normalized.offer_name ?? rawPayload.offer_name ?? rawPayload.offer ?? null;
  normalized.package = packageVal;
  normalized.offer_name = offerName;

  const hasContact =
    (normalized.first_name ||
      normalized.last_name ||
      rawPayload.customer_name ||
      rawPayload.name) &&
    (normalized.phone ||
      normalized.whatsapp ||
      rawPayload.customer_phone ||
      rawPayload.phone);
  const submissionStatus: "raw_submission" | "abandoned_cart" =
    hasContact && items.length === 0 ? "abandoned_cart" : "raw_submission";

  return {
    normalizedPayload: { ...normalized },
    items,
    package: packageVal,
    offer_name: offerName,
    submissionStatus,
  };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Mirror form_response abandonment into abandoned_carts for the ops UI. */
function buildAbandonedCartRow(params: {
  organizationId: string;
  formId: string;
  fieldValues: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  pkg: string | null;
  pageUrl: string | null;
  formResponseId: string;
  selectedProducts?: OrderItemInput[];
  funnelName?: string | null;
  offerName?: string | null;
  subBrand?: string | null;
}): Record<string, unknown> {
  const fv = params.fieldValues;
  const np = params.normalizedPayload;
  const first = np.first_name ?? fv.customer_name ?? fv.name ?? null;
  const last = np.last_name ?? fv.last_name ?? fv.surname ?? null;
  const customerName =
    first && last
      ? `${String(first).trim()} ${String(last).trim()}`.trim()
      : first
        ? String(first).trim()
        : last
          ? String(last).trim()
          : null;
  const phone =
    np.phone ?? fv.customer_phone ?? fv.phone_number ?? fv.phone ?? null;
  const whatsapp = np.whatsapp ?? fv.whatsapp_number ?? fv.whatsapp ?? null;
  const deliveryAddress =
    np.address ?? fv.delivery_address ?? fv.address ?? null;
  const state = np.state ?? fv.state ?? fv.region ?? null;
  const location =
    deliveryAddress && state
      ? `${deliveryAddress}, ${state}`
      : (deliveryAddress ?? state ?? fv.location ?? null);

  const filledFieldKeys = Object.keys(fv).filter((key) => {
    const value = fv[key];
    return value != null && String(value).trim() !== "";
  });

  const now = new Date();

  return {
    organization_id: params.organizationId,
    form_id: params.formId,
    customer_name: customerName,
    phone_number: phone,
    whatsapp_number: whatsapp,
    delivery_address: deliveryAddress,
    state,
    location,
    selected_package: params.pkg,
    page_url: params.pageUrl,
    field_values: fv,
    filled_fields: filledFieldKeys,
    selected_products: params.selectedProducts ?? [],
    filled_fields_count: filledFieldKeys.length,
    funnel_name: params.funnelName ?? null,
    offer_name: params.offerName ?? params.pkg,
    sub_brand: params.subBrand ?? null,
    note: `Synced from form_response ${params.formResponseId}`,
    abandoned_at: now.toISOString(),
    order_date: now.toISOString().split("T")[0],
    order_month: MONTH_NAMES[now.getMonth()],
    order_year: String(now.getFullYear()),
    order_status: "Pending",
    subject: "Abandoned Cart",
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Supabase client with service role key (bypasses RLS for validation)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Parse request body (full payload stored as raw_payload; no frontend changes)
    const body: FormSubmissionData = await req.json();
    const rawPayload = { ...body };

    console.log("=== Form Submission Request ===");
    console.log("Form Token:", body.form_token);
    console.log("Items received:", JSON.stringify(body.items, null, 2));

    if (!body.form_token) {
      return new Response(
        JSON.stringify({ error: "Missing required field: form_token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // Form Token & Organization + field_mapping
    // ============================================
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select("id, organization_id, active, name, field_mapping, schema, funnel_name, sub_brand")
      .eq("form_token", body.form_token)
      .single();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ error: "Invalid or not found form token" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!form.active) {
      return new Response(JSON.stringify({ error: "Form is not active" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = form.organization_id;

    // Field mapping: form.field_mapping or active row from field_mappings (if table exists)
    let fieldMapping: FieldMapping | null = (form as any).field_mapping ?? null;
    if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
      const { data: fm, error: _fmErr } = await supabase
        .from("field_mappings")
        .select("mapping")
        .eq("form_id", form.id)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!_fmErr && fm?.mapping && typeof fm.mapping === "object")
        fieldMapping = fm.mapping as FieldMapping;
    }

    const {
      normalizedPayload,
      items,
      package: pkg,
      offer_name: offerName,
      submissionStatus,
    } = normalizePayload(rawPayload, fieldMapping);

    // Build field_values for DB: all canonical fields (backward compat + triggers use customer_name, phone_number, package_name)
    const fieldValues: Record<string, any> = {
      customer_name:
        normalizedPayload.first_name ??
        normalizedPayload.last_name ??
        rawPayload.customer_name ??
        rawPayload.name,
      customer_phone:
        normalizedPayload.phone ??
        normalizedPayload.whatsapp ??
        rawPayload.customer_phone ??
        rawPayload.phone,
      ...normalizedPayload,
      ...(rawPayload.field_values || {}),
    };

    // ============================================
    // ABANDONED CART: contact exists, items missing/unparseable → store, no inventory
    // ============================================
    if (submissionStatus === "abandoned_cart") {
      const hasCustomerName =
        fieldValues.customer_name ||
        fieldValues.name ||
        (fieldValues.first_name && fieldValues.last_name);
      const hasPhone =
        fieldValues.customer_phone ||
        fieldValues.phone_number ||
        fieldValues.whatsapp_number ||
        fieldValues.phone ||
        fieldValues.whatsapp;

      if (!hasCustomerName || !hasPhone) {
        return new Response(
          JSON.stringify({
            error:
              "Abandoned cart requires contact details (name and phone or WhatsApp)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const selectedProducts = Array.isArray(rawPayload.selected_products)
        ? rawPayload.selected_products
        : items;

      const insertData: Record<string, any> = {
        organization_id: organizationId,
        form_id: form.id,
        response_type: "abandoned_cart",
        status: "abandoned",
        source: body.source ?? "wordpress",
        page_url:
          normalizedPayload.site_url ??
          rawPayload.field_values?.page_url ??
          rawPayload.page_url ??
          null,
        field_values: fieldValues,
        selected_products: selectedProducts,
        raw_payload: rawPayload,
        normalized_payload: normalizedPayload,
        items: [],
        package: pkg ?? null,
        offer_name: offerName ?? null,
        submitted_at:
          normalizedPayload.submitted_at ?? new Date().toISOString(),
        submission_status: "abandoned_cart",
      };
      const { data: abandonedRow, error: abandonedErr } = await supabase
        .from("form_responses")
        .insert([insertData])
        .select("id, created_at")
        .single();
      if (abandonedErr) {
        console.error("Abandoned cart insert error:", abandonedErr);
        return new Response(
          JSON.stringify({
            error: "Failed to save abandoned cart",
            details: abandonedErr.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const pageUrl =
        normalizedPayload.site_url ??
        rawPayload.field_values?.page_url ??
        rawPayload.page_url ??
        null;

      const cartRow = buildAbandonedCartRow({
        organizationId,
        formId: form.id,
        fieldValues,
        normalizedPayload,
        pkg: pkg ?? null,
        pageUrl,
        formResponseId: abandonedRow.id,
        selectedProducts,
        funnelName:
          (form as { funnel_name?: string }).funnel_name ?? form.name,
        offerName: offerName ?? pkg ?? null,
        subBrand: (form as { sub_brand?: string }).sub_brand ?? null,
      });

      const { data: mirroredCart, error: mirrorErr } = await supabase
        .from("abandoned_carts")
        .insert([cartRow])
        .select("id")
        .single();

      if (mirrorErr) {
        console.error("Abandoned cart mirror insert error:", mirrorErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          form_response: {
            id: abandonedRow.id,
            submission_status: "abandoned_cart",
            created_at: abandonedRow.created_at,
          },
          abandoned_cart_id: mirroredCart?.id ?? null,
          message: "Abandoned cart saved (no inventory consumed)",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============================================
    // ORDER PATH: require items, validate products, then FIFO via RPC
    // ============================================
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or empty items array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate customer name and phone for order path (backward compat)
    const hasCustomerName =
      fieldValues.customer_name ||
      fieldValues.name ||
      (fieldValues.first_name && fieldValues.last_name);
    if (!hasCustomerName) {
      return new Response(
        JSON.stringify({
          error:
            "Missing customer name. Form must include one of: customer_name, name, or first_name + last_name",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const hasPhone =
      fieldValues.customer_phone ||
      fieldValues.phone_number ||
      fieldValues.whatsapp_number ||
      fieldValues.phone ||
      fieldValues.whatsapp;
    if (!hasPhone) {
      return new Response(
        JSON.stringify({
          error:
            "Missing phone number. Form must include one of: customer_phone, phone_number, whatsapp_number, or phone",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const schemaValidationError = validateSubmissionAgainstSchema(
      (form as { schema?: FormSchemaPayload }).schema,
      fieldValues
    );
    if (schemaValidationError) {
      return new Response(
        JSON.stringify({ error: schemaValidationError }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Derive offer_name from payload or selected package title
    const resolvedOfferName =
      offerName ??
      body.offer_name ??
      fieldValues.offer_name ??
      fieldValues.package_name ??
      fieldValues.selected_package ??
      pkg ??
      null;

    console.log("=== Product Validation ===");
    const productIds = items.map((item) => item.product_id);
    const uniqueProductIds = [...new Set(productIds)];

    console.log("Extracted product IDs:", uniqueProductIds);
    console.log("Unique product IDs count:", uniqueProductIds.length);

    // Better error message if items array is empty or invalid
    if (uniqueProductIds.length === 0) {
      console.error("ERROR: No product IDs found in items array");
      return new Response(
        JSON.stringify({
          error: "No products selected",
          details:
            "The form submission did not include any products. Please ensure radio group options have products attached.",
          received_items: items,
          debug: { items_count: items?.length || 0, items_array: items },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate product IDs are valid UUIDs
    const invalidProductIds = uniqueProductIds.filter((id) => {
      // Check if it's a valid UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return !uuidRegex.test(id);
    });

    if (invalidProductIds.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid product ID format",
          details: "Product IDs must be valid UUIDs",
          invalid_ids: invalidProductIds,
          received_items: items,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Querying products table with IDs:", uniqueProductIds);
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, organization_id, active, type")
      .in("id", uniqueProductIds);

    if (productsError) {
      console.error("ERROR: Database query failed:", productsError);
      console.error("Query details:", {
        table: "products",
        ids_requested: uniqueProductIds,
        error_code: productsError.code,
        error_message: productsError.message,
        error_details: productsError.details,
        error_hint: productsError.hint,
      });
      return new Response(
        JSON.stringify({
          error: "Error fetching products",
          details: productsError.message,
          product_ids_requested: uniqueProductIds,
          debug: {
            error_code: productsError.code,
            error_details: productsError.details,
            error_hint: productsError.hint,
          },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Products found in database:", products?.length || 0);
    if (products && products.length > 0) {
      console.log(
        "Found products:",
        products.map((p) => ({ id: p.id, name: p.name, active: p.active }))
      );
    }

    if (!products || products.length === 0) {
      console.error("ERROR: No products found in database");
      console.error("Requested product IDs:", uniqueProductIds);
      console.error("Received items:", JSON.stringify(items, null, 2));

      // Try to find what products exist for this organization (so user can re-attach in Form Builder)
      const { data: orgProducts } = await supabase
        .from("products")
        .select("id, name, organization_id, active")
        .eq("organization_id", organizationId)
        .limit(10);

      console.log(
        "Sample products for this organization:",
        orgProducts?.map((p) => ({ id: p.id, name: p.name })) || []
      );

      return new Response(
        JSON.stringify({
          error: "No valid products found",
          details:
            "The product IDs in this form do not exist in the database (they may have been deleted or belong to another organization). Open the form in Form Builder and re-attach products to the radio options.",
          product_ids_requested: uniqueProductIds,
          received_items: items,
          debug: {
            organization_id: organizationId,
            sample_products_in_org:
              orgProducts?.map((p) => ({ id: p.id, name: p.name })) || [],
            total_products_in_org: orgProducts?.length || 0,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify all products belong to the same organization as the form
    const invalidProducts = products.filter(
      (p) => p.organization_id !== organizationId
    );

    if (invalidProducts.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Some products do not belong to the form's organization",
          invalid_products: invalidProducts.map((p) => ({
            id: p.id,
            name: p.name,
          })),
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify all products are active
    const inactiveProducts = products.filter((p) => !p.active);

    if (inactiveProducts.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Some products are not active",
          inactive_products: inactiveProducts.map((p) => ({
            id: p.id,
            name: p.name,
          })),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify all requested product IDs exist
    const foundProductIds = products.map((p) => p.id);
    const missingProductIds = uniqueProductIds.filter(
      (id) => !foundProductIds.includes(id)
    );

    if (missingProductIds.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Some products were not found",
          missing_product_ids: missingProductIds,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Quantities validation
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        return new Response(
          JSON.stringify({
            error: `Invalid quantity for product: ${item.product_id}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ============================================
    // CREATE ORDER VIA RPC (FIFO inventory, single transaction)
    // ============================================
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_order_from_normalized_submission",
      {
        p_organization_id: organizationId,
        p_form_id: form.id,
        p_source: body.source ?? "wordpress",
        p_page_url:
          normalizedPayload.site_url ??
          rawPayload.field_values?.page_url ??
          rawPayload.page_url ??
          null,
        p_field_values: fieldValues,
        p_items: items,
        p_raw_payload: rawPayload,
        p_normalized_payload: normalizedPayload,
        p_package: pkg ?? null,
        p_offer_name: resolvedOfferName ?? null,
      }
    );

    if (rpcError) {
      console.error(
        "RPC create_order_from_normalized_submission error:",
        rpcError
      );
      const msg = rpcError.message ?? "Order creation failed";
      const statusCode = msg.includes("Insufficient inventory") ? 400 : 500;
      return new Response(
        JSON.stringify({ error: "Failed to create order", details: msg }),
        {
          status: statusCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = rpcResult as {
      id: string;
      order_cost?: number;
      order_revenue?: number;
      order_profit?: number;
    };
    const formSchema = (form as { schema?: FormSchemaPayload }).schema;
    return new Response(
      JSON.stringify({
        success: true,
        form_response: {
          id: result.id,
          organization_id: organizationId,
          form_id: form.id,
          response_type: "order",
          status: "new",
          submission_status: "order_created",
          order_cost: result.order_cost,
          order_revenue: result.order_revenue,
          order_profit: result.order_profit,
          profit: 0,
          funnel_name: (form as { funnel_name?: string }).funnel_name ?? form.name,
          sub_brand: (form as { sub_brand?: string }).sub_brand ?? null,
        },
        totals: {
          total_price: result.order_revenue,
          total_cost: result.order_cost,
          profit: 0,
          order_profit: result.order_profit,
        },
        confirmation: formSchema?.confirmation ?? {
          type: "message",
          message: "Thank you for your order. We'll be in touch soon.",
        },
        message: "Form response created successfully with FIFO inventory",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
