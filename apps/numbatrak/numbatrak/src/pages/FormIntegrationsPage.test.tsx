/**
 * Form integrations page and the order's Submitted details: the right
 * webhook address per plugin, offers handed out as off_<id> values, and the
 * stored submission shown only when opened.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

afterEach(cleanup);

const OFFER_ID = "3f2b9c1e-8d4a-4c7b-9e1f-0a2b3c4d5e6f";
const org = { currentOrganization: { id: "org1" } };

vi.mock("../contexts/OrganizationContext", () => ({ useOrganization: () => org }));
vi.mock("../lib/apiClient", () => ({ apiRequest: vi.fn(), PUBLIC_API_BASE_URL: "https://api.test" }));
vi.mock("../services/products", () => ({
  fetchProductsWithDetails: vi.fn(async () => [
    {
      id: "p1",
      name: "Sink Flusher",
      active: true,
      offers: [
        { id: OFFER_ID, label: "Buy 2 Get 2 Free", price: 65000, active: true, display_order: 0 },
        { id: "old", label: "Retired", price: 1, active: false, display_order: 1 },
      ],
    },
  ]),
}));
const submittedDetails = vi.fn();
vi.mock("../services/formIntake", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/formIntake")>();
  return {
    ...actual,
    formIntakeApi: {
      get: vi.fn(async () => ({ token: "intake_abc", fieldAliases: { name: ["name", "full_name"], package: ["package"] } })),
      rotate: vi.fn(),
      submittedDetails: (...args: unknown[]) => submittedDetails(...args),
    },
  };
});

import { FormIntegrationsPage } from "./FormIntegrationsPage";
import { SubmittedDetails } from "../components/orders/SubmittedDetails";

describe("FormIntegrationsPage", () => {
  it("shows the address for the chosen plugin", async () => {
    render(<MemoryRouter><FormIntegrationsPage /></MemoryRouter>);
    expect(await screen.findByText("https://api.test/public/numbatrak/intake/intake_abc/fluent-forms")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Elementor" }));
    expect(screen.getByText("https://api.test/public/numbatrak/intake/intake_abc/elementor")).toBeTruthy();
    expect(screen.getByText(/also: full_name/)).toBeTruthy();
  });

  it("fetches active offers as label/value pairs and Elementor option lines", async () => {
    render(<MemoryRouter><FormIntegrationsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Fetch my offers" }));
    expect(await screen.findByText(`off_${OFFER_ID}`)).toBeTruthy();
    expect(screen.queryByText(/Retired/)).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Elementor" }));
    expect(screen.getByText(new RegExp(`Buy 2 Get 2 Free — .*65,000\\|off_${OFFER_ID}`))).toBeTruthy();
  });
});

describe("SubmittedDetails", () => {
  it("loads the submission only when opened", async () => {
    submittedDetails.mockResolvedValue({
      submittedData: { provider: "fluent-forms", receivedAt: "2026-11-15T10:00:00Z", fields: { "names.first_name": "Ada", input_radio: "off_x" } },
    });
    render(<SubmittedDetails orderId="o1" />);
    expect(submittedDetails).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Submitted details/ }));
    const list = await screen.findByText("names.first_name");
    expect(within(list.parentElement!).getByText("Ada")).toBeTruthy();
    expect(screen.getByText(/From Fluent Forms/)).toBeTruthy();
    expect(submittedDetails).toHaveBeenCalledWith("o1");
  });

  it("says when nothing was saved", async () => {
    submittedDetails.mockResolvedValue({ submittedData: null });
    render(<SubmittedDetails orderId="o2" />);
    fireEvent.click(screen.getByRole("button", { name: /Submitted details/ }));
    expect(await screen.findByText(/Nothing was saved for this order/)).toBeTruthy();
  });
});
