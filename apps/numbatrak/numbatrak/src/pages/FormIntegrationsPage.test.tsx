/**
 * Form integrations page and the order's Submitted details: the right
 * webhook address per plugin, offers handed out as off_<id> values, and the
 * stored submission shown only when opened.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

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
const recent = vi.fn(async (_formId?: string | null) => ({ submissions: [] as unknown[] }));
const settings = { token: "intake_abc", forms: [] as unknown[], fieldAliases: { name: ["name", "full_name"], package: ["package"] } };
const get = vi.fn(async () => settings);
const createForm = vi.fn(async (name: string, provider: string) => ({ form: { id: "f1", name, provider, createdAt: null } }));
vi.mock("../services/formIntake", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/formIntake")>();
  return {
    ...actual,
    formIntakeApi: {
      get: () => get(),
      createForm: (name: string, provider: string) => createForm(name, provider),
      rotate: vi.fn(),
      recent: (formId?: string | null) => recent(formId),
      submittedDetails: (...args: unknown[]) => submittedDetails(...args),
    },
  };
});

import { FormIntegrationsPage } from "./FormIntegrationsPage";
import { SubmittedDetails } from "../components/orders/SubmittedDetails";

describe("FormIntegrationsPage walkthrough", () => {
  const next = () => fireEvent.click(screen.getByRole("button", { name: /Done, next step|I've done this/ }));

  /** Picks the plugin and names a new form, ending on the fields step. */
  async function startNamedForm(plugin: RegExp, name = "Sink Flusher") {
    render(<MemoryRouter><FormIntegrationsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: plugin }));
    fireEvent.change(await screen.findByLabelText("Name for this form (funnel)"), { target: { value: `  ${name}  ` } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await screen.findByText(/You're setting up/);
    next();
  }

  it("needs a form name before going past the naming step", async () => {
    render(<MemoryRouter><FormIntegrationsPage /></MemoryRouter>);
    expect(screen.getByText("Which plugin made your order form?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Elementor/ }));
    expect(await screen.findByText("Give this form a name")).toBeTruthy();
    expect(screen.getByText(/every form is a funnel/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Done, next step/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the trimmed name, then shows that plugin's fields", async () => {
    await startNamedForm(/Elementor/);
    expect(createForm).toHaveBeenCalledWith("Sink Flusher", "elementor");
    expect(screen.getByText("Make sure your form has the right boxes")).toBeTruthy();
    expect(screen.getByText("ID to type")).toBeTruthy();
    expect(screen.getByText("Step 3 of 7")).toBeTruthy();
    expect(screen.getByText(/Setting up form \(funnel\):/)).toBeTruthy();
  });

  it("refuses a name another form already uses", async () => {
    get.mockResolvedValueOnce({ ...settings, forms: [{ id: "f0", name: "Sink Flusher", provider: "elementor", createdAt: null }] });
    render(<MemoryRouter><FormIntegrationsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Fluent Forms/ }));
    fireEvent.change(await screen.findByLabelText("Name for this form (funnel)"), { target: { value: "sink flusher" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(await screen.findByText(/already have a form called/)).toBeTruthy();
    expect(createForm).not.toHaveBeenCalled();
  });

  it("hands out offers as label|off_<id> lines for Elementor", async () => {
    await startNamedForm(/Elementor/);
    next();
    fireEvent.click(screen.getByRole("button", { name: "Get my offers" }));
    expect(await screen.findByText(new RegExp(`Buy 2 Get 2 Free — .*65,000\\|off_${OFFER_ID}`))).toBeTruthy();
    expect(screen.queryByText(/Retired/)).toBeNull();
  });

  it("gives the named form its own address and confirms its test order", async () => {
    recent.mockResolvedValue({
      submissions: [{ kind: "order", id: "o1", formId: "f1", customerName: "Ada Obi", packageName: "Buy 2 Get 2 Free", provider: "fluent-forms", receivedAt: new Date().toISOString() }],
    });
    await startNamedForm(/Fluent Forms/);
    next(); // fields -> packages
    next(); // packages -> tracking
    fireEvent.click(screen.getByRole("button", { name: "Skip this step" }));
    expect(await screen.findByText("https://api.test/public/numbatrak/intake/intake_abc/f1")).toBeTruthy();
    next();
    expect(await screen.findByText("It works! Your order arrived.")).toBeTruthy();
    expect(recent).toHaveBeenCalledWith("f1");
  });

  it("explains a test that landed as an abandoned cart", async () => {
    get.mockResolvedValueOnce({ ...settings, forms: [{ id: "f9", name: "Mop", provider: "elementor", createdAt: null }] });
    localStorage.setItem("numbatrak:form-integrations", JSON.stringify({ step: 6, provider: "elementor", formId: "f9" }));
    recent.mockResolvedValue({
      submissions: [{ kind: "abandoned_cart", id: "c1", formId: "f9", customerName: "Ada", packageName: "Big pack", provider: "elementor", receivedAt: new Date().toISOString() }],
    });
    render(<MemoryRouter><FormIntegrationsPage /></MemoryRouter>);
    expect(await screen.findByText(/It arrived, but not as an order/)).toBeTruthy();
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
