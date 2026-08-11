CREATE TYPE "public"."affiliate_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."announcement_audience" AS ENUM('all', 'tier', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."exit_survey_type" AS ENUM('cancel', 'delete');--> statement-breakpoint
CREATE TYPE "public"."expense_parent_category" AS ENUM('advertising', 'marketing', 'building', 'operational');--> statement-breakpoint
CREATE TYPE "public"."platform_credit_type" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."platform_subscription_status" AS ENUM('trial', 'active', 'past_due', 'locked', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."platform_transaction_status" AS ENUM('success', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."platform_transaction_type" AS ENUM('subscription', 'credit_purchase');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_account_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."numbatrak_product_offer_type" AS ENUM('single', 'quantity_tier', 'bundle', 'buy_x_get_y');--> statement-breakpoint
CREATE TYPE "public"."numbatrak_product_type" AS ENUM('NORMAL', 'INCENTIVE');--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"recorded_by_admin_id" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"code" text NOT NULL,
	"commission_rate_bps" integer DEFAULT 1000 NOT NULL,
	"status" "affiliate_status" DEFAULT 'active' NOT NULL,
	"created_by_admin_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience" "announcement_audience" NOT NULL,
	"audience_value" text,
	"send_email" boolean DEFAULT false NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"created_by_admin_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_type" "platform_credit_type" NOT NULL,
	"name" text NOT NULL,
	"units" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exit_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"exit_type" "exit_survey_type" NOT NULL,
	"reason_category" text NOT NULL,
	"detail" text,
	"plan_tier_at_exit" text,
	"tenure_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_sub_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_category" "expense_parent_category" NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_category" "expense_parent_category" NOT NULL,
	"sub_category_id" uuid,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_by_admin_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_reference" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"credit_type" "platform_credit_type" NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"admin_id" text,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_credit_pricing" (
	"credit_type" "platform_credit_type" PRIMARY KEY NOT NULL,
	"sell_price_cents" integer DEFAULT 0 NOT NULL,
	"provider_cost_cents" integer DEFAULT 0 NOT NULL,
	"updated_by_admin_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" date NOT NULL,
	"mrr_cents" integer DEFAULT 0 NOT NULL,
	"arr_cents" integer DEFAULT 0 NOT NULL,
	"active_subscriptions" integer DEFAULT 0 NOT NULL,
	"trial_accounts" integer DEFAULT 0 NOT NULL,
	"active_by_tier" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subscription_revenue_cents" integer DEFAULT 0 NOT NULL,
	"credit_revenue_cents" integer DEFAULT 0 NOT NULL,
	"new_signups" integer DEFAULT 0 NOT NULL,
	"trial_starts" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"churned_count" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"price_monthly_cents" integer NOT NULL,
	"price_annually_cents" integer NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "platform_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "platform_subscription_status" DEFAULT 'trial' NOT NULL,
	"billing_interval" text DEFAULT 'monthly' NOT NULL,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"grace_period_ends_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"paystack_subscription_code" text,
	"paystack_customer_code" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"type" "platform_transaction_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"vat_cents" integer DEFAULT 0 NOT NULL,
	"paystack_reference" text NOT NULL,
	"status" "platform_transaction_status" NOT NULL,
	"metadata" jsonb,
	"refunded_at" timestamp with time zone,
	"refund_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_whatsapp_settings" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"waba_id" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"phone_number" text,
	"display_name" text,
	"access_token_encrypted" text NOT NULL,
	"business_portfolio_id" text,
	"account_status" "whatsapp_account_status" DEFAULT 'pending' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_activity_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"activity_date" date NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_agents" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "numbatrak_agents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"locations" text,
	"state" text,
	"active" boolean DEFAULT true NOT NULL,
	"is_warehouse" boolean DEFAULT false NOT NULL,
	"can_deliver" boolean DEFAULT true NOT NULL,
	"contact_person" text,
	"contact_phone" text,
	"contact_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_csr_name_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"match_pattern" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_product_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"offer_type" "numbatrak_product_offer_type" DEFAULT 'single' NOT NULL,
	"label" text NOT NULL,
	"min_quantity" integer DEFAULT 1 NOT NULL,
	"free_quantity" integer DEFAULT 0 NOT NULL,
	"bundle_items" jsonb,
	"price" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_product_offers_quantities_nonneg_chk" CHECK ("numbatrak_product_offers"."min_quantity" > 0 AND "numbatrak_product_offers"."free_quantity" >= 0),
	CONSTRAINT "numbatrak_product_offers_prices_nonneg_chk" CHECK ("numbatrak_product_offers"."price" >= 0 AND "numbatrak_product_offers"."unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "numbatrak_product_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"cost_price" numeric(10, 2) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "numbatrak_product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"base_price" numeric(12, 2) NOT NULL,
	"cost_price" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_product_variants_prices_nonneg_chk" CHECK ("numbatrak_product_variants"."base_price" >= 0 AND "numbatrak_product_variants"."cost_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "numbatrak_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"type" "numbatrak_product_type" DEFAULT 'NORMAL' NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"cost_price" numeric(10, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"category" text,
	"sub_brand" text,
	"allows_variants" boolean DEFAULT false NOT NULL,
	"allows_bundles" boolean DEFAULT false NOT NULL,
	"allows_discounts" boolean DEFAULT false NOT NULL,
	"low_stock_threshold" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "numbatrak_form_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"min_quantity" integer DEFAULT 1,
	"max_quantity" integer,
	"required" boolean DEFAULT false,
	"pricing_mode" text DEFAULT 'fixed' NOT NULL,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "numbatrak_form_products_pricing_mode_chk" CHECK ("numbatrak_form_products"."pricing_mode" IN ('fixed', 'selectable'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"form_token" text NOT NULL,
	"schema" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"site_url" text,
	"field_mapping" jsonb DEFAULT '{}'::jsonb,
	"sub_brand" text,
	"funnel_name" text
);
--> statement-breakpoint
CREATE TABLE "numbatrak_customer_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_at_submission" numeric(14, 2) DEFAULT '0' NOT NULL,
	"unit_cost_at_submission" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"profit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"variant_id" uuid,
	"offer_id" uuid,
	"quantity_paid" integer,
	"free_quantity" integer DEFAULT 0 NOT NULL,
	"true_unit_count" integer,
	"added_by_user_id" text,
	CONSTRAINT "numbatrak_customer_order_items_quantity_chk" CHECK ("numbatrak_customer_order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "numbatrak_customer_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"form_response_id" uuid,
	"form_id" uuid,
	"csr_id" text,
	"agent_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'form' NOT NULL,
	"customer_name" text,
	"phone_number" text,
	"state" text,
	"delivery_address" text,
	"order_revenue" numeric(14, 2),
	"order_cost" numeric(14, 2),
	"amount_paid" numeric(14, 2),
	"delivery_fee" numeric(14, 2),
	"profit" numeric(14, 2),
	"notes" text,
	"abandoned_cart_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"payment_method" text DEFAULT 'cod' NOT NULL,
	"wallet_status" text,
	"remittance_confirmed_at" timestamp with time zone,
	"remittance_confirmed_by" text,
	"released_at" timestamp with time zone,
	"released_by" text,
	"offer_name" text,
	"funnel_name" text,
	"sub_brand" text,
	"money_received_by" text DEFAULT 'agent_collected',
	CONSTRAINT "numbatrak_customer_orders_form_response_id_unique" UNIQUE("form_response_id"),
	CONSTRAINT "numbatrak_customer_orders_status_chk" CHECK ("numbatrak_customer_orders"."status" IN ('new', 'confirmed', 'packed', 'dispatched', 'delivered', 'failed', 'returned', 'lost', 'pending', 'completed', 'cancelled')),
	CONSTRAINT "numbatrak_customer_orders_source_chk" CHECK ("numbatrak_customer_orders"."source" IN ('form', 'manual', 'converted_from_cart')),
	CONSTRAINT "numbatrak_customer_orders_payment_method_chk" CHECK ("numbatrak_customer_orders"."payment_method" IN ('cod', 'online')),
	CONSTRAINT "numbatrak_customer_orders_wallet_status_chk" CHECK ("numbatrak_customer_orders"."wallet_status" IS NULL OR "numbatrak_customer_orders"."wallet_status" IN ('pending_remittance', 'collected', 'released')),
	CONSTRAINT "numbatrak_customer_orders_money_received_by_chk" CHECK ("numbatrak_customer_orders"."money_received_by" IN ('agent_collected', 'company_account', 'prepaid'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_form_response_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_response_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_at_submission" numeric(10, 2) NOT NULL,
	"unit_cost_at_submission" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"profit" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"variant_id" uuid,
	"offer_id" uuid,
	"quantity_paid" integer,
	"free_quantity" integer DEFAULT 0 NOT NULL,
	"true_unit_count" integer,
	CONSTRAINT "numbatrak_form_response_items_profit_chk" CHECK ("numbatrak_form_response_items"."profit" = "numbatrak_form_response_items"."total_price" - "numbatrak_form_response_items"."total_cost"),
	CONSTRAINT "numbatrak_form_response_items_total_cost_chk" CHECK ("numbatrak_form_response_items"."total_cost" = COALESCE("numbatrak_form_response_items"."true_unit_count", "numbatrak_form_response_items"."quantity") * "numbatrak_form_response_items"."unit_cost_at_submission"),
	CONSTRAINT "numbatrak_form_response_items_total_price_chk" CHECK ("numbatrak_form_response_items"."total_price" = COALESCE("numbatrak_form_response_items"."quantity_paid", "numbatrak_form_response_items"."quantity") * "numbatrak_form_response_items"."unit_price_at_submission")
);
--> statement-breakpoint
CREATE TABLE "numbatrak_form_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"form_id" uuid,
	"response_type" text DEFAULT 'order' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'wordpress' NOT NULL,
	"page_url" text,
	"field_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"selected_products" jsonb DEFAULT '[]'::jsonb,
	"phone_number" text,
	"package_name" text,
	"customer_name" text,
	"profit" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"converted_from_abandoned" boolean DEFAULT false,
	"converted_response_id" uuid,
	"raw_payload" jsonb DEFAULT '{}'::jsonb,
	"normalized_payload" jsonb DEFAULT '{}'::jsonb,
	"items" jsonb DEFAULT '[]'::jsonb,
	"package" text,
	"offer_name" text,
	"submitted_at" timestamp with time zone DEFAULT now(),
	"submission_status" text,
	"order_cost" numeric(12, 2),
	"order_revenue" numeric(12, 2),
	"order_profit" numeric(12, 2),
	"notes" text,
	"delivery_fee" numeric(12, 2),
	"amount_paid" numeric(12, 2),
	"agent_id" uuid,
	"csr_id" text,
	"payment_method" text DEFAULT 'cod' NOT NULL,
	"wallet_status" text,
	"remittance_confirmed_at" timestamp with time zone,
	"remittance_confirmed_by" text,
	"released_at" timestamp with time zone,
	"released_by" text,
	"funnel_name" text,
	"sub_brand" text,
	"money_received_by" text DEFAULT 'agent_collected',
	CONSTRAINT "numbatrak_form_responses_response_type_chk" CHECK ("numbatrak_form_responses"."response_type" IN ('order', 'abandoned_cart')),
	CONSTRAINT "numbatrak_form_responses_status_chk" CHECK ("numbatrak_form_responses"."status" IN ('new', 'confirmed', 'packed', 'dispatched', 'delivered', 'failed', 'returned', 'lost', 'pending', 'completed', 'cancelled', 'abandoned')),
	CONSTRAINT "numbatrak_form_responses_payment_method_chk" CHECK ("numbatrak_form_responses"."payment_method" IN ('cod', 'online')),
	CONSTRAINT "numbatrak_form_responses_wallet_status_chk" CHECK ("numbatrak_form_responses"."wallet_status" IS NULL OR "numbatrak_form_responses"."wallet_status" IN ('pending_remittance', 'collected', 'released')),
	CONSTRAINT "numbatrak_form_responses_money_received_by_chk" CHECK ("numbatrak_form_responses"."money_received_by" IN ('agent_collected', 'company_account', 'prepaid'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_order_inventory_consumption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"inventory_lot_id" uuid NOT NULL,
	"quantity_consumed" integer NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "numbatrak_order_inventory_consumption_qty_chk" CHECK ("numbatrak_order_inventory_consumption"."quantity_consumed" > 0)
);
--> statement-breakpoint
CREATE TABLE "numbatrak_inventory_legacy" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "numbatrak_inventory_legacy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"agent_id" bigint,
	"product_id" uuid NOT NULL,
	"total_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_inventory_legacy_total_quantity_chk" CHECK ("numbatrak_inventory_legacy"."total_quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "numbatrak_inventory_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_remaining" integer NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"variant_id" uuid,
	CONSTRAINT "numbatrak_inventory_lots_qty_remaining_chk" CHECK ("numbatrak_inventory_lots"."quantity_remaining" >= 0)
);
--> statement-breakpoint
CREATE TABLE "numbatrak_stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"movement_type" text NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"from_agent_id" bigint,
	"to_agent_id" bigint,
	"order_id" uuid,
	"waybill_batch_id" uuid,
	"legacy_delivery_id" bigint,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cost" numeric(14, 2) DEFAULT '0',
	"fee" numeric(14, 2) DEFAULT '0',
	"recorded_by_user_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "numbatrak_stock_movements_movement_type_chk" CHECK ("numbatrak_stock_movements"."movement_type" IN ('waybill_to_agent', 'deliver_to_customer', 'return_to_lagos', 'transfer', 'adjust', 'damaged', 'missing')),
	CONSTRAINT "numbatrak_stock_movements_agents_chk" CHECK (("numbatrak_stock_movements"."movement_type" = 'waybill_to_agent' AND "numbatrak_stock_movements"."to_agent_id" IS NOT NULL)
        OR ("numbatrak_stock_movements"."movement_type" = 'deliver_to_customer' AND "numbatrak_stock_movements"."from_agent_id" IS NOT NULL)
        OR ("numbatrak_stock_movements"."movement_type" = 'return_to_lagos' AND "numbatrak_stock_movements"."from_agent_id" IS NOT NULL)
        OR ("numbatrak_stock_movements"."movement_type" = 'transfer' AND "numbatrak_stock_movements"."from_agent_id" IS NOT NULL AND "numbatrak_stock_movements"."to_agent_id" IS NOT NULL)
        OR ("numbatrak_stock_movements"."movement_type" = 'adjust' AND ("numbatrak_stock_movements"."from_agent_id" IS NOT NULL OR "numbatrak_stock_movements"."to_agent_id" IS NOT NULL))
        OR ("numbatrak_stock_movements"."movement_type" IN ('damaged', 'missing') AND "numbatrak_stock_movements"."from_agent_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_deliveries" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "numbatrak_deliveries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"date" date NOT NULL,
	"csr" text,
	"agent_id" bigint,
	"status" text NOT NULL,
	"product_id" bigint,
	"product_uuid" uuid,
	"quantity" integer NOT NULL,
	"cost" numeric(14, 2) NOT NULL,
	"waybilling_fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sub_brand" text,
	"waybill_batch_id" uuid,
	CONSTRAINT "numbatrak_deliveries_status_chk" CHECK ("numbatrak_deliveries"."status" IN ('Waybilled', 'Delivered')),
	CONSTRAINT "numbatrak_deliveries_quantity_chk" CHECK ("numbatrak_deliveries"."quantity" > 0),
	CONSTRAINT "numbatrak_deliveries_cost_chk" CHECK ("numbatrak_deliveries"."cost" >= 0),
	CONSTRAINT "numbatrak_deliveries_waybilling_fee_chk" CHECK ("numbatrak_deliveries"."waybilling_fee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "numbatrak_wallet_remittance_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"agent_id" integer NOT NULL,
	"remittance_date" date NOT NULL,
	"total_delivered_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_delivery_fees" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_off_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"expected_remittance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"actual_amount" numeric(14, 2),
	"status" text DEFAULT 'standing' NOT NULL,
	"net_off_expense_id" uuid,
	"notes" text,
	"remitted_at" timestamp with time zone,
	"remitted_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_wallet_remittance_lines_status_chk" CHECK ("numbatrak_wallet_remittance_lines"."status" IN ('standing', 'remitted', 'short', 'net_owed'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_agent_expenses_legacy" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "numbatrak_agent_expenses_legacy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"agent_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_agent_expenses_legacy_amount_chk" CHECK ("numbatrak_agent_expenses_legacy"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "numbatrak_expense_subcategories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"parent_category" text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_expense_subcategories_parent_chk" CHECK ("numbatrak_expense_subcategories"."parent_category" IN ('operational', 'building', 'marketing', 'advertising')),
	CONSTRAINT "numbatrak_expense_subcategories_slug_nonempty_chk" CHECK (length(trim("numbatrak_expense_subcategories"."slug")) > 0 AND length(trim("numbatrak_expense_subcategories"."label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "numbatrak_unified_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"scope" text NOT NULL,
	"category" text NOT NULL,
	"subcategory" text DEFAULT '',
	"amount" numeric(14, 2) NOT NULL,
	"agent_id" bigint,
	"product_id" uuid,
	"order_id" uuid,
	"note" text,
	"occurred_at" date DEFAULT CURRENT_DATE NOT NULL,
	"created_by" text,
	"legacy_agent_expense_id" bigint,
	"legacy_general_expense_id" bigint,
	"created_at" timestamp with time zone DEFAULT now(),
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"offer_name" text,
	"platform" text,
	CONSTRAINT "numbatrak_unified_expenses_scope_chk" CHECK ("numbatrak_unified_expenses"."scope" IN ('org', 'agent')),
	CONSTRAINT "numbatrak_unified_expenses_org_category_chk" CHECK ("numbatrak_unified_expenses"."scope" <> 'org' OR "numbatrak_unified_expenses"."category" IN ('operational', 'building', 'marketing', 'advertising')),
	CONSTRAINT "numbatrak_unified_expenses_agent_category_chk" CHECK ("numbatrak_unified_expenses"."scope" <> 'agent' OR "numbatrak_unified_expenses"."category" = 'operational')
);
--> statement-breakpoint
CREATE TABLE "numbatrak_abandoned_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"form_id" uuid,
	"page_url" text,
	"filled_fields" jsonb,
	"field_values" jsonb,
	"selected_products" jsonb,
	"converted_to_order" boolean DEFAULT false,
	"converted_order_id" uuid,
	"abandoned_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"customer_name" text,
	"phone_number" text,
	"whatsapp_number" text,
	"delivery_address" text,
	"state" text,
	"location" text,
	"selected_package" text,
	"selected_items" text,
	"product_name" text,
	"mail_quan" integer,
	"agent_quan" integer,
	"quantity" integer,
	"product2" text,
	"mail_quan2" integer,
	"agent_quan2" integer,
	"quantity2" integer,
	"filled_fields_count" integer DEFAULT 0,
	"note" text,
	"subject" text,
	"order_date" date DEFAULT CURRENT_DATE NOT NULL,
	"order_month" text,
	"order_year" text,
	"cost_price" numeric(10, 2),
	"delivery_fee" numeric(10, 2),
	"profit" numeric(10, 2),
	"order_status" text DEFAULT 'Pending',
	"delivery_date" date,
	"delivery_month" text,
	"delivery_year" text,
	"confirmed_delivery" boolean DEFAULT false,
	"agent_name" text,
	"sales_price" numeric(10, 2),
	"funnel_name" text,
	"offer_name" text,
	"sub_brand" text
);
--> statement-breakpoint
CREATE TABLE "numbatrak_follow_ups" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "numbatrak_follow_ups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" text,
	"order_id" uuid,
	"abandoned_cart_id" uuid,
	"assigned_to" text,
	"status" text DEFAULT 'awaiting' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"started_at" timestamp with time zone,
	"first_contact_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"response_time_minutes" integer,
	"resolution_time_minutes" integer,
	"outcome" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_follow_ups_status_chk" CHECK ("numbatrak_follow_ups"."status" IN ('awaiting', 'followed_up', 'resolved', 'cancelled')),
	CONSTRAINT "numbatrak_follow_ups_priority_chk" CHECK ("numbatrak_follow_ups"."priority" IN ('low', 'medium', 'high', 'urgent')),
	CONSTRAINT "numbatrak_follow_ups_outcome_chk" CHECK ("numbatrak_follow_ups"."outcome" IS NULL OR "numbatrak_follow_ups"."outcome" IN ('converted', 'not_converted', 'not_interested', 'follow_up_needed', 'resolved', 'other'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_order_assignment_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"assignment_method" text DEFAULT 'round_robin' NOT NULL,
	"last_assigned_user_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "numbatrak_order_assignment_settings_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "numbatrak_order_assignment_settings_method_chk" CHECK ("numbatrak_order_assignment_settings"."assignment_method" IN ('round_robin', 'percentage'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_order_assignment_weights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "numbatrak_activities" (
	"id" bigint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "numbatrak_activities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text,
	"action_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" bigint,
	"description" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"primary_role" text NOT NULL,
	"extra_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phone" text,
	"bank_name" text,
	"bank_account_number" text,
	"bank_account_name" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_staff_primary_role_chk" CHECK ("numbatrak_staff"."primary_role" IN ('CRS', 'Manager', 'Admin', 'Media', 'Accountant', 'Founder'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_staff_sub_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"sub_brand" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_pay_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"role" text,
	"staff_id" uuid,
	"base_salary_enabled" boolean DEFAULT false NOT NULL,
	"base_salary_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"commission_enabled" boolean DEFAULT false NOT NULL,
	"commission_basis" text,
	"commission_rate" numeric(14, 4) DEFAULT '0' NOT NULL,
	"commission_gate_enabled" boolean DEFAULT false NOT NULL,
	"commission_gate_threshold_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"upsell_bonus_enabled" boolean DEFAULT false NOT NULL,
	"upsell_bonus_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sotm_bonus_enabled" boolean DEFAULT false NOT NULL,
	"sotm_bonus_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"manager_bonus_enabled" boolean DEFAULT false NOT NULL,
	"manager_bonus_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"manager_gate_enabled" boolean DEFAULT false NOT NULL,
	"manager_gate_team_ratio_percent" numeric(5, 2) DEFAULT '50' NOT NULL,
	"manager_gate_kpi_threshold_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_pay_structures_scope_type_chk" CHECK ("numbatrak_pay_structures"."scope_type" IN ('role', 'staff')),
	CONSTRAINT "numbatrak_pay_structures_role_chk" CHECK ("numbatrak_pay_structures"."role" IS NULL OR "numbatrak_pay_structures"."role" IN ('CRS', 'Manager', 'Admin', 'Media', 'Accountant', 'Founder')),
	CONSTRAINT "numbatrak_pay_structures_commission_basis_chk" CHECK ("numbatrak_pay_structures"."commission_basis" IS NULL OR "numbatrak_pay_structures"."commission_basis" IN ('flat_per_order', 'percentage_of_sale')),
	CONSTRAINT "numbatrak_pay_structures_scope_shape_chk" CHECK (("numbatrak_pay_structures"."scope_type" = 'role' AND "numbatrak_pay_structures"."role" IS NOT NULL AND "numbatrak_pay_structures"."staff_id" IS NULL)
        OR ("numbatrak_pay_structures"."scope_type" = 'staff' AND "numbatrak_pay_structures"."staff_id" IS NOT NULL AND "numbatrak_pay_structures"."role" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_payroll_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"calculated_base_salary" numeric(14, 2) DEFAULT '0' NOT NULL,
	"calculated_commission" numeric(14, 2) DEFAULT '0' NOT NULL,
	"calculated_upsell_bonus" numeric(14, 2) DEFAULT '0' NOT NULL,
	"calculated_sotm_bonus" numeric(14, 2) DEFAULT '0' NOT NULL,
	"calculated_manager_bonus" numeric(14, 2) DEFAULT '0' NOT NULL,
	"override_base_salary" numeric(14, 2),
	"override_commission" numeric(14, 2),
	"manual_adjustment" numeric(14, 2) DEFAULT '0' NOT NULL,
	"manual_adjustment_note" text,
	"delivery_rate_percent" numeric(5, 2),
	"commission_gate_missed" boolean DEFAULT false NOT NULL,
	"upsell_count" integer DEFAULT 0 NOT NULL,
	"manager_gate_missed" boolean,
	"sotm_awarded" boolean DEFAULT false NOT NULL,
	"paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"month" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"status" text NOT NULL,
	"marked_at" timestamp with time zone,
	"marked_by" text,
	"exempt_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_attendance_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"auto_close_window_minutes" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_strike_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"threshold" integer DEFAULT 2 NOT NULL,
	"threshold_period" text DEFAULT 'month' NOT NULL,
	"consequence" text DEFAULT 'HR review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_strikes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"staff_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"issued_by" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared" boolean DEFAULT false NOT NULL,
	"cleared_by" text,
	"cleared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_star_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sotm_enabled" boolean DEFAULT false NOT NULL,
	"sotm_criteria" text DEFAULT 'manual' NOT NULL,
	"sotm_min_star_tier" integer DEFAULT 0 NOT NULL,
	"sotm_winner_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_star_settings_sotm_criteria_chk" CHECK ("numbatrak_star_settings"."sotm_criteria" IN ('manual', 'highest_delivery', 'highest_delivery_rate', 'highest_revenue', 'highest_revenue_per_order', 'highest_star_tier', 'most_upsells'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_star_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"min_points" integer DEFAULT 0 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_stars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"staff_id" uuid NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"reason" text NOT NULL,
	"awarded_by" text,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"month" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"staff_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"annual_used" integer DEFAULT 0 NOT NULL,
	"sick_used" integer DEFAULT 0 NOT NULL,
	"emergency_used" integer DEFAULT 0 NOT NULL,
	"unpaid_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"staff_id" uuid NOT NULL,
	"leave_type" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"days" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_leave_requests_type_chk" CHECK ("numbatrak_leave_requests"."leave_type" IN ('annual', 'sick', 'emergency', 'unpaid')),
	CONSTRAINT "numbatrak_leave_requests_status_chk" CHECK ("numbatrak_leave_requests"."status" IN ('pending', 'approved', 'declined'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_leave_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"annual_days" integer DEFAULT 20 NOT NULL,
	"sick_days" integer DEFAULT 10 NOT NULL,
	"emergency_days" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_ad_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"batch_id" uuid,
	"name" text NOT NULL,
	"hook_type" text,
	"creative_type" text,
	"brand" text,
	"product_id" text,
	"offer_id" text,
	"drive_link" text,
	"editor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_ad_spend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"buyer_id" text,
	"spend_date" date NOT NULL,
	"brand" text,
	"product_id" text,
	"offer_id" text,
	"platform" text,
	"spend" numeric(14, 2) DEFAULT '0' NOT NULL,
	"orders" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_contractor_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"contractor_id" uuid NOT NULL,
	"pieces" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"brand" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_contractors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"rate" numeric(12, 2) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_contractors_role_chk" CHECK ("numbatrak_contractors"."role" IN ('vo_artist', 'video_editor'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_cpa_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"buyer_id" text,
	"brand" text,
	"product_id" text,
	"offer_id" text,
	"cpa_target" numeric(12, 2) DEFAULT '0' NOT NULL,
	"weekly_budget" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_media_buyer_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"weekly_review_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_production_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"buyer_id" text,
	"brand" text,
	"product_id" text,
	"creative_type" text NOT NULL,
	"description" text,
	"vo_artist_id" uuid,
	"editor_id" uuid,
	"video_count" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'briefed' NOT NULL,
	"drive_link" text,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_production_batches_creative_type_chk" CHECK ("numbatrak_production_batches"."creative_type" IN ('voiceover', 'ugc', 'ai_story', 'sound', 'other')),
	CONSTRAINT "numbatrak_production_batches_status_chk" CHECK ("numbatrak_production_batches"."status" IN ('briefed', 'shooting', 'editing', 'done'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"week_start" date NOT NULL,
	"ads_to_scale" text,
	"ads_to_pause" text,
	"ads_to_kill" text,
	"biggest_win" text,
	"biggest_issue" text,
	"verdict" text DEFAULT 'on_track' NOT NULL,
	"next_week_decisions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_weekly_reviews_verdict_chk" CHECK ("numbatrak_weekly_reviews"."verdict" IN ('on_track', 'needs_attention', 'critical'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"segment_filter" text,
	"subject" text,
	"body" text NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_campaigns_channel_chk" CHECK ("numbatrak_campaigns"."channel" IN ('email', 'whatsapp')),
	CONSTRAINT "numbatrak_campaigns_status_chk" CHECK ("numbatrak_campaigns"."status" IN ('draft', 'sending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_complaints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" text,
	"complaint_type" text,
	"description" text NOT NULL,
	"attachments" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolution_type" text,
	"escalated_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_complaints_status_chk" CHECK ("numbatrak_complaints"."status" IN ('open', 'escalated', 'resolved')),
	CONSTRAINT "numbatrak_complaints_type_chk" CHECK ("numbatrak_complaints"."complaint_type" IS NULL OR "numbatrak_complaints"."complaint_type" IN ('wrong_size', 'damaged', 'never_received', 'wrong_product', 'quality_issue', 'other')),
	CONSTRAINT "numbatrak_complaints_resolution_type_chk" CHECK ("numbatrak_complaints"."resolution_type" IS NULL OR "numbatrak_complaints"."resolution_type" IN ('refund', 'replacement', 'other'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_crm_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"channel" text NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_crm_credits_channel_chk" CHECK ("numbatrak_crm_credits"."channel" IN ('email', 'whatsapp'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"whatsapp" text,
	"location" text,
	"first_click_source" text,
	"last_click_source" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_feedback_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" text,
	"assigned_to" text,
	"scheduled_at" timestamp with time zone NOT NULL,
	"disposition" text,
	"satisfaction_score" integer,
	"reorder_likelihood" text,
	"callback_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_feedback_calls_disposition_chk" CHECK ("numbatrak_feedback_calls"."disposition" IS NULL OR "numbatrak_feedback_calls"."disposition" IN ('answered', 'no_answer', 'wrong_number', 'switched_off', 'unreachable', 'callback_requested')),
	CONSTRAINT "numbatrak_feedback_calls_reorder_chk" CHECK ("numbatrak_feedback_calls"."reorder_likelihood" IS NULL OR "numbatrak_feedback_calls"."reorder_likelihood" IN ('definitely', 'maybe', 'no', 'unlikely'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_feedback_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"call_window_days" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbatrak_more_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"feedback_call_id" uuid,
	"product_id" text,
	"product_name" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cogs" numeric(14, 2) DEFAULT '0' NOT NULL,
	"delivery_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"agent_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_more_purchases_status_chk" CHECK ("numbatrak_more_purchases"."status" IN ('pending', 'dispatched', 'delivered', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "numbatrak_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"order_id" uuid,
	"invoice_number" text NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"customer_address" text,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"delivery_fee" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_items" text DEFAULT '[]' NOT NULL,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "numbatrak_invoices_status_chk" CHECK ("numbatrak_invoices"."status" IN ('draft', 'sent', 'paid', 'void'))
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_utm_source" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_utm_medium" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_utm_campaign" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_utm_content" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_utm_term" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_referrer" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "signup_landing_path" text;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_recorded_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_created_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_surveys" ADD CONSTRAINT "exit_surveys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_sub_category_id_expense_sub_categories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."expense_sub_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("recorded_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_credit_ledger" ADD CONSTRAINT "platform_credit_ledger_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_credit_ledger" ADD CONSTRAINT "platform_credit_ledger_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_credit_ledger" ADD CONSTRAINT "platform_credit_ledger_transaction_id_platform_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."platform_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_credit_pricing" ADD CONSTRAINT "platform_credit_pricing_updated_by_admin_id_platform_admin_user_id_fk" FOREIGN KEY ("updated_by_admin_id") REFERENCES "public"."platform_admin_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_id_platform_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."platform_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_transactions" ADD CONSTRAINT "platform_transactions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_whatsapp_settings" ADD CONSTRAINT "tenant_whatsapp_settings_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_days" ADD CONSTRAINT "user_activity_days_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_agents" ADD CONSTRAINT "numbatrak_agents_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_csr_name_aliases" ADD CONSTRAINT "numbatrak_csr_name_aliases_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_csr_name_aliases" ADD CONSTRAINT "numbatrak_csr_name_aliases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_product_offers" ADD CONSTRAINT "numbatrak_product_offers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_product_offers" ADD CONSTRAINT "numbatrak_product_offers_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_product_offers" ADD CONSTRAINT "numbatrak_product_offers_variant_id_numbatrak_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."numbatrak_product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_product_price_history" ADD CONSTRAINT "numbatrak_product_price_history_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_product_variants" ADD CONSTRAINT "numbatrak_product_variants_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_product_variants" ADD CONSTRAINT "numbatrak_product_variants_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_products" ADD CONSTRAINT "numbatrak_products_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_products" ADD CONSTRAINT "numbatrak_form_products_form_id_numbatrak_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."numbatrak_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_products" ADD CONSTRAINT "numbatrak_form_products_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_forms" ADD CONSTRAINT "numbatrak_forms_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_order_items" ADD CONSTRAINT "numbatrak_customer_order_items_order_id_numbatrak_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."numbatrak_customer_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_order_items" ADD CONSTRAINT "numbatrak_customer_order_items_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_order_items" ADD CONSTRAINT "numbatrak_customer_order_items_variant_id_numbatrak_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."numbatrak_product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_order_items" ADD CONSTRAINT "numbatrak_customer_order_items_offer_id_numbatrak_product_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."numbatrak_product_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_order_items" ADD CONSTRAINT "numbatrak_customer_order_items_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD CONSTRAINT "numbatrak_customer_orders_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD CONSTRAINT "numbatrak_customer_orders_form_response_id_numbatrak_form_responses_id_fk" FOREIGN KEY ("form_response_id") REFERENCES "public"."numbatrak_form_responses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD CONSTRAINT "numbatrak_customer_orders_form_id_numbatrak_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."numbatrak_forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD CONSTRAINT "numbatrak_customer_orders_csr_id_user_id_fk" FOREIGN KEY ("csr_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD CONSTRAINT "numbatrak_customer_orders_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD CONSTRAINT "numbatrak_customer_orders_remittance_confirmed_by_user_id_fk" FOREIGN KEY ("remittance_confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customer_orders" ADD CONSTRAINT "numbatrak_customer_orders_released_by_user_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_response_items" ADD CONSTRAINT "numbatrak_form_response_items_form_response_id_numbatrak_form_responses_id_fk" FOREIGN KEY ("form_response_id") REFERENCES "public"."numbatrak_form_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_response_items" ADD CONSTRAINT "numbatrak_form_response_items_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_response_items" ADD CONSTRAINT "numbatrak_form_response_items_variant_id_numbatrak_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."numbatrak_product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_response_items" ADD CONSTRAINT "numbatrak_form_response_items_offer_id_numbatrak_product_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."numbatrak_product_offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_responses" ADD CONSTRAINT "numbatrak_form_responses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_responses" ADD CONSTRAINT "numbatrak_form_responses_form_id_numbatrak_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."numbatrak_forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_responses" ADD CONSTRAINT "numbatrak_form_responses_csr_id_user_id_fk" FOREIGN KEY ("csr_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_responses" ADD CONSTRAINT "numbatrak_form_responses_remittance_confirmed_by_user_id_fk" FOREIGN KEY ("remittance_confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_form_responses" ADD CONSTRAINT "numbatrak_form_responses_released_by_user_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_inventory_consumption" ADD CONSTRAINT "numbatrak_order_inventory_consumption_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_inventory_consumption" ADD CONSTRAINT "numbatrak_order_inventory_consumption_order_id_numbatrak_form_responses_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."numbatrak_form_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_inventory_consumption" ADD CONSTRAINT "numbatrak_order_inventory_consumption_order_item_id_numbatrak_form_response_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."numbatrak_form_response_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_inventory_consumption" ADD CONSTRAINT "numbatrak_order_inventory_consumption_inventory_lot_id_numbatrak_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."numbatrak_inventory_lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_inventory_legacy" ADD CONSTRAINT "numbatrak_inventory_legacy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_inventory_legacy" ADD CONSTRAINT "numbatrak_inventory_legacy_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_inventory_legacy" ADD CONSTRAINT "numbatrak_inventory_legacy_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_inventory_lots" ADD CONSTRAINT "numbatrak_inventory_lots_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_inventory_lots" ADD CONSTRAINT "numbatrak_inventory_lots_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_inventory_lots" ADD CONSTRAINT "numbatrak_inventory_lots_variant_id_numbatrak_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."numbatrak_product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stock_movements" ADD CONSTRAINT "numbatrak_stock_movements_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stock_movements" ADD CONSTRAINT "numbatrak_stock_movements_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stock_movements" ADD CONSTRAINT "numbatrak_stock_movements_from_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("from_agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stock_movements" ADD CONSTRAINT "numbatrak_stock_movements_to_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("to_agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stock_movements" ADD CONSTRAINT "numbatrak_stock_movements_order_id_numbatrak_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."numbatrak_customer_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stock_movements" ADD CONSTRAINT "numbatrak_stock_movements_recorded_by_user_id_user_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_deliveries" ADD CONSTRAINT "numbatrak_deliveries_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_deliveries" ADD CONSTRAINT "numbatrak_deliveries_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_deliveries" ADD CONSTRAINT "numbatrak_deliveries_product_uuid_numbatrak_products_id_fk" FOREIGN KEY ("product_uuid") REFERENCES "public"."numbatrak_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_wallet_remittance_lines" ADD CONSTRAINT "numbatrak_wallet_remittance_lines_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_wallet_remittance_lines" ADD CONSTRAINT "numbatrak_wallet_remittance_lines_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_wallet_remittance_lines" ADD CONSTRAINT "numbatrak_wallet_remittance_lines_net_off_expense_id_numbatrak_unified_expenses_id_fk" FOREIGN KEY ("net_off_expense_id") REFERENCES "public"."numbatrak_unified_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_wallet_remittance_lines" ADD CONSTRAINT "numbatrak_wallet_remittance_lines_remitted_by_user_id_fk" FOREIGN KEY ("remitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_agent_expenses_legacy" ADD CONSTRAINT "numbatrak_agent_expenses_legacy_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_agent_expenses_legacy" ADD CONSTRAINT "numbatrak_agent_expenses_legacy_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_expense_subcategories" ADD CONSTRAINT "numbatrak_expense_subcategories_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_unified_expenses" ADD CONSTRAINT "numbatrak_unified_expenses_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_unified_expenses" ADD CONSTRAINT "numbatrak_unified_expenses_agent_id_numbatrak_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."numbatrak_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_unified_expenses" ADD CONSTRAINT "numbatrak_unified_expenses_product_id_numbatrak_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."numbatrak_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_unified_expenses" ADD CONSTRAINT "numbatrak_unified_expenses_order_id_numbatrak_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."numbatrak_customer_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_unified_expenses" ADD CONSTRAINT "numbatrak_unified_expenses_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_abandoned_carts" ADD CONSTRAINT "numbatrak_abandoned_carts_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_abandoned_carts" ADD CONSTRAINT "numbatrak_abandoned_carts_form_id_numbatrak_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."numbatrak_forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_abandoned_carts" ADD CONSTRAINT "numbatrak_abandoned_carts_converted_order_id_numbatrak_customer_orders_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."numbatrak_customer_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_follow_ups" ADD CONSTRAINT "numbatrak_follow_ups_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_follow_ups" ADD CONSTRAINT "numbatrak_follow_ups_abandoned_cart_id_numbatrak_abandoned_carts_id_fk" FOREIGN KEY ("abandoned_cart_id") REFERENCES "public"."numbatrak_abandoned_carts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_follow_ups" ADD CONSTRAINT "numbatrak_follow_ups_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_assignment_settings" ADD CONSTRAINT "numbatrak_order_assignment_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_assignment_settings" ADD CONSTRAINT "numbatrak_order_assignment_settings_last_assigned_user_id_user_id_fk" FOREIGN KEY ("last_assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_assignment_weights" ADD CONSTRAINT "numbatrak_order_assignment_weights_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_order_assignment_weights" ADD CONSTRAINT "numbatrak_order_assignment_weights_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_activities" ADD CONSTRAINT "numbatrak_activities_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_activities" ADD CONSTRAINT "numbatrak_activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD CONSTRAINT "numbatrak_staff_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_staff" ADD CONSTRAINT "numbatrak_staff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_staff_sub_brands" ADD CONSTRAINT "numbatrak_staff_sub_brands_staff_id_numbatrak_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."numbatrak_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_pay_structures" ADD CONSTRAINT "numbatrak_pay_structures_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_pay_structures" ADD CONSTRAINT "numbatrak_pay_structures_staff_id_numbatrak_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."numbatrak_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_lines" ADD CONSTRAINT "numbatrak_payroll_lines_run_id_numbatrak_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."numbatrak_payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_lines" ADD CONSTRAINT "numbatrak_payroll_lines_staff_id_numbatrak_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."numbatrak_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_payroll_runs" ADD CONSTRAINT "numbatrak_payroll_runs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_attendance_events" ADD CONSTRAINT "numbatrak_attendance_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_attendance_events" ADD CONSTRAINT "numbatrak_attendance_events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_attendance_records" ADD CONSTRAINT "numbatrak_attendance_records_event_id_numbatrak_attendance_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."numbatrak_attendance_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_attendance_records" ADD CONSTRAINT "numbatrak_attendance_records_staff_id_numbatrak_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."numbatrak_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_attendance_records" ADD CONSTRAINT "numbatrak_attendance_records_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_attendance_settings" ADD CONSTRAINT "numbatrak_attendance_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_strike_settings" ADD CONSTRAINT "numbatrak_strike_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_strikes" ADD CONSTRAINT "numbatrak_strikes_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_strikes" ADD CONSTRAINT "numbatrak_strikes_staff_id_numbatrak_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."numbatrak_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_strikes" ADD CONSTRAINT "numbatrak_strikes_issued_by_user_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_strikes" ADD CONSTRAINT "numbatrak_strikes_cleared_by_user_id_fk" FOREIGN KEY ("cleared_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_star_settings" ADD CONSTRAINT "numbatrak_star_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_star_tiers" ADD CONSTRAINT "numbatrak_star_tiers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stars" ADD CONSTRAINT "numbatrak_stars_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stars" ADD CONSTRAINT "numbatrak_stars_staff_id_numbatrak_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."numbatrak_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_stars" ADD CONSTRAINT "numbatrak_stars_awarded_by_user_id_fk" FOREIGN KEY ("awarded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_leave_balances" ADD CONSTRAINT "numbatrak_leave_balances_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_leave_balances" ADD CONSTRAINT "numbatrak_leave_balances_staff_id_numbatrak_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."numbatrak_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_leave_requests" ADD CONSTRAINT "numbatrak_leave_requests_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_leave_requests" ADD CONSTRAINT "numbatrak_leave_requests_staff_id_numbatrak_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."numbatrak_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_leave_requests" ADD CONSTRAINT "numbatrak_leave_requests_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_leave_settings" ADD CONSTRAINT "numbatrak_leave_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_ad_catalog" ADD CONSTRAINT "numbatrak_ad_catalog_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_ad_catalog" ADD CONSTRAINT "numbatrak_ad_catalog_batch_id_numbatrak_production_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."numbatrak_production_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_ad_catalog" ADD CONSTRAINT "numbatrak_ad_catalog_editor_id_numbatrak_contractors_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."numbatrak_contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_ad_spend" ADD CONSTRAINT "numbatrak_ad_spend_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_ad_spend" ADD CONSTRAINT "numbatrak_ad_spend_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_contractor_payments" ADD CONSTRAINT "numbatrak_contractor_payments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_contractor_payments" ADD CONSTRAINT "numbatrak_contractor_payments_contractor_id_numbatrak_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."numbatrak_contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_contractors" ADD CONSTRAINT "numbatrak_contractors_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_cpa_targets" ADD CONSTRAINT "numbatrak_cpa_targets_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_cpa_targets" ADD CONSTRAINT "numbatrak_cpa_targets_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_media_buyer_settings" ADD CONSTRAINT "numbatrak_media_buyer_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_production_batches" ADD CONSTRAINT "numbatrak_production_batches_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_production_batches" ADD CONSTRAINT "numbatrak_production_batches_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_production_batches" ADD CONSTRAINT "numbatrak_production_batches_vo_artist_id_numbatrak_contractors_id_fk" FOREIGN KEY ("vo_artist_id") REFERENCES "public"."numbatrak_contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_production_batches" ADD CONSTRAINT "numbatrak_production_batches_editor_id_numbatrak_contractors_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."numbatrak_contractors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_weekly_reviews" ADD CONSTRAINT "numbatrak_weekly_reviews_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_weekly_reviews" ADD CONSTRAINT "numbatrak_weekly_reviews_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_campaigns" ADD CONSTRAINT "numbatrak_campaigns_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_campaigns" ADD CONSTRAINT "numbatrak_campaigns_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_complaints" ADD CONSTRAINT "numbatrak_complaints_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_complaints" ADD CONSTRAINT "numbatrak_complaints_customer_id_numbatrak_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."numbatrak_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_complaints" ADD CONSTRAINT "numbatrak_complaints_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_crm_credits" ADD CONSTRAINT "numbatrak_crm_credits_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_customers" ADD CONSTRAINT "numbatrak_customers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_feedback_calls" ADD CONSTRAINT "numbatrak_feedback_calls_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_feedback_calls" ADD CONSTRAINT "numbatrak_feedback_calls_customer_id_numbatrak_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."numbatrak_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_feedback_calls" ADD CONSTRAINT "numbatrak_feedback_calls_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_feedback_settings" ADD CONSTRAINT "numbatrak_feedback_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_more_purchases" ADD CONSTRAINT "numbatrak_more_purchases_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_more_purchases" ADD CONSTRAINT "numbatrak_more_purchases_customer_id_numbatrak_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."numbatrak_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_more_purchases" ADD CONSTRAINT "numbatrak_more_purchases_feedback_call_id_numbatrak_feedback_calls_id_fk" FOREIGN KEY ("feedback_call_id") REFERENCES "public"."numbatrak_feedback_calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_invoices" ADD CONSTRAINT "numbatrak_invoices_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_invoices" ADD CONSTRAINT "numbatrak_invoices_order_id_numbatrak_customer_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."numbatrak_customer_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "numbatrak_invoices" ADD CONSTRAINT "numbatrak_invoices_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_payouts_affiliate_idx" ON "affiliate_payouts" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_code_unique_idx" ON "affiliates" USING btree ("code");--> statement-breakpoint
CREATE INDEX "credit_bundles_type_idx" ON "credit_bundles" USING btree ("credit_type");--> statement-breakpoint
CREATE INDEX "exit_surveys_created_at_idx" ON "exit_surveys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "expense_sub_categories_parent_idx" ON "expense_sub_categories" USING btree ("parent_category");--> statement-breakpoint
CREATE INDEX "expenses_occurred_at_idx" ON "expenses" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "expenses_parent_category_idx" ON "expenses" USING btree ("parent_category");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_billing_webhook_events_reference_unique_idx" ON "platform_billing_webhook_events" USING btree ("event_reference");--> statement-breakpoint
CREATE INDEX "platform_credit_ledger_org_idx" ON "platform_credit_ledger" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "platform_credit_ledger_org_type_idx" ON "platform_credit_ledger" USING btree ("organization_id","credit_type");--> statement-breakpoint
CREATE INDEX "platform_error_log_created_at_idx" ON "platform_error_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_error_log_source_idx" ON "platform_error_log" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_metric_snapshots_date_unique_idx" ON "platform_metric_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_subscriptions_org_unique_idx" ON "platform_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "platform_subscriptions_status_idx" ON "platform_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_subscriptions_grace_period_idx" ON "platform_subscriptions" USING btree ("grace_period_ends_at");--> statement-breakpoint
CREATE INDEX "platform_subscriptions_locked_at_idx" ON "platform_subscriptions" USING btree ("locked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_transactions_reference_unique_idx" ON "platform_transactions" USING btree ("paystack_reference");--> statement-breakpoint
CREATE INDEX "platform_transactions_org_idx" ON "platform_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "platform_transactions_status_idx" ON "platform_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_transactions_created_at_idx" ON "platform_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "platform_transactions_refunded_at_idx" ON "platform_transactions" USING btree ("refunded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_activity_days_user_date_unique_idx" ON "user_activity_days" USING btree ("user_id","activity_date");--> statement-breakpoint
CREATE INDEX "user_activity_days_date_idx" ON "user_activity_days" USING btree ("activity_date");--> statement-breakpoint
CREATE INDEX "user_activity_days_org_idx" ON "user_activity_days" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_agents_name_idx" ON "numbatrak_agents" USING btree ("name");--> statement-breakpoint
CREATE INDEX "numbatrak_agents_org_idx" ON "numbatrak_agents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_agents_active_idx" ON "numbatrak_agents" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_agents_one_warehouse_per_org_idx" ON "numbatrak_agents" USING btree ("organization_id") WHERE "numbatrak_agents"."is_warehouse" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_csr_name_aliases_org_pattern_idx" ON "numbatrak_csr_name_aliases" USING btree ("organization_id","match_pattern");--> statement-breakpoint
CREATE INDEX "numbatrak_product_offers_product_idx" ON "numbatrak_product_offers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "numbatrak_product_offers_org_idx" ON "numbatrak_product_offers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_product_price_history_product_idx" ON "numbatrak_product_price_history" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "numbatrak_product_price_history_active_idx" ON "numbatrak_product_price_history" USING btree ("product_id","ends_at") WHERE "numbatrak_product_price_history"."ends_at" IS NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_product_variants_product_idx" ON "numbatrak_product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "numbatrak_product_variants_org_idx" ON "numbatrak_product_variants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_products_org_idx" ON "numbatrak_products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_products_active_idx" ON "numbatrak_products" USING btree ("active");--> statement-breakpoint
CREATE INDEX "numbatrak_products_type_idx" ON "numbatrak_products" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_form_products_form_product_unique_idx" ON "numbatrak_form_products" USING btree ("form_id","product_id");--> statement-breakpoint
CREATE INDEX "numbatrak_form_products_form_idx" ON "numbatrak_form_products" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "numbatrak_form_products_product_idx" ON "numbatrak_form_products" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_forms_token_unique_idx" ON "numbatrak_forms" USING btree ("form_token");--> statement-breakpoint
CREATE INDEX "numbatrak_forms_org_idx" ON "numbatrak_forms" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_forms_active_idx" ON "numbatrak_forms" USING btree ("active");--> statement-breakpoint
CREATE INDEX "numbatrak_forms_token_idx" ON "numbatrak_forms" USING btree ("form_token");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_order_items_order_idx" ON "numbatrak_customer_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_order_items_product_idx" ON "numbatrak_customer_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_agent_idx" ON "numbatrak_customer_orders" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_created_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_csr_idx" ON "numbatrak_customer_orders" USING btree ("csr_id");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_form_idx" ON "numbatrak_customer_orders" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_form_response_idx" ON "numbatrak_customer_orders" USING btree ("form_response_id");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_org_idx" ON "numbatrak_customer_orders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_status_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_sub_brand_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","sub_brand") WHERE "numbatrak_customer_orders"."sub_brand" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_funnel_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","funnel_name") WHERE "numbatrak_customer_orders"."funnel_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_offer_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","offer_name") WHERE "numbatrak_customer_orders"."offer_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_money_received_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","money_received_by") WHERE "numbatrak_customer_orders"."status" IN ('completed', 'delivered');--> statement-breakpoint
CREATE INDEX "numbatrak_customer_orders_wallet_idx" ON "numbatrak_customer_orders" USING btree ("organization_id","wallet_status") WHERE "numbatrak_customer_orders"."status" = 'completed';--> statement-breakpoint
CREATE INDEX "numbatrak_form_response_items_product_id_idx" ON "numbatrak_form_response_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "numbatrak_form_response_items_response_id_idx" ON "numbatrak_form_response_items" USING btree ("form_response_id");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_completed_at_idx" ON "numbatrak_form_responses" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_created_at_idx" ON "numbatrak_form_responses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_csr_idx" ON "numbatrak_form_responses" USING btree ("organization_id","csr_id") WHERE "numbatrak_form_responses"."csr_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_field_values_gin_idx" ON "numbatrak_form_responses" USING gin ("field_values");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_form_id_idx" ON "numbatrak_form_responses" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_org_idx" ON "numbatrak_form_responses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_package_name_idx" ON "numbatrak_form_responses" USING btree ("package_name");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_phone_number_idx" ON "numbatrak_form_responses" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_profit_completed_idx" ON "numbatrak_form_responses" USING btree ("organization_id","status") WHERE "numbatrak_form_responses"."status" = 'completed';--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_raw_payload_gin_idx" ON "numbatrak_form_responses" USING gin ("raw_payload");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_response_type_idx" ON "numbatrak_form_responses" USING btree ("response_type");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_status_idx" ON "numbatrak_form_responses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_submission_status_idx" ON "numbatrak_form_responses" USING btree ("submission_status");--> statement-breakpoint
CREATE INDEX "numbatrak_form_responses_wallet_idx" ON "numbatrak_form_responses" USING btree ("organization_id","wallet_status") WHERE "numbatrak_form_responses"."status" = 'completed' AND "numbatrak_form_responses"."response_type" = 'order';--> statement-breakpoint
CREATE INDEX "numbatrak_order_inventory_consumption_lot_idx" ON "numbatrak_order_inventory_consumption" USING btree ("inventory_lot_id");--> statement-breakpoint
CREATE INDEX "numbatrak_order_inventory_consumption_order_idx" ON "numbatrak_order_inventory_consumption" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "numbatrak_order_inventory_consumption_org_idx" ON "numbatrak_order_inventory_consumption" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_inventory_legacy_agent_product_org_unique_idx" ON "numbatrak_inventory_legacy" USING btree ("agent_id","product_id","organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_inventory_legacy_agent_idx" ON "numbatrak_inventory_legacy" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "numbatrak_inventory_legacy_org_idx" ON "numbatrak_inventory_legacy" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_inventory_legacy_product_idx" ON "numbatrak_inventory_legacy" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "numbatrak_inventory_lots_org_idx" ON "numbatrak_inventory_lots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_inventory_lots_product_idx" ON "numbatrak_inventory_lots" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "numbatrak_inventory_lots_received_at_idx" ON "numbatrak_inventory_lots" USING btree ("organization_id","product_id","received_at");--> statement-breakpoint
CREATE INDEX "numbatrak_stock_movements_batch_idx" ON "numbatrak_stock_movements" USING btree ("waybill_batch_id") WHERE "numbatrak_stock_movements"."waybill_batch_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_stock_movements_from_idx" ON "numbatrak_stock_movements" USING btree ("from_agent_id");--> statement-breakpoint
CREATE INDEX "numbatrak_stock_movements_org_idx" ON "numbatrak_stock_movements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_stock_movements_product_idx" ON "numbatrak_stock_movements" USING btree ("organization_id","product_id","occurred_at");--> statement-breakpoint
CREATE INDEX "numbatrak_stock_movements_to_idx" ON "numbatrak_stock_movements" USING btree ("to_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_stock_movements_legacy_delivery_unique_idx" ON "numbatrak_stock_movements" USING btree ("legacy_delivery_id") WHERE "numbatrak_stock_movements"."legacy_delivery_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_deliveries_agent_idx" ON "numbatrak_deliveries" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "numbatrak_deliveries_date_idx" ON "numbatrak_deliveries" USING btree ("date");--> statement-breakpoint
CREATE INDEX "numbatrak_deliveries_org_idx" ON "numbatrak_deliveries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_deliveries_product_uuid_idx" ON "numbatrak_deliveries" USING btree ("product_uuid");--> statement-breakpoint
CREATE INDEX "numbatrak_deliveries_status_idx" ON "numbatrak_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "numbatrak_deliveries_sub_brand_idx" ON "numbatrak_deliveries" USING btree ("organization_id","sub_brand") WHERE "numbatrak_deliveries"."sub_brand" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_deliveries_waybill_batch_idx" ON "numbatrak_deliveries" USING btree ("organization_id","waybill_batch_id") WHERE "numbatrak_deliveries"."waybill_batch_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_wallet_remittance_lines_org_date_idx" ON "numbatrak_wallet_remittance_lines" USING btree ("organization_id","remittance_date");--> statement-breakpoint
CREATE INDEX "numbatrak_wallet_remittance_lines_org_agent_idx" ON "numbatrak_wallet_remittance_lines" USING btree ("organization_id","agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_wallet_remittance_lines_org_agent_date_unique_idx" ON "numbatrak_wallet_remittance_lines" USING btree ("organization_id","agent_id","remittance_date");--> statement-breakpoint
CREATE INDEX "numbatrak_agent_expenses_legacy_agent_idx" ON "numbatrak_agent_expenses_legacy" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "numbatrak_agent_expenses_legacy_date_idx" ON "numbatrak_agent_expenses_legacy" USING btree ("date");--> statement-breakpoint
CREATE INDEX "numbatrak_agent_expenses_legacy_org_idx" ON "numbatrak_agent_expenses_legacy" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_expense_subcategories_org_idx" ON "numbatrak_expense_subcategories" USING btree ("organization_id","parent_category");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_expense_subcategories_org_parent_slug_unique_idx" ON "numbatrak_expense_subcategories" USING btree ("organization_id","parent_category","slug");--> statement-breakpoint
CREATE INDEX "numbatrak_unified_expenses_agent_idx" ON "numbatrak_unified_expenses" USING btree ("agent_id") WHERE "numbatrak_unified_expenses"."scope" = 'agent';--> statement-breakpoint
CREATE INDEX "numbatrak_unified_expenses_cat_idx" ON "numbatrak_unified_expenses" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "numbatrak_unified_expenses_org_idx" ON "numbatrak_unified_expenses" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_unified_expenses_agent_legacy_unique_idx" ON "numbatrak_unified_expenses" USING btree ("legacy_agent_expense_id") WHERE "numbatrak_unified_expenses"."legacy_agent_expense_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_unified_expenses_general_legacy_unique_idx" ON "numbatrak_unified_expenses" USING btree ("legacy_general_expense_id") WHERE "numbatrak_unified_expenses"."legacy_general_expense_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_unified_expenses_source_dedup_unique_idx" ON "numbatrak_unified_expenses" USING btree ("organization_id","source_type","source_id") WHERE "numbatrak_unified_expenses"."source_id" IS NOT NULL AND "numbatrak_unified_expenses"."source_type" <> 'manual';--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_abandoned_at_idx" ON "numbatrak_abandoned_carts" USING btree ("abandoned_at");--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_converted_idx" ON "numbatrak_abandoned_carts" USING btree ("converted_to_order");--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_customer_name_idx" ON "numbatrak_abandoned_carts" USING btree ("customer_name");--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_form_id_idx" ON "numbatrak_abandoned_carts" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_org_idx" ON "numbatrak_abandoned_carts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_funnel_idx" ON "numbatrak_abandoned_carts" USING btree ("organization_id","funnel_name") WHERE "numbatrak_abandoned_carts"."funnel_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_abandoned_carts_offer_idx" ON "numbatrak_abandoned_carts" USING btree ("organization_id","offer_name") WHERE "numbatrak_abandoned_carts"."offer_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "numbatrak_follow_ups_abandoned_cart_id_idx" ON "numbatrak_follow_ups" USING btree ("abandoned_cart_id");--> statement-breakpoint
CREATE INDEX "numbatrak_follow_ups_assigned_to_idx" ON "numbatrak_follow_ups" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "numbatrak_follow_ups_created_at_idx" ON "numbatrak_follow_ups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "numbatrak_follow_ups_order_id_idx" ON "numbatrak_follow_ups" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "numbatrak_follow_ups_org_idx" ON "numbatrak_follow_ups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_follow_ups_status_idx" ON "numbatrak_follow_ups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "numbatrak_order_assignment_settings_org_idx" ON "numbatrak_order_assignment_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_order_assignment_weights_org_idx" ON "numbatrak_order_assignment_weights" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_order_assignment_weights_org_user_unique_idx" ON "numbatrak_order_assignment_weights" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "numbatrak_activities_org_created_idx" ON "numbatrak_activities" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "numbatrak_staff_org_idx" ON "numbatrak_staff" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_staff_user_idx" ON "numbatrak_staff" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_staff_org_user_unique_idx" ON "numbatrak_staff" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "numbatrak_staff_sub_brands_staff_idx" ON "numbatrak_staff_sub_brands" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_staff_sub_brands_staff_brand_unique_idx" ON "numbatrak_staff_sub_brands" USING btree ("staff_id","sub_brand");--> statement-breakpoint
CREATE INDEX "numbatrak_pay_structures_org_idx" ON "numbatrak_pay_structures" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_pay_structures_staff_idx" ON "numbatrak_pay_structures" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_pay_structures_org_role_unique_idx" ON "numbatrak_pay_structures" USING btree ("organization_id","role") WHERE "numbatrak_pay_structures"."scope_type" = 'role';--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_pay_structures_org_staff_unique_idx" ON "numbatrak_pay_structures" USING btree ("organization_id","staff_id") WHERE "numbatrak_pay_structures"."scope_type" = 'staff';--> statement-breakpoint
CREATE INDEX "numbatrak_payroll_lines_run_idx" ON "numbatrak_payroll_lines" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "numbatrak_payroll_lines_staff_idx" ON "numbatrak_payroll_lines" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_payroll_lines_run_staff_unique_idx" ON "numbatrak_payroll_lines" USING btree ("run_id","staff_id");--> statement-breakpoint
CREATE INDEX "numbatrak_payroll_runs_org_idx" ON "numbatrak_payroll_runs" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_payroll_runs_org_month_unique_idx" ON "numbatrak_payroll_runs" USING btree ("organization_id","month");--> statement-breakpoint
CREATE INDEX "numbatrak_attendance_events_org_idx" ON "numbatrak_attendance_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_attendance_events_date_idx" ON "numbatrak_attendance_events" USING btree ("event_date");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_attendance_records_event_staff_unique_idx" ON "numbatrak_attendance_records" USING btree ("event_id","staff_id");--> statement-breakpoint
CREATE INDEX "numbatrak_attendance_records_event_idx" ON "numbatrak_attendance_records" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "numbatrak_attendance_records_staff_idx" ON "numbatrak_attendance_records" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_attendance_settings_org_unique_idx" ON "numbatrak_attendance_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_strike_settings_org_unique_idx" ON "numbatrak_strike_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_strikes_org_idx" ON "numbatrak_strikes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_strikes_staff_idx" ON "numbatrak_strikes" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "numbatrak_strikes_issued_at_idx" ON "numbatrak_strikes" USING btree ("issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_star_settings_org_unique_idx" ON "numbatrak_star_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_star_tiers_org_idx" ON "numbatrak_star_tiers" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_star_tiers_org_name_unique_idx" ON "numbatrak_star_tiers" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "numbatrak_stars_org_idx" ON "numbatrak_stars" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_stars_staff_idx" ON "numbatrak_stars" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "numbatrak_stars_month_idx" ON "numbatrak_stars" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_leave_balances_org_staff_year_unique_idx" ON "numbatrak_leave_balances" USING btree ("organization_id","staff_id","year");--> statement-breakpoint
CREATE INDEX "numbatrak_leave_balances_org_idx" ON "numbatrak_leave_balances" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_leave_balances_staff_idx" ON "numbatrak_leave_balances" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "numbatrak_leave_requests_org_idx" ON "numbatrak_leave_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_leave_requests_staff_idx" ON "numbatrak_leave_requests" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "numbatrak_leave_requests_status_idx" ON "numbatrak_leave_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_leave_settings_org_unique_idx" ON "numbatrak_leave_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_ad_catalog_org_idx" ON "numbatrak_ad_catalog" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_ad_catalog_batch_idx" ON "numbatrak_ad_catalog" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "numbatrak_ad_spend_org_idx" ON "numbatrak_ad_spend" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_ad_spend_date_idx" ON "numbatrak_ad_spend" USING btree ("spend_date");--> statement-breakpoint
CREATE INDEX "numbatrak_ad_spend_buyer_idx" ON "numbatrak_ad_spend" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "numbatrak_contractor_payments_org_idx" ON "numbatrak_contractor_payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_contractor_payments_contractor_idx" ON "numbatrak_contractor_payments" USING btree ("contractor_id");--> statement-breakpoint
CREATE INDEX "numbatrak_contractors_org_idx" ON "numbatrak_contractors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_cpa_targets_org_idx" ON "numbatrak_cpa_targets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_cpa_targets_buyer_idx" ON "numbatrak_cpa_targets" USING btree ("buyer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_media_buyer_settings_org_unique_idx" ON "numbatrak_media_buyer_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_production_batches_org_idx" ON "numbatrak_production_batches" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_weekly_reviews_org_idx" ON "numbatrak_weekly_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_weekly_reviews_buyer_idx" ON "numbatrak_weekly_reviews" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "numbatrak_campaigns_org_idx" ON "numbatrak_campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_complaints_org_idx" ON "numbatrak_complaints" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_complaints_customer_idx" ON "numbatrak_complaints" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_crm_credits_org_channel_unique_idx" ON "numbatrak_crm_credits" USING btree ("organization_id","channel");--> statement-breakpoint
CREATE INDEX "numbatrak_customers_org_idx" ON "numbatrak_customers" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_customers_org_phone_unique_idx" ON "numbatrak_customers" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE INDEX "numbatrak_feedback_calls_org_idx" ON "numbatrak_feedback_calls" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_feedback_calls_customer_idx" ON "numbatrak_feedback_calls" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "numbatrak_feedback_calls_assigned_idx" ON "numbatrak_feedback_calls" USING btree ("assigned_to");--> statement-breakpoint
CREATE UNIQUE INDEX "numbatrak_feedback_settings_org_unique_idx" ON "numbatrak_feedback_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_more_purchases_org_idx" ON "numbatrak_more_purchases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_more_purchases_customer_idx" ON "numbatrak_more_purchases" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "numbatrak_invoices_org_idx" ON "numbatrak_invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "numbatrak_invoices_order_idx" ON "numbatrak_invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "numbatrak_invoices_status_idx" ON "numbatrak_invoices" USING btree ("organization_id","status");