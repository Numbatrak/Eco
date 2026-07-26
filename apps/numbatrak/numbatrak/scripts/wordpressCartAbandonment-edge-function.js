/**
 * WordPress Fluent Form Cart Abandonment & Order Submission Script
 * 
 * This version uses Supabase Edge Functions (more secure)
 * 
 * Setup:
 * 1. Deploy the Edge Function: supabase/functions/create-order
 * 2. Replace SUPABASE_URL and EDGE_FUNCTION_URL with your values
 * 3. Add this script to your WordPress site
 */

(function () {
  // ============================================
  // CONFIGURATION
  // ============================================
  const SUPABASE_URL = "YOUR_SUPABASE_URL"; // e.g., "https://xxxxx.supabase.co"
  const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/create-order`;
  const INACTIVITY_TIMEOUT = 30000; // 30 seconds
  const DEBUG = true;

  // Optional: Keep your n8n webhooks for backup
  const N8N_ABANDON_URL = "https://saussuritic-ola-ineligibly.ngrok-free.dev/webhook-test/cart-abandonment";
  const N8N_SUBMIT_URL = "https://saussuritic-ola-ineligibly.ngrok-free.dev/webhook-test/submit-form";

  // ============================================
  // UTILITIES
  // ============================================
  function log(...args) {
    if (DEBUG) console.log("[CartAbandonment]", ...args);
  }

  function parseProduct(optionText) {
    if (!optionText) return {};

    const [left, pricePart] = optionText.split(" = ₦");
    const price = pricePart ? parseInt(pricePart.replace(/[^0-9]/g, "")) : null;

    const quantityMatch = left.match(/^\s*(\d+)/);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;

    let productName = left.replace(/^\s*\d+\s*/, "").trim();
    productName = productName.split("+")[0].trim();

    return {
      productName: productName || null,
      quantity: quantity,
      mail_quantity: quantity,
      agent_quantity: null,
      price: price,
    };
  }

  function formatDateParts() {
    const now = new Date();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    return {
      order_date: now.toISOString().split("T")[0], // ISO format
      order_month: monthNames[now.getMonth()],
      order_year: now.getFullYear().toString(),
    };
  }

  // ============================================
  // STATE
  // ============================================
  let form = null;
  let timeout = null;
  let formSubmitted = false;

  // ============================================
  // FORM DATA COLLECTION
  // ============================================
  const collectFormData = () => {
    if (!form) return {};

    const data = {};
    const getInputValue = (name) => {
      const el = form.querySelector(`[name="${name}"]`);
      return el ? el.value.trim() : "";
    };

    data.first_name = getInputValue("names[first_name]");
    data.last_name = getInputValue("names[last_name]");
    data.phone_number = getInputValue("numeric_field");

    // WhatsApp Formatting
    let rawWhatsApp = getInputValue("numeric_field_1").replace(/\D/g, "");
    if (rawWhatsApp.startsWith("0")) rawWhatsApp = rawWhatsApp.substring(1);
    data.whatsapp_number = rawWhatsApp ? "234" + rawWhatsApp : "";

    data.delivery_address = getInputValue("input_text");
    data.state = getInputValue("input_text_1");

    const getRadioValue = (name) => {
      const checked = form.querySelector(`input[name="${name}"]:checked`);
      return checked ? checked.value : "";
    };

    data.selected_package = getRadioValue("input_radio");
    data.selected_items = getRadioValue("input_radio_1");

    return data;
  };

  const countFilledFields = () =>
    Object.values(collectFormData()).filter((v) => v).length;

  // ============================================
  // SUPABASE EDGE FUNCTION CALLS
  // ============================================
  async function sendToSupabaseEdgeFunction(orderData, eventType = "order_created") {
    if (!SUPABASE_URL || SUPABASE_URL === "YOUR_SUPABASE_URL") {
      log("⚠️ Supabase URL not configured");
      return false;
    }

    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderData,
          eventType,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      log("✅ Order sent to Supabase successfully:", result);
      return true;
    } catch (error) {
      console.error("❌ Error sending to Supabase Edge Function:", error);
      return false;
    }
  }

  async function sendAbandonedCartToSupabase(formData, filledCount) {
    if (filledCount === 0) return;

    const p1 = parseProduct(formData.selected_package);
    const p2 = parseProduct(formData.selected_items);
    const dateParts = formatDateParts();

    const orderData = {
      customer_name: `${formData.first_name || ""} ${formData.last_name || ""}`.trim() || "Unknown Customer",
      phone_number: formData.phone_number || formData.whatsapp_number || null,
      location: formData.delivery_address
        ? `${formData.delivery_address}${formData.state ? ", " + formData.state : ""}`
        : null,
      order_date: dateParts.order_date,
      order_month: dateParts.order_month,
      order_year: dateParts.order_year,
      product_name: p1.productName,
      mail_quan: p1.mail_quantity,
      agent_quan: p1.agent_quantity,
      quantity: p1.quantity,
      product2: p2.productName,
      mail_quan2: p2.mail_quantity,
      agent_quan2: p2.agent_quantity,
      quantity2: p2.quantity,
      cost_price: null,
      delivery_fee: null,
      sales_price: p1.price,
      profit: null,
      order_status: "Pending",
      delivery_date: null,
      delivery_month: null,
      delivery_year: null,
      confirmed_delivery: false,
      agent_name: null,
      note: `Abandoned cart from ${window.location.href}. Filled ${filledCount} fields.`,
      subject: "Abandoned Cart",
    };

    await sendToSupabaseEdgeFunction(orderData, "cart_abandonment");
  }

  async function sendFormSubmissionToSupabase(formData) {
    const p1 = parseProduct(formData.selected_package);
    const p2 = parseProduct(formData.selected_items);
    const dateParts = formatDateParts();

    const orderData = {
      customer_name: `${formData.first_name || ""} ${formData.last_name || ""}`.trim() || "Unknown Customer",
      phone_number: formData.phone_number || formData.whatsapp_number || null,
      location: formData.delivery_address
        ? `${formData.delivery_address}${formData.state ? ", " + formData.state : ""}`
        : null,
      order_date: dateParts.order_date,
      order_month: dateParts.order_month,
      order_year: dateParts.order_year,
      product_name: p1.productName,
      mail_quan: p1.mail_quantity,
      agent_quan: p1.agent_quantity,
      quantity: p1.quantity,
      product2: p2.productName,
      mail_quan2: p2.mail_quantity,
      agent_quan2: p2.agent_quantity,
      quantity2: p2.quantity,
      cost_price: null,
      delivery_fee: null,
      sales_price: p1.price,
      profit: null,
      order_status: "Pending",
      delivery_date: null,
      delivery_month: null,
      delivery_year: null,
      confirmed_delivery: false,
      agent_name: null,
      note: `Form submitted from ${window.location.href}`,
      subject: "New Order",
    };

    return await sendToSupabaseEdgeFunction(orderData, "form_submitted");
  }

  // ============================================
  // ABANDONMENT TRACKING
  // ============================================
  const sendAbandonmentData = async () => {
    if (formSubmitted) return;

    const filledCount = countFilledFields();
    if (filledCount === 0) {
      log("⚠️ No fields filled, skipping webhook.");
      return;
    }

    const formData = collectFormData();

    // Send to Supabase
    await sendAbandonedCartToSupabase(formData, filledCount);

    // Also send to n8n if configured (optional backup)
    if (N8N_ABANDON_URL) {
      try {
        await fetch(N8N_ABANDON_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page: window.location.href,
            timestamp: new Date().toISOString(),
            event: "cart_abandonment_detected",
            filledCount,
            formData,
          }),
        });
        log("📤 Abandonment data sent to n8n:", formData);
      } catch (error) {
        console.error("❌ Error sending to n8n:", error);
      }
    }
  };

  const scheduleTrigger = () => {
    clearTimeout(timeout);
    timeout = setTimeout(sendAbandonmentData, INACTIVITY_TIMEOUT);
  };

  // ============================================
  // FORM SUBMISSION
  // ============================================
  const handleFormSubmit = async (e) => {
    // Prevent default submission temporarily
    e.preventDefault();
    e.stopPropagation();

    formSubmitted = true;
    clearTimeout(timeout);
    log("✅ Form submitted - sending to Supabase.");

    const formData = collectFormData();

    // Send to Supabase first
    const supabaseSuccess = await sendFormSubmissionToSupabase(formData);

    if (supabaseSuccess) {
      log("✅ Order saved to Supabase successfully");
    } else {
      log("⚠️ Failed to save to Supabase, but continuing with form submission");
    }

    // Also send to n8n if configured (optional backup)
    if (N8N_SUBMIT_URL) {
      try {
        const p1 = parseProduct(formData.selected_package);
        const p2 = parseProduct(formData.selected_items);
        const dateParts = formatDateParts();

        await fetch(N8N_SUBMIT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page: window.location.href,
            timestamp: new Date().toISOString(),
            event: "form_submitted",
            Customer_Name: formData.first_name + " " + formData.last_name,
            Phone_number: formData.phone_number,
            Location: formData.delivery_address + ", " + formData.state,
            ...dateParts,
            Product_Name: p1.productName,
            Mail_Quan: p1.mail_quantity,
            Agent_Quan: p1.agent_quantity,
            Quantity: p1.quantity,
            Sales_Price: p1.price,
            Product2: p2.productName,
            Mail_Quan2: p2.mail_quantity,
            Agent_Quan2: p2.agent_quantity,
            Quantity2: p2.quantity,
            Sales_Price2: p2.price,
          }),
        });
        log("📤 Submission data sent to n8n");
      } catch (error) {
        console.error("❌ Error sending to n8n:", error);
      }
    }

    // Re-submit the form to let Fluent Form handle the redirect
    // Use a small delay to ensure Supabase request completes
    setTimeout(() => {
      // Remove our event listener temporarily
      form.removeEventListener("submit", handleFormSubmit);
      // Trigger native form submission
      form.submit();
    }, 500);
  };

  // ============================================
  // INITIALIZATION
  // ============================================
  const waitForForm = () => {
    form = document.querySelector(".fluentform");
    if (form) {
      log("✅ Fluent Form found:", form);
      initTracking();
    } else {
      log("⏳ Waiting for Fluent Form...");
      setTimeout(waitForForm, 500);
    }
  };

  const initTracking = () => {
    // Track input changes for abandonment
    form.addEventListener("input", scheduleTrigger);
    form.addEventListener("change", scheduleTrigger);

    // Handle form submission
    form.addEventListener("submit", handleFormSubmit);

    log("👂 Cart abandonment tracking initialized.");
    log("📝 Form submission tracking initialized.");
  };

  // ============================================
  // START
  // ============================================
  waitForForm();
})();






