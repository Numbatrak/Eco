"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkoutRequestSchema, type CheckoutRequest, type PublicFunnel, type FunnelSection, NIGERIA_STATES } from "@platform/shared-types";
import { useSite } from "../../../../../components/SiteProvider";
import { funnelApi } from "../../../../../lib/funnelApi";
import { cartApi } from "../../../../../lib/cartApi";
import { ApiError } from "../../../../../lib/apiClient";
import { formatCents } from "../../../../../lib/money";
import { captureAttribution, getAttribution } from "../../../../../lib/attribution";
import { viewContent, initiateCheckout } from "../../../../../lib/analytics/pixelEvents";

function getSection<K extends FunnelSection["kind"]>(
  sections: FunnelSection[],
  kind: K,
): Extract<FunnelSection, { kind: K }> | undefined {
  const section = sections.find((s) => s.kind === kind && s.visible);
  return section as Extract<FunnelSection, { kind: K }> | undefined;
}

export function FunnelPageClient({
  funnel,
  subdomain,
}: {
  funnel: PublicFunnel;
  subdomain: string;
}): React.ReactElement {
  const { site } = useSite();
  const collectionMethod = site.payment.collectionMethod;
  const { product, sections } = funnel;

  const packagesSection = getSection(sections, "funnel-packages");
  const packages = packagesSection?.options ?? [];
  const [selectedPackageId, setSelectedPackageId] = useState(packages[0]?.id ?? "");
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [placedDirectly, setPlacedDirectly] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutRequest>({
    resolver: zodResolver(checkoutRequestSchema),
    defaultValues: { paymentMethod: collectionMethod === "prepaid" ? "online" : "cod" },
  });
  const selectedPaymentMethod = watch("paymentMethod");
  const isCodSubmission =
    collectionMethod === "cod" || (collectionMethod === "both" && selectedPaymentMethod === "cod");

  useEffect(() => {
    captureAttribution();
    viewContent(product.id, product.priceCents, product.currency);
  }, [product.id, product.priceCents, product.currency]);

  async function onSubmit(values: CheckoutRequest): Promise<void> {
    if (!selectedPackage) {
      setSubmitError("Please choose a package.");
      return;
    }
    setSubmitError(null);
    try {
      await funnelApi.addPackageToCart(subdomain, product.id, selectedPackage.id);
      initiateCheckout(selectedPackage.priceCents, product.currency, [product.id]);
      const result = await cartApi.checkout(subdomain, {
        ...values,
        attribution: getAttribution(),
        source: "funnel",
      });
      setRedirecting(true);
      if (result.checkoutUrl === null) {
        setPlacedDirectly(true);
        window.location.href = `/sites/${subdomain}/order/${result.orderId}/status`;
      } else {
        window.location.href = result.checkoutUrl;
      }
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    }
  }

  const hero = getSection(sections, "funnel-hero");
  const story = getSection(sections, "funnel-story");
  const solution = getSection(sections, "funnel-solution");
  const howItWorks = getSection(sections, "funnel-how-it-works");
  const whoItsFor = getSection(sections, "funnel-who-its-for");
  const testimonials = getSection(sections, "funnel-testimonials");
  const guarantee = getSection(sections, "funnel-guarantee");
  const faq = getSection(sections, "funnel-faq");
  const orderSection = getSection(sections, "funnel-order");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-16 px-4 py-10">
      {hero && (
        <section className="flex flex-col items-center gap-3 text-center">
          {hero.eyebrow ? <span className="text-xs font-semibold uppercase tracking-wider text-muted">{hero.eyebrow}</span> : null}
          <h1 className="font-heading text-3xl text-ink">{hero.headline}</h1>
          <p className="max-w-md text-sm text-muted">{hero.sub}</p>
        </section>
      )}

      {story && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-xl text-ink">{story.title}</h2>
          <p className="whitespace-pre-line text-sm text-ink">{story.body}</p>
        </section>
      )}

      {solution && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-xl text-ink">{solution.title}</h2>
          <p className="whitespace-pre-line text-sm text-ink">{solution.body}</p>
        </section>
      )}

      {howItWorks && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl text-ink">{howItWorks.title}</h2>
          <ol className="flex flex-col gap-3">
            {howItWorks.steps.map((step, i) => (
              <li key={i} className="rounded-lg border border-line bg-panel p-3">
                <div className="text-sm font-semibold text-ink">{step.title}</div>
                <div className="text-sm text-muted">{step.body}</div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {whoItsFor && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-xl text-ink">{whoItsFor.title}</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-ink">
            {whoItsFor.items.map((item, i) => (
              <li key={i}>&bull; {item}</li>
            ))}
          </ul>
        </section>
      )}

      {testimonials && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl text-ink">{testimonials.title}</h2>
          <div className="flex flex-col gap-3">
            {testimonials.items.map((item, i) => (
              <blockquote key={i} className="rounded-lg border border-line bg-panel p-3">
                <p className="text-sm italic text-ink">&ldquo;{item.quote}&rdquo;</p>
                <footer className="mt-1 text-xs text-muted">&mdash; {item.author}</footer>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {guarantee && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-xl text-ink">{guarantee.title}</h2>
          <p className="whitespace-pre-line text-sm text-ink">{guarantee.body}</p>
        </section>
      )}

      {faq && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-xl text-ink">{faq.title}</h2>
          <div className="flex flex-col gap-3">
            {faq.items.map((item, i) => (
              <div key={i}>
                <div className="text-sm font-semibold text-ink">{item.question}</div>
                <div className="text-sm text-muted">{item.answer}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {orderSection && (
        <section className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-5">
          <h2 className="font-heading text-xl text-ink">{orderSection.title}</h2>

          {packages.length > 0 && (
            <div className="flex flex-col gap-2">
              {packagesSection ? (
                <span className="text-sm font-medium text-ink">{packagesSection.title}</span>
              ) : null}
              {packages.map((pkg) => (
                <label
                  key={pkg.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    selectedPackageId === pkg.id ? "border-ink" : "border-line"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="package"
                      checked={selectedPackageId === pkg.id}
                      onChange={() => setSelectedPackageId(pkg.id)}
                    />
                    {pkg.label}
                    {pkg.badge ? <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] text-accent-ink">{pkg.badge}</span> : null}
                  </span>
                  <span className="font-medium text-ink">{formatCents(pkg.priceCents, product.currency)}</span>
                </label>
              ))}
            </div>
          )}

          <form className="flex flex-col gap-3" noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink" htmlFor="customerName">Full name</label>
              <input id="customerName" className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink" {...register("customerName")} />
              {errors.customerName ? <p className="text-xs text-danger">{errors.customerName.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink" htmlFor="customerEmail">Email</label>
              <input id="customerEmail" type="email" className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink" {...register("customerEmail")} />
              {errors.customerEmail ? <p className="text-xs text-danger">{errors.customerEmail.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink" htmlFor="customerPhone">Phone (optional)</label>
              <input id="customerPhone" className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink" {...register("customerPhone")} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink" htmlFor="deliveryAddress">Delivery address</label>
              <input id="deliveryAddress" className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink" {...register("deliveryAddress")} />
              {errors.deliveryAddress ? <p className="text-xs text-danger">{errors.deliveryAddress.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink" htmlFor="deliveryCity">City</label>
              <input id="deliveryCity" className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink" {...register("deliveryCity")} />
              {errors.deliveryCity ? <p className="text-xs text-danger">{errors.deliveryCity.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink" htmlFor="deliveryState">State</label>
              <select id="deliveryState" className="rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink" defaultValue="" {...register("deliveryState")}>
                <option value="" disabled>Select a state</option>
                {NIGERIA_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              {errors.deliveryState ? <p className="text-xs text-danger">{errors.deliveryState.message}</p> : null}
            </div>

            {collectionMethod === "both" ? (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Payment method</span>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="radio" value="cod" {...register("paymentMethod")} />
                  Pay on delivery
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="radio" value="online" {...register("paymentMethod")} />
                  Pay now
                </label>
              </div>
            ) : collectionMethod === "cod" ? (
              <p className="text-sm text-muted">Pay with cash when your order is delivered.</p>
            ) : null}

            {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}

            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
              disabled={isSubmitting || redirecting || !selectedPackage}
            >
              {redirecting
                ? placedDirectly
                  ? "Placing order…"
                  : "Redirecting to payment…"
                : isSubmitting
                  ? "Placing order…"
                  : isCodSubmission
                    ? orderSection.ctaLabel
                    : "Continue to payment"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
