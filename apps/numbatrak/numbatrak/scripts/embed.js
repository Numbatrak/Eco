/**
 * CRM Form Embed SDKK
 *
 * Lightweight JavaScript SDK for embedding dynamic forms in WordPress
 *
 * Features:
 * - Fetches form schema from API
 * - Dynamically renders form fields including radio groups
 * - Product quantity selectors
 * - Abandoned cart detection (30s inactivity)
 * - Secure order submission to Supabase
 *
 * Usage:
 * <div id="crm-form" data-form-token="form_live_test123"></div>
 * <script src="https://yourapp.com/embed.js"></script>
 *
 * Version: 2.0.0 - Radio Groups Support
 * Last Updated: 2026-01-25
 */

(function (window, document) {
  "use strict";

  // ============================================
  // CONFIGURATION
  // ============================================
  const SDK_VERSION = "2.0.0";
  const SDK_BUILD_DATE = "2026-01-25";

  const CONFIG = {
    API_BASE_URL: (window.CRM_API_BASE_URL || "https://api.example.com").replace(/\/$/, ""),
    INACTIVITY_TIMEOUT: 30000, // 30 seconds
    DEBUG: true,
  };

  // Log SDK version on load
  console.log(
    "%c[CRM Form SDK]",
    "color: #3b82f6; font-weight: bold; font-size: 14px;",
    `Version ${SDK_VERSION} loaded (Build: ${SDK_BUILD_DATE})`,
  );
  console.log(
    "%c[CRM Form SDK]",
    "color: #10b981; font-weight: bold;",
    "✅ Radio Groups Support Enabled",
  );

  // ============================================
  // UTILITIES
  // ============================================
  const log = (...args) => {
    if (CONFIG.DEBUG) console.log("[CRM Form SDK]", ...args);
  };

  const error = (...args) => {
    console.error("[CRM Form SDK]", ...args);
  };

  const createElement = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === "className") {
        el.className = value;
      } else if (key === "textContent") {
        el.textContent = value;
      } else if (key === "innerHTML") {
        el.innerHTML = value;
      } else if (key === "htmlFor") {
        // Special handling for label htmlFor attribute
        el.htmlFor = value;
      } else if (key === "style" && typeof value === "object") {
        Object.assign(el.style, value);
      } else {
        el.setAttribute(key, value);
      }
    });
    children.forEach((child) => {
      if (typeof child === "string") {
        el.appendChild(document.createTextNode(child));
      } else if (child) {
        el.appendChild(child);
      }
    });
    return el;
  };

  const NG_PHONE_REGEX =
    /^(?:\+?234|0)?(70[1-9]|80[2-9]|81[0-9]|90[1-9]|91[0-9])\d{7}$/;

  function normalizePhoneInput(value) {
    return String(value || "").replace(/[\s\-().]/g, "").trim();
  }

  function isValidNigerianPhone(value) {
    const normalized = normalizePhoneInput(value);
    return normalized.length > 0 && NG_PHONE_REGEX.test(normalized);
  }

  function interpolateTemplate(template, fieldValues) {
    if (!template) return "";
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = fieldValues[key];
      return val != null ? String(val) : "";
    });
  }

  function isFieldVisible(field, fieldValues) {
    if (!field.showWhen?.fieldName) return true;
    const current = fieldValues[field.showWhen.fieldName];
    return String(current ?? "") === String(field.showWhen.equals ?? "");
  }

  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function lineToOrderItem(line, optionOfferId) {
    if (!line || !line.product_id) return null;
    let productId = line.product_id;
    if (typeof productId === "number") productId = String(productId);
    if (typeof productId !== "string" || !UUID_REGEX.test(productId)) {
      error("Invalid product_id on form line:", line);
      return null;
    }
    const item = {
      product_id: productId,
      quantity: Number(line.quantity) > 0 ? Number(line.quantity) : 1,
    };
    const offerId = line.offer_id || optionOfferId;
    if (offerId) item.offer_id = String(offerId);
    if (line.variant_id) item.variant_id = String(line.variant_id);
    return item;
  }

  function mergeOrderItems(items) {
    const map = new Map();
    for (const item of items) {
      if (!item) continue;
      const key = `${item.product_id}|${item.offer_id || ""}|${item.variant_id || ""}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        map.set(key, { ...item });
      }
    }
    return Array.from(map.values());
  }

  function getSelectedOrderItems(state) {
    return mergeOrderItems([
      ...(state.selectedLineItems || []),
      ...(state.orderBumpLineItems || []),
    ]);
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  class FormState {
    constructor() {
      this.formToken = null;
      this.formSchema = null;
      this.products = new Map(); // product_id -> product details
      this.fieldValues = {};
      this.selectedLineItems = []; // { product_id, quantity, offer_id?, variant_id? }
      this.orderBumpLineItems = [];
      this.selectedOfferTitle = null;
      this.abandonedCartTimer = null;
      this.isSubmitting = false;
      this.formSubmitted = false;
      this.abandonedCartSent = false;
      this.lastInteraction = Date.now();
    }

    resetAbandonedCartTimer() {
      if (this.abandonedCartTimer) {
        clearTimeout(this.abandonedCartTimer);
      }
      this.lastInteraction = Date.now();

      if (!this.formSubmitted && Object.keys(this.fieldValues).length > 0) {
        this.abandonedCartTimer = setTimeout(() => {
          this.fireAbandonedCartEvent();
        }, CONFIG.INACTIVITY_TIMEOUT);
      }
    }

    fireAbandonedCartEvent() {
      if (this.formSubmitted || this.abandonedCartSent) return;

      const filledFields = Object.keys(this.fieldValues).filter(
        (key) =>
          this.fieldValues[key] &&
          this.fieldValues[key].toString().trim() !== "",
      );

      if (filledFields.length === 0) return;

      const firstNonEmpty = (...keys) => {
        for (const key of keys) {
          const value = this.fieldValues[key];
          if (value === undefined || value === null) continue;
          const text = String(value).trim();
          if (text) return text;
        }
        return null;
      };

      const firstName = firstNonEmpty("first_name", "firstname");
      const lastName = firstNonEmpty("last_name", "surname");
      let customerName =
        firstNonEmpty(
          "customer_name",
          "name",
          "full_name",
        ) || null;
      if (!customerName && (firstName || lastName)) {
        customerName = [firstName, lastName].filter(Boolean).join(" ").trim();
      }

      const phoneNumber =
        firstNonEmpty("customer_phone", "phone", "phone_number", "mobile") ||
        null;
      const whatsappNumber =
        firstNonEmpty("whatsapp", "whatsapp_number", "whatsapp_phone") || null;

      // Require contact before capture (spec: partial forms with contact only)
      if (!customerName || (!phoneNumber && !whatsappNumber)) {
        log("Skipping abandoned cart — contact details incomplete");
        return;
      }

      this.abandonedCartSent = true;

      const selectedProductsArray = getSelectedOrderItems(this);

      const fieldValues = { ...this.fieldValues };
      if (this.selectedOfferTitle) {
        fieldValues.offer_name = this.selectedOfferTitle;
      }

      log("Abandoned cart event:", {
        customerName,
        phoneNumber,
        whatsappNumber,
        selectedProductsArray,
      });

      if (!this.formToken) {
        error("Cannot send abandoned cart — missing form token");
        return;
      }

      fetch(
        `${CONFIG.API_BASE_URL}/public/numbatrak/forms/${encodeURIComponent(this.formToken)}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fieldValues,
            items: [],
            offerName: this.selectedOfferTitle || null,
            source: "embed",
            pageUrl: window.location.href,
          }),
        },
      ).catch((err) => {
        this.abandonedCartSent = false;
        error("Failed to send abandoned cart event:", err);
      });
    }

    updateField(name, value) {
      this.fieldValues[name] = value;
      this.resetAbandonedCartTimer();
    }

    updateProductQuantity(productId, quantity) {
      if (!productId || typeof productId !== "string" || !UUID_REGEX.test(productId)) {
        error("Invalid product ID:", productId);
        return;
      }
      if (quantity > 0) {
        this.selectedLineItems = [{ product_id: productId, quantity }];
      } else {
        this.selectedLineItems = [];
      }
      this.resetAbandonedCartTimer();
    }

    selectRadioOption(fieldName, optionValue, products, offerTitle, optionOfferId) {
      this.updateField(fieldName, optionValue);
      this.selectedOfferTitle = offerTitle || null;
      this.selectedLineItems = [];

      if (products && Array.isArray(products) && products.length > 0) {
        products.forEach((p) => {
          const item = lineToOrderItem(p, optionOfferId || null);
          if (item) this.selectedLineItems.push(item);
        });
        if (this.selectedLineItems.length === 0) {
          error("No valid product lines from radio option", products);
        }
      }
    }
  }

  // ============================================
  // API CLIENT
  // ============================================
  class ApiClient {
    async fetchFormSchema(formToken) {
      try {
        const response = await fetch(
          `${CONFIG.API_BASE_URL}/public/numbatrak/forms/${encodeURIComponent(formToken)}`,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Failed to fetch form: ${response.statusText}`);
        }
        if (!data || !data.form) {
          throw new Error("Form not found");
        }

        return {
          form: data.form,
          allProducts: data.products || [], // [{id, name}], already scoped to this form's schema
        };
      } catch (err) {
        error("Error fetching form schema:", err);
        throw err;
      }
    }

    async submitOrder(formToken, orderData) {
      try {
        const items = (orderData.items || []).map((item) => ({
          productId: item.product_id,
          quantity: item.quantity,
          ...(item.variant_id ? { variantId: item.variant_id } : {}),
          ...(item.offer_id ? { offerId: item.offer_id } : {}),
        }));

        const response = await fetch(
          `${CONFIG.API_BASE_URL}/public/numbatrak/forms/${encodeURIComponent(formToken)}/submit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fieldValues: orderData.field_values || {},
              items,
              offerName: orderData.offer_name || null,
              source: "wordpress",
              pageUrl: window.location.href,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to submit order");
        }

        return data;
      } catch (err) {
        error("Error submitting order:", err);
        throw err;
      }
    }
  }

  // ============================================
  // FORM RENDERER
  // ============================================
  class FormRenderer {
    constructor(container, state, apiClient) {
      this.container = container;
      this.state = state;
      this.apiClient = apiClient;
      this.allProducts = []; // Store all products for radio group lookups
      this.fieldContainers = new Map(); // field name -> DOM element
      this.onFieldChange = () => this.applyConditionalVisibility();
    }

    applyConditionalVisibility() {
      const fields = this.state.formSchema?.schema?.fields || [];
      fields.forEach((field) => {
        const el = this.fieldContainers.get(field.name);
        if (!el) return;
        const visible = isFieldVisible(field, this.state.fieldValues);
        el.style.display = visible ? "" : "none";
        el.querySelectorAll("input, textarea, select").forEach((input) => {
          if (!visible) {
            if (input.hasAttribute("required")) {
              input.dataset.wasRequired = "true";
              input.removeAttribute("required");
            }
          } else if (input.dataset.wasRequired === "true") {
            input.setAttribute("required", "");
            delete input.dataset.wasRequired;
          }
        });
      });
    }

    renderLoading() {
      this.container.innerHTML = "";
      const loading = createElement(
        "div",
        {
          className: "crm-form-loading",
          style: {
            padding: "2rem",
            textAlign: "center",
            color: "#666",
          },
        },
        [
          createElement("div", {
            textContent: "Loading form...",
          }),
        ],
      );
      this.container.appendChild(loading);
    }

    renderError(message) {
      this.container.innerHTML = "";
      const error = createElement(
        "div",
        {
          className: "crm-form-error",
          style: {
            padding: "1rem",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            color: "#c00",
          },
        },
        [
          createElement("p", {
            textContent: `Error: ${message}`,
          }),
        ],
      );
      this.container.appendChild(error);
    }

    renderForm(formData) {
      log("Rendering form with schema:", formData.form.schema);

      // Store all products for radio group product name lookups
      this.allProducts = formData.allProducts || [];

      this.container.innerHTML = "";
      this.container.className = "crm-form-container";

      const form = createElement("form", {
        className: "crm-form",
        id: "crm-form-element",
        style: {
          maxWidth: "600px",
          margin: "0 auto",
          padding: "2rem",
          backgroundColor: "#fff",
          borderRadius: "0.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        },
      });

      // Render form fields
      this.fieldContainers.clear();
      if (formData.form.schema && formData.form.schema.fields) {
        log("Rendering", formData.form.schema.fields.length, "fields");
        formData.form.schema.fields.forEach((field, index) => {
          log("Rendering field", index, ":", field.type, "-", field.label);
          const fieldEl = this.renderField(field);
          if (fieldEl) {
            fieldEl.dataset.fieldName = field.name;
            this.fieldContainers.set(field.name, fieldEl);
            form.appendChild(fieldEl);
          } else {
            log("Warning: field element was null for", field.name);
          }
        });
        this.applyConditionalVisibility();
      } else {
        log("Warning: No schema or fields found");
      }

      // Render submit button
      const submitButton = createElement(
        "button",
        {
          type: "submit",
          className: "crm-form-submit",
          style: {
            width: "100%",
            padding: "1rem",
            backgroundColor: "#111",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "1rem",
            fontWeight: "600",
            cursor: "pointer",
            marginTop: "1.5rem",
          },
        },
        [formData.form.schema?.submitButton?.text || "Submit Order"],
      );

      submitButton.addEventListener("mouseenter", function () {
        this.style.backgroundColor = "#333";
      });
      submitButton.addEventListener("mouseleave", function () {
        this.style.backgroundColor = "#111";
      });

      form.appendChild(submitButton);

      const poweredBy = createElement(
        "p",
        {
          className: "crm-form-powered-by",
          style: {
            marginTop: "0.75rem",
            textAlign: "center",
            fontSize: "12px",
            color: "#6b7280",
          },
        },
        ["Powered by Numbatrak"],
      );
      form.appendChild(poweredBy);

      // Handle form submission
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSubmit();
      });

      this.container.appendChild(form);
      log("Form rendering complete");
    }

    renderField(field) {
      if (field.type === "order-bump") {
        return this.renderOrderBump(field);
      }

      const fieldContainer = createElement("div", {
        className: `crm-form-field crm-form-field-${field.type}`,
        style: {
          marginBottom: "1.5rem",
        },
      });
      fieldContainer.classList.add("crm-form-field");

      // For radio groups, we don't need a label element wrapping the input
      // The label is just text above the radio options
      if (field.type === "radio-group") {
        log("Processing radio-group field:", field.name, field);
        const labelDiv = createElement("div", {
          style: {
            display: "block",
            marginBottom: "0.75rem",
            fontWeight: "600",
            fontSize: "1rem",
            color: "#111",
          },
          textContent: field.label + (field.required ? " *" : ""),
        });
        fieldContainer.appendChild(labelDiv);

        const radioGroup = this.renderRadioGroup(field);
        log("Radio group element:", radioGroup);
        log("Radio group children count:", radioGroup.children.length);
        fieldContainer.appendChild(radioGroup);

        // Add error message container
        const errorMsg = createElement("div", {
          className: "crm-form-field-error",
          style: {
            display: "none",
            color: "#dc2626",
            fontSize: "0.875rem",
            marginTop: "0.5rem",
          },
        });
        fieldContainer.appendChild(errorMsg);

        return fieldContainer;
      }

      // For other field types, use label element
      const label = createElement(
        "label",
        {
          htmlFor: field.id,
          style: {
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "600",
            color: "#111",
          },
        },
        [field.label + (field.required ? " *" : "")],
      );
      fieldContainer.appendChild(label);

      let input;

      switch (field.type) {
        case "textarea":
          input = createElement("textarea", {
            id: field.id,
            name: field.name,
            required: field.required,
            placeholder: field.placeholder || "",
            rows: 4,
            className: "crm-form-input",
            style: {
              width: "100%",
              padding: "0.75rem",
              border: "2px solid #e5e7eb",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              fontFamily: "inherit",
            },
          });
          input.addEventListener("input", (e) => {
            this.state.updateField(field.name, e.target.value);
            this.onFieldChange();
          });
          break;

        case "select":
          input = createElement("select", {
            id: field.id,
            name: field.name,
            required: field.required,
            className: "crm-form-input",
            style: {
              width: "100%",
              padding: "0.75rem",
              border: "2px solid #e5e7eb",
              borderRadius: "0.5rem",
              fontSize: "1rem",
            },
          });
          if (field.options) {
            field.options.forEach((option) => {
              const optionEl = createElement("option", {
                value: option.value,
                textContent: option.label,
              });
              input.appendChild(optionEl);
            });
          }
          input.addEventListener("change", (e) => {
            this.state.updateField(field.name, e.target.value);
            this.onFieldChange();
          });
          break;

        case "email":
        case "phone":
        case "number":
        case "text":
        default:
          input = createElement("input", {
            type:
              field.type === "email"
                ? "email"
                : field.type === "phone"
                  ? "tel"
                  : field.type === "number"
                    ? "number"
                    : "text",
            id: field.id,
            name: field.name,
            required: field.required,
            placeholder: field.placeholder || "",
            className: "crm-form-input",
            style: {
              width: "100%",
              padding: "0.75rem",
              border: "2px solid #e5e7eb",
              borderRadius: "0.5rem",
              fontSize: "1rem",
            },
          });
          input.addEventListener("input", (e) => {
            this.state.updateField(field.name, e.target.value);
            this.onFieldChange();
          });
          break;
      }

      if (input) {
        fieldContainer.appendChild(input);
      }

      // Add error message container
      const errorMsg = createElement("div", {
        className: "crm-form-field-error",
        style: {
          display: "none",
          color: "#dc2626",
          fontSize: "0.875rem",
          marginTop: "0.25rem",
        },
      });
      fieldContainer.appendChild(errorMsg);

      return fieldContainer;
    }

    renderOrderBump(field) {
      const bump = field.orderBump;
      if (!bump) return null;

      const fieldContainer = createElement("div", {
        className: "crm-form-field crm-form-field-order-bump",
        style: { marginBottom: "1.5rem" },
      });

      const label = createElement("label", {
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "1rem",
          border: "2px solid #e5e7eb",
          borderRadius: "0.5rem",
          cursor: "pointer",
        },
      });

      const checkbox = createElement("input", {
        type: "checkbox",
        name: field.name,
        value: bump.value,
        style: { marginTop: "0.25rem", width: "1.25rem", height: "1.25rem" },
      });

      const textWrap = createElement("div", {}, [
        createElement("div", {
          textContent: bump.title || field.label,
          style: { fontWeight: "600", color: "#111" },
        }),
        createElement("div", {
          textContent: bump.price ? `₦${Number(bump.price).toLocaleString()}` : "",
          style: { fontSize: "0.875rem", color: "#666", marginTop: "0.25rem" },
        }),
      ]);

      checkbox.addEventListener("change", (e) => {
        this.state.updateField(field.name, e.target.checked ? bump.value : "");
        this.state.orderBumpLineItems = [];
        if (e.target.checked && bump.products?.length) {
          bump.products.forEach((p) => {
            const item = lineToOrderItem(p, bump.offer_id || null);
            if (item) this.state.orderBumpLineItems.push(item);
          });
        }
        this.onFieldChange();
      });

      label.appendChild(checkbox);
      label.appendChild(textWrap);
      fieldContainer.appendChild(label);
      return fieldContainer;
    }

    renderRadioGroup(field) {
      log(
        "Rendering radio group:",
        field.name,
        "with",
        field.radioOptions?.length || 0,
        "options",
      );
      log("Field data:", field);
      log("Available products:", this.allProducts);

      const radioGroupContainer = createElement("div", {
        className: "crm-form-radio-group",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        },
      });

      if (!field.radioOptions || field.radioOptions.length === 0) {
        log("No radio options found for field:", field.name);
        const emptyMessage = createElement("div", {
          textContent: "No options available",
          style: {
            padding: "1rem",
            color: "#999",
            fontStyle: "italic",
          },
        });
        radioGroupContainer.appendChild(emptyMessage);
        return radioGroupContainer;
      }

      field.radioOptions.forEach((option, index) => {
        const optionContainer = createElement("label", {
          className: "crm-form-radio-option",
          style: {
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "1rem",
            border: "2px solid #e5e7eb",
            borderRadius: "0.5rem",
            cursor: "pointer",
            backgroundColor: "#fff",
            width: "100%",
            boxSizing: "border-box",
          },
        });

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = field.name;
        radio.value = option.value;
        radio.id = `${field.id}_${option.id}`;
        if (field.required) {
          radio.required = true;
        }
        // Ensure radio button is visible
        radio.style.marginTop = "0.25rem";
        radio.style.width = "1.25rem";
        radio.style.height = "1.25rem";
        radio.style.minWidth = "1.25rem";
        radio.style.minHeight = "1.25rem";
        radio.style.cursor = "pointer";
        radio.style.accentColor = "#3b82f6";
        radio.style.flexShrink = "0";
        radio.style.display = "inline-block";
        radio.style.visibility = "visible";
        radio.style.position = "relative";

        radio.setAttribute("aria-label", option.title || `Option ${index + 1}`);

        radio.addEventListener("change", (e) => {
          if (e.target.checked) {
            log("Radio option selected:", {
              fieldName: field.name,
              optionValue: option.value,
              optionTitle: option.title,
              products: option.products,
              productsLength: option.products?.length || 0,
            });

            // Validate that the option has products
            if (!option.products || option.products.length === 0) {
              error(
                "WARNING: Radio option selected has no products attached:",
                {
                  optionTitle: option.title,
                  optionValue: option.value,
                },
              );
            }

            // Update field value
            this.state.selectRadioOption(
              field.name,
              option.value,
              option.products || [],
              option.title,
              option.offer_id || null,
            );
            this.onFieldChange();

            // Update UI - highlight selected option
            const allOptions = radioGroupContainer.querySelectorAll(
              ".crm-form-radio-option",
            );
            allOptions.forEach((opt) => {
              opt.style.borderColor = "#e5e7eb";
              opt.style.backgroundColor = "#fff";
            });
            optionContainer.style.borderColor = "#111";
            optionContainer.style.backgroundColor = "#f9fafb";
          }
        });

        const contentContainer = createElement("div", {
          style: {
            flex: "1",
            minWidth: "0",
          },
        });

        const titleEl = createElement("div", {
          className: "crm-form-radio-title",
          style: {
            fontWeight: "500",
            color: "#111",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          },
        });

        const titleText = createElement("span", {
          textContent: option.title,
        });
        titleEl.appendChild(titleText);

        // Display price if available
        if (option.price && option.price > 0) {
          const priceEl = createElement("span", {
            textContent: `₦${option.price.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            style: {
              fontWeight: "600",
              color: "#4f46e5",
              fontSize: "0.95em",
            },
          });
          titleEl.appendChild(priceEl);
        }

        contentContainer.appendChild(titleEl);

        optionContainer.appendChild(radio);
        optionContainer.appendChild(contentContainer);
        radioGroupContainer.appendChild(optionContainer);

        log("Created radio button:", {
          id: radio.id,
          name: radio.name,
          value: radio.value,
          type: radio.type,
          checked: radio.checked,
        });
      });

      log("Radio group container HTML:", radioGroupContainer.outerHTML);
      return radioGroupContainer;
    }

    async handleSubmit() {
      if (this.state.isSubmitting) return;

      const formEl = document.getElementById("crm-form-element");
      if (!formEl) return;

      // Validate required fields
      const requiredFields = formEl.querySelectorAll("[required]");
      let isValid = true;
      const processedRadioGroups = new Set();

      requiredFields.forEach((field) => {
        const fieldContainer = field.closest(".crm-form-field");
        if (fieldContainer && fieldContainer.style.display === "none") {
          return;
        }
        const errorMsg = fieldContainer?.querySelector(".crm-form-field-error");

        if (field.type === "radio") {
          // Only process each radio group once
          if (processedRadioGroups.has(field.name)) {
            return;
          }
          processedRadioGroups.add(field.name);

          // Check if any radio in the group is checked
          const radioGroup = formEl.querySelectorAll(`[name="${field.name}"]`);
          const isChecked = Array.from(radioGroup).some((r) => r.checked);

          if (!isChecked) {
            isValid = false;
            if (errorMsg) {
              errorMsg.textContent = "Please select an option";
              errorMsg.style.display = "block";
            }
          } else {
            if (errorMsg) {
              errorMsg.style.display = "none";
            }
          }
        } else if (!field.value || field.value.trim() === "") {
          isValid = false;
          field.style.borderColor = "#dc2626";
          if (errorMsg) {
            errorMsg.textContent = "This field is required";
            errorMsg.style.display = "block";
          }
        } else if (
          field.type === "tel" &&
          !isValidNigerianPhone(field.value)
        ) {
          isValid = false;
          field.style.borderColor = "#dc2626";
          if (errorMsg) {
            errorMsg.textContent =
              "Enter a valid Nigerian phone number (e.g. +2348012345678)";
            errorMsg.style.display = "block";
          }
        } else {
          field.style.borderColor = "#e5e7eb";
          if (errorMsg) {
            errorMsg.style.display = "none";
          }
        }
      });

      // Validate at least one product selected (from radio groups)
      if (this.state.selectedLineItems.length === 0) {
        isValid = false;
        const errorMsg =
          "Please select a package option. Make sure the package option has products attached.";
        alert(errorMsg);
        error("Form validation error:", errorMsg);
        log("Current selectedLineItems:", this.state.selectedLineItems);
      }

      if (!isValid) return;

      this.state.isSubmitting = true;
      this.state.formSubmitted = true;

      // Clear abandoned cart timer
      if (this.state.abandonedCartTimer) {
        clearTimeout(this.state.abandonedCartTimer);
      }

      const submitButton = formEl.querySelector(".crm-form-submit");
      const originalText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent =
        this.state.formSchema?.schema?.submitButton?.loadingText ||
        "Submitting...";

      try {
        // Get customer name from form
        const customerNameField =
          formEl.querySelector('[name="customer_name"]') ||
          formEl.querySelector('input[type="text"]');
        const customerName = customerNameField
          ? customerNameField.value
          : "Customer";

        // Get phone from form
        const phoneField = formEl.querySelector('input[type="tel"]');
        const customerPhone = phoneField ? phoneField.value : null;

        // Collect all field values
        const fieldValues = {};
        formEl
          .querySelectorAll('input:not([type="submit"]), textarea, select')
          .forEach((field) => {
            if (field.name && field.value && field.type !== "radio") {
              fieldValues[field.name] = field.value;
            } else if (field.type === "radio" && field.checked) {
              fieldValues[field.name] = field.value;
            }
          });

        const items = getSelectedOrderItems(this.state);

        log("Submitting order:", {
          customerName,
          customerPhone,
          fieldValues,
          items,
          itemsCount: items.length,
          selectedLineItems: this.state.selectedLineItems,
        });
        
        // Final validation before sending
        if (items.length === 0) {
          const errorMsg = "No valid products to submit. Please check that radio options have valid product IDs attached.";
          alert(errorMsg);
          error("Form submission error:", errorMsg);
          submitButton.disabled = false;
          submitButton.textContent = originalText;
          this.state.isSubmitting = false;
          return;
        }

        // Validate that we have products before submitting
        if (items.length === 0) {
          const errorMsg =
            "No products selected. Please select a package option that includes products.";
          alert(errorMsg);
          error("Form submission error:", errorMsg);
          submitButton.disabled = false;
          submitButton.textContent = originalText;
          this.state.isSubmitting = false;
          return;
        }

        if (this.state.selectedOfferTitle) {
          fieldValues.offer_name = this.state.selectedOfferTitle;
        }

        // Submit order
        const result = await this.apiClient.submitOrder(this.state.formToken, {
          customer_name: customerName,
          customer_phone: customerPhone,
          field_values: fieldValues,
          items: items,
          offer_name: this.state.selectedOfferTitle || fieldValues.offer_name || null,
        });

        // Show success message
        this.renderSuccess(result);
      } catch (err) {
        error("Error submitting form:", err);
        submitButton.disabled = false;
        submitButton.textContent = originalText;
        this.state.isSubmitting = false;
        this.state.formSubmitted = false;

        alert(`Error: ${err.message}`);
      }
    }

    renderSuccess(result) {
      const confirmation =
        result.confirmation ||
        this.state.formSchema?.schema?.confirmation || {
          type: "message",
          message: "Thank you for your order. We'll be in touch soon.",
        };

      const fieldValues = { ...this.state.fieldValues };
      if (confirmation.type === "redirect" && confirmation.redirectUrl) {
        const url = interpolateTemplate(confirmation.redirectUrl, fieldValues);
        window.location.href = url;
        return;
      }

      const message =
        interpolateTemplate(
          confirmation.message ||
            "Thank you for your order. We'll be in touch soon.",
          fieldValues,
        ) || "Thank you for your order. We'll be in touch soon.";

      this.container.innerHTML = "";
      const success = createElement(
        "div",
        {
          className: "crm-form-success",
          style: {
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#f0fdf4",
            border: "2px solid #86efac",
            borderRadius: "0.5rem",
          },
        },
        [
          createElement("h2", {
            textContent: "✓ Order Submitted Successfully!",
            style: {
              color: "#166534",
              marginBottom: "1rem",
            },
          }),
          createElement("p", {
            textContent: message,
            style: {
              color: "#166534",
              marginBottom: "0.5rem",
            },
          }),
          createElement("p", {
            textContent: `Order ID: ${result.form_response?.id || result.order?.id || "N/A"}`,
            style: {
              color: "#166534",
              fontSize: "0.875rem",
            },
          }),
        ],
      );
      this.container.appendChild(success);
    }
  }

  // ============================================
  // MAIN INITIALIZATION
  // ============================================
  function init() {
    // Find all form containers
    const containers = document.querySelectorAll(
      '[id="crm-form"], [data-form-token]',
    );

    if (containers.length === 0) {
      log("No CRM form containers found");
      return;
    }

    containers.forEach((container) => {
      const formToken =
        container.getAttribute("data-form-token") ||
        container.getAttribute("id")?.replace("crm-form-", "");

      if (!formToken) {
        error("Form container missing data-form-token attribute");
        return;
      }

      // Initialize state and API client
      const state = new FormState();
      state.formToken = formToken;

      const apiClient = new ApiClient();
      const renderer = new FormRenderer(container, state, apiClient);

      // Show loading state
      renderer.renderLoading();

      // Fetch and render form
      apiClient
        .fetchFormSchema(formToken)
        .then((formData) => {
          state.formSchema = formData.form;
          // Store products in state if needed (for backward compatibility)
          if (formData.products) {
            state.products = formData.products;
          }
          renderer.renderForm(formData);
          log("Form rendered successfully", formData);
        })
        .catch((err) => {
          error("Failed to load form:", err);
          renderer.renderError(err.message || "Failed to load form");
        });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose global API if needed
  window.CRMFormSDK = {
    init,
    CONFIG,
    version: SDK_VERSION,
    buildDate: SDK_BUILD_DATE,
  };

  // Log initialization
  console.log(
    "%c[CRM Form SDK]",
    "color: #3b82f6; font-weight: bold;",
    "SDK initialized and ready. Version:",
    SDK_VERSION,
  );
})(window, document);
