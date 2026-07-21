// Supabase Edge Function: Create Order from WordPress Form
// This function can be called from WordPress to create orders securely

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OrderData {
  customer_name: string;
  phone_number?: string | null;
  location?: string | null;
  order_date: string;
  order_month?: string | null;
  order_year?: string | null;
  product_name?: string | null;
  mail_quan?: number | null;
  agent_quan?: number | null;
  quantity?: number | null;
  product2?: string | null;
  mail_quan2?: number | null;
  agent_quan2?: number | null;
  quantity2?: number | null;
  cost_price?: number | null;
  delivery_fee?: number | null;
  sales_price?: number | null;
  profit?: number | null;
  order_status?: string | null;
  delivery_date?: string | null;
  delivery_month?: string | null;
  delivery_year?: string | null;
  confirmed_delivery?: boolean;
  agent_name?: string | null;
  note?: string | null;
  subject?: string | null;
  organization_id?: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Supabase client
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

    // Parse request body
    const body = await req.json();
    const { orderData, eventType } = body;

    if (!orderData) {
      return new Response(
        JSON.stringify({ error: "Missing orderData" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    if (!orderData.customer_name || !orderData.order_date) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: customer_name, order_date" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate organization_id if provided
    if (orderData.organization_id) {
      // Verify organization exists
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", orderData.organization_id)
        .single();

      if (orgError || !org) {
        return new Response(
          JSON.stringify({ error: "Invalid organization_id" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Set defaults
    const finalOrderData: OrderData = {
      ...orderData,
      order_status: orderData.order_status || "Pending",
      confirmed_delivery: orderData.confirmed_delivery ?? false,
      // organization_id is required for RLS, but we allow it to be passed from webhook
      // If not provided, the webhook should include it in the payload
    };

    // Insert order
    const { data, error } = await supabase
      .from("orders")
      .insert([finalOrderData])
      .select()
      .single();

    if (error) {
      console.error("Error inserting order:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: data,
        eventType: eventType || "order_created",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});



