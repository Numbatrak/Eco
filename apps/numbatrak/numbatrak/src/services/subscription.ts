"use client";

import { apiRequest } from "../lib/apiClient";

interface SubscriptionDto {
  id: string;
  planId: string;
  planName: string | null;
  planDisplayName: string | null;
  status: string;
  billingInterval: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
}

interface PlanDto {
  id: string;
  name: string;
  displayName: string;
  priceMonthlyCents: number;
  priceAnnuallyCents: number;
  limits: unknown;
}

export interface Subscription {
  id: string;
  plan_id: string;
  plan_name: string | null;
  plan_display_name: string | null;
  status: string;
  billing_interval: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  grace_period_ends_at: string | null;
  cancelled_at: string | null;
  created_at: string | null;
}

export interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly_cents: number;
  price_annually_cents: number;
  limits: unknown;
}

function subscriptionFromDto(d: SubscriptionDto): Subscription {
  return {
    id: d.id,
    plan_id: d.planId,
    plan_name: d.planName,
    plan_display_name: d.planDisplayName,
    status: d.status,
    billing_interval: d.billingInterval,
    current_period_start: d.currentPeriodStart,
    current_period_end: d.currentPeriodEnd,
    trial_ends_at: d.trialEndsAt,
    grace_period_ends_at: d.gracePeriodEndsAt,
    cancelled_at: d.cancelledAt,
    created_at: d.createdAt,
  };
}

function planFromDto(d: PlanDto): Plan {
  return {
    id: d.id,
    name: d.name,
    display_name: d.displayName,
    price_monthly_cents: d.priceMonthlyCents,
    price_annually_cents: d.priceAnnuallyCents,
    limits: d.limits,
  };
}

export async function fetchSubscription(): Promise<Subscription | null> {
  const { subscription } = await apiRequest<{ subscription: SubscriptionDto | null }>("/org/numbatrak/settings/subscription");
  return subscription ? subscriptionFromDto(subscription) : null;
}

export async function fetchPlans(): Promise<Plan[]> {
  const { plans } = await apiRequest<{ plans: PlanDto[] }>("/org/numbatrak/settings/plans");
  return plans.map(planFromDto);
}
