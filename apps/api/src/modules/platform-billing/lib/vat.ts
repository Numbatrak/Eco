// VAT (7.5%) is charged on subscriptions only, added on top of the displayed
// price (SuperAdmin.docx, Tab 1 + Tab 3 tax view). So the amount Paystack
// charges already includes VAT, and the portion is total − total/(1+rate).
// Credit purchases are not VAT-liable, so this is never applied to them.
export const VAT_RATE = 0.075;

export function subscriptionVatPortionCents(totalCents: number): number {
  const net = Math.round(totalCents / (1 + VAT_RATE));
  return totalCents - net;
}
