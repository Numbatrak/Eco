/**
 * Component-level cover for the builder's creation flow.
 *
 * The reducer and the naming helpers have their own unit tests; what these
 * check is the *wiring* - that the component passes the right coalesce keys,
 * mounts the sheet only below `lg`, and renders the settings panel once.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mockConfirm = vi.fn(async () => true);

vi.mock("../../contexts/OrganizationContext", () => ({
  useOrganization: () => ({ currentOrganization: { id: "org_1", name: "Test Org" } }),
}));
vi.mock("../../contexts/ConfirmContext", () => ({
  useConfirm: () => ({ confirm: mockConfirm }),
}));
/**
 * Catalog the builder loads. Mutable so a test can simulate a merchant who
 * hasn't set up any packages yet.
 */
const catalog = {
  products: [{ id: "p_mat", organization_id: "org_1", name: "Medium Mat", cost_price: 3000, active: true }],
  offers: {
    p_mat: [
      {
        id: "o_single",
        organization_id: "org_1",
        product_id: "p_mat",
        offer_type: "single",
        label: "One mat",
        min_quantity: 1,
        free_quantity: 0,
        price: 10000,
        unit_cost: 3000,
        active: true,
        display_order: 1,
      },
      {
        id: "o_tier",
        organization_id: "org_1",
        product_id: "p_mat",
        offer_type: "quantity_tier",
        label: "2 for 18,000",
        min_quantity: 2,
        free_quantity: 0,
        price: 18000,
        unit_cost: 3000,
        active: true,
        display_order: 2,
      },
    ],
  } as Record<string, unknown[]>,
};

vi.mock("../../services/products", () => ({ fetchProducts: vi.fn(async () => catalog.products) }));
vi.mock("../../services/productOffers", () => ({ fetchOffersForProducts: vi.fn(async () => catalog.offers) }));
vi.mock("../../services/productVariants", () => ({
  fetchVariantsForProducts: vi.fn(async () => ({})),
}));
vi.mock("../../services/forms", () => ({
  createForm: vi.fn(async () => ({ id: "form_1" })),
  updateForm: vi.fn(async () => ({ id: "form_1" })),
  fetchFormById: vi.fn(async () => null),
  generateFormToken: () => "form_live_test",
  updateFormFieldMapping: vi.fn(async () => ({ field_mapping: {} })),
  rotateFormWebhookSecret: vi.fn(async () => "secret"),
}));

import FormBuilderPage from "./FormBuilderPage";

/** Drive the `useMediaQuery` hook, which reads `window.matchMedia`. */
function setViewport(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = min ? width >= Number(min[1]) : false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  }) as unknown as typeof window.matchMedia;
}

function renderBuilder() {
  return render(
    <MemoryRouter initialEntries={["/forms/create"]}>
      <Routes>
        <Route path="/forms/create" element={<FormBuilderPage />} />
        <Route path="/forms" element={<div>Forms list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const DESKTOP = 1280;
const MOBILE = 390;

const FULL_CATALOG = JSON.parse(JSON.stringify(catalog));

beforeEach(() => {
  mockConfirm.mockClear();
  mockConfirm.mockResolvedValue(true);
  catalog.products = JSON.parse(JSON.stringify(FULL_CATALOG.products));
  catalog.offers = JSON.parse(JSON.stringify(FULL_CATALOG.offers));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("new form bootstrap", () => {
  it("seeds the seven system fields", async () => {
    setViewport(DESKTOP);
    renderBuilder();
    expect(await screen.findByText("Fields (7)")).toBeInTheDocument();
  });
});

describe("desktop vs mobile panel placement", () => {
  it("renders the settings panel once, in the rail, on desktop", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await user.click(await screen.findByRole("button", { name: /First Name field, position 1/i }));

    // One panel, not one in the rail plus one in a sheet.
    expect(screen.getAllByLabelText(/Answer key/i)).toHaveLength(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not mount any dialog overlay on desktop when a field is selected", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    const { baseElement } = renderBuilder();

    await user.click(await screen.findByRole("button", { name: /First Name field, position 1/i }));

    // The regression: an open-but-hidden sheet still rendered its scrim and
    // locked body scroll.
    expect(baseElement.querySelector('[data-slot="sheet-overlay"]')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe("none");
  });

  it("uses a sheet on mobile", async () => {
    setViewport(MOBILE);
    const user = userEvent.setup();
    renderBuilder();

    await user.click(await screen.findByRole("button", { name: /First Name field, position 1/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Edit field")).toBeInTheDocument();
    // Still exactly one panel in the document.
    expect(screen.getAllByLabelText(/Answer key/i)).toHaveLength(1);
  });
});

describe("field naming", () => {
  it("never reuses an answer key after a delete", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await screen.findByText("Fields (7)");
    // Re-query each time: adding a field swaps the rail to "Edit field", so a
    // held reference would be detached from the document.
    const addText = async () => {
      await user.click(screen.getByRole("tab", { name: "Add field" }));
      await user.click(screen.getByTitle(/^Text — Short answer$/));
    };

    await addText(); // -> field_8
    await addText(); // -> field_9
    expect(await screen.findByText("Fields (9)")).toBeInTheDocument();

    // Delete the first one we added.
    const eighth = screen.getByRole("button", { name: /position 8 of 9/i });
    await user.click(within(eighth).getByRole("button", { name: /^Delete Text Field 8$/i }));
    expect(await screen.findByText("Fields (8)")).toBeInTheDocument();

    // The old generator produced field_9 again here.
    await addText();
    expect(await screen.findByText("Fields (9)")).toBeInTheDocument();

    const keys = screen
      .getAllByRole("button", { name: /field, position \d+ of 9/i })
      .map((el) => el.getAttribute("aria-label"));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("locked fields", () => {
  it("disables delete on the only package picker and explains why", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    const picker = await screen.findByRole("button", { name: /Select Package field, position 7/i });
    const deleteButton = within(picker).getByRole("button", {
      name: /every order form needs this field/i,
    });
    expect(deleteButton).toBeDisabled();

    await user.click(picker);
    expect(screen.getByText(/Always needed/)).toBeInTheDocument();
    expect(
      screen.getByText(/Every order form needs a field for the package choice/i),
    ).toBeInTheDocument();
  });

  it("allows deleting a second package picker", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await screen.findByText("Fields (7)");
    await user.click(await screen.findByTitle(/^Package picker — /));
    expect(await screen.findByText("Fields (8)")).toBeInTheDocument();

    // With two pickers, neither is the last one, so both are deletable.
    const extra = screen.getByRole("button", { name: /position 8 of 8/i });
    const deleteButton = within(extra).getByRole("button", { name: /^Delete /i });
    expect(deleteButton).toBeEnabled();

    await user.click(deleteButton);
    expect(await screen.findByText("Fields (7)")).toBeInTheDocument();
  });

  it("keeps Required checked and disabled on a system field", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await user.click(await screen.findByRole("button", { name: /First Name field, position 1/i }));

    const checkbox = screen.getByRole("checkbox", { name: /Customers must fill this in/i });
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(screen.getByText("Required for every order form")).toBeInTheDocument();
  });
});

describe("undo covers property edits", () => {
  it("restores a label typed before an unrelated move", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    const first = await screen.findByRole("button", { name: /First Name field, position 1/i });
    await user.click(first);

    const labelInput = screen.getByDisplayValue("First Name");
    await user.clear(labelInput);
    await user.type(labelInput, "Given name");
    expect(await screen.findByDisplayValue("Given name")).toBeInTheDocument();

    // An unrelated structural edit: move the last field up.
    const last = screen.getByRole("button", { name: /position 7 of 7/i });
    await user.click(within(last).getByRole("button", { name: "Move up" }));

    // Two undos: one for the move, one for the whole typing run.
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(await screen.findByDisplayValue("First Name")).toBeInTheDocument();
  });

  it("collapses a typing run into a single undo step", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await user.click(await screen.findByRole("button", { name: /First Name field, position 1/i }));
    const labelInput = screen.getByDisplayValue("First Name");

    await user.type(labelInput, "XYZ");
    expect(await screen.findByDisplayValue("First NameXYZ")).toBeInTheDocument();

    // One undo, not three.
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByDisplayValue("First Name")).toBeInTheDocument();
  });

  it("redo replays the collapsed run", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await user.click(await screen.findByRole("button", { name: /First Name field, position 1/i }));
    await user.type(screen.getByDisplayValue("First Name"), "XYZ");
    await screen.findByDisplayValue("First NameXYZ");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await screen.findByDisplayValue("First Name");

    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(await screen.findByDisplayValue("First NameXYZ")).toBeInTheDocument();
  });

  it("starts disabled and enables once there is something to undo", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await screen.findByText("Fields (7)");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();

    await user.click(screen.getByTitle(/^Text — Short answer$/));
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  });
});

describe("saving", () => {
  it("blocks the save and names the fields when two share an answer key", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await screen.findByText("Fields (7)");
    await user.click(screen.getByTitle(/^Text — Short answer$/));

    // Rename the new field onto an existing key.
    const keyInput = await screen.findByLabelText(/Answer key/i);
    await user.clear(keyInput);
    await user.type(keyInput, "notes");

    // And add a second one with the same key.
    await user.click(screen.getByRole("tab", { name: "Add field" }));
    await user.click(screen.getByTitle(/^Text — Short answer$/));
    const secondKey = await screen.findByLabelText(/Answer key/i);
    await user.clear(secondKey);
    await user.type(secondKey, "notes");

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    await user.type(screen.getByPlaceholderText(/Product Order Form/i), "My form");
    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Save Form/i }));
    });

    const { createForm } = await import("../../services/forms");
    expect(createForm).not.toHaveBeenCalled();
    expect(screen.getByText(/Two fields can't share an answer key/i)).toBeInTheDocument();
    expect(screen.getByText(/"notes" is used by/i)).toBeInTheDocument();
  });
});

describe("packages come from Products", () => {
  /** Select the package picker field and open its settings. */
  async function openPackagePicker(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: /Select Package field, position 7/i }));
  }

  it("lists every active offer, grouped by product", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await openPackagePicker(user);
    await user.click(screen.getByRole("button", { name: /Add the first package/i }));

    const select = await screen.findByLabelText(/^Package 1$/i);
    const group = within(select).getByRole("group", { name: "Medium Mat" });
    expect(within(group).getByRole("option", { name: /One mat — ₦10,000/ })).toBeInTheDocument();
    expect(within(group).getByRole("option", { name: /2 for 18,000 — ₦18,000/ })).toBeInTheDocument();
  });

  it("shows price, contents and profit read-only once a package is picked", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await openPackagePicker(user);
    await user.click(screen.getByRole("button", { name: /Add the first package/i }));
    await user.selectOptions(await screen.findByLabelText(/^Package 1$/i), "o_single");

    expect(await screen.findByText("₦10,000")).toBeInTheDocument();
    expect(screen.getByText("1× Medium Mat")).toBeInTheDocument();
    expect(screen.getByText("₦3,000")).toBeInTheDocument();
    expect(screen.getByText("₦7,000")).toBeInTheDocument();

    // No way to type a price or a title on the form side any more.
    expect(screen.queryByPlaceholderText(/Option title/i)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("10000")).not.toBeInTheDocument();
  });

  it("warns when a package would lose money", async () => {
    setViewport(DESKTOP);
    catalog.offers.p_mat = [
      { ...(catalog.offers.p_mat as Record<string, unknown>[])[0], price: 1000, unit_cost: 3000 },
    ];
    const user = userEvent.setup();
    renderBuilder();

    await openPackagePicker(user);
    await user.click(screen.getByRole("button", { name: /Add the first package/i }));
    await user.selectOptions(await screen.findByLabelText(/^Package 1$/i), "o_single");

    expect(await screen.findByText(/you'd lose money on this/i)).toBeInTheDocument();
  });

  it("keeps the answer value stable when the package is swapped", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await openPackagePicker(user);
    await user.click(screen.getByRole("button", { name: /Add the first package/i }));

    const select = await screen.findByLabelText(/^Package 1$/i);
    const value = screen.getByText(/^Answer value: /).textContent;

    await user.selectOptions(select, "o_single");
    await user.selectOptions(select, "o_tier");

    // A live form's submissions and Elementor mapping key on this.
    expect(screen.getByText(/^Answer value: /).textContent).toBe(value);
  });

  it("says so when the chosen package has been removed from Products", async () => {
    setViewport(DESKTOP);
    const user = userEvent.setup();
    renderBuilder();

    await openPackagePicker(user);
    await user.click(screen.getByRole("button", { name: /Add the first package/i }));
    await user.selectOptions(await screen.findByLabelText(/^Package 1$/i), "o_single");
    await screen.findByText("1× Medium Mat");

    // The option keeps pointing at the offer rather than being silently gutted.
    expect(screen.getByText(/edit this package\s+under Products/i)).toBeInTheDocument();
  });

  it("points the merchant at Products when there are no packages yet", async () => {
    setViewport(DESKTOP);
    catalog.offers = {};
    const user = userEvent.setup();
    renderBuilder();

    await openPackagePicker(user);
    await user.click(screen.getByRole("button", { name: /Add the first package/i }));

    expect(await screen.findByText("No packages yet")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Set up a package/i });
    expect(link).toHaveAttribute("href", "/products");
    // New tab, so an unsaved form isn't lost.
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("palette only offers what can actually be used", () => {
  it("marks package fields unavailable when no packages exist", async () => {
    setViewport(DESKTOP);
    catalog.offers = {};
    renderBuilder();

    await screen.findByText("Fields (7)");
    const tiles = await screen.findAllByTitle(/You haven't set up any packages yet/i);
    // Both the package picker and the order bump need a package to be usable.
    expect(tiles).toHaveLength(2);
    for (const tile of tiles) {
      expect(tile).toHaveAttribute("aria-disabled", "true");
      expect(tile).toHaveAttribute("draggable", "false");
      expect(within(tile).getByText(/tap to see why/i)).toBeInTheDocument();
    }
    expect(tiles.map((t) => within(t).getByText(/Package picker|Order bump/).textContent)).toEqual([
      "Package picker",
      "Order bump",
    ]);
  });

  it("does not add a field when an unavailable tile is clicked", async () => {
    setViewport(DESKTOP);
    catalog.offers = {};
    const user = userEvent.setup();
    renderBuilder();

    await screen.findByText("Fields (7)");
    const [picker] = await screen.findAllByTitle(/You haven't set up any packages yet/i);
    await user.click(picker);

    expect(screen.getByText("Fields (7)")).toBeInTheDocument();
  });

  it("keeps ordinary fields draggable and available", async () => {
    setViewport(DESKTOP);
    catalog.offers = {};
    renderBuilder();

    await screen.findByText("Fields (7)");
    const text = screen.getByTitle(/^Text — Short answer$/);
    expect(text).toHaveAttribute("draggable", "true");
    expect(text).not.toHaveAttribute("aria-disabled");
  });

  it("offers package fields normally once packages exist", async () => {
    setViewport(DESKTOP);
    renderBuilder();

    await screen.findByText("Fields (7)");
    const tile = await screen.findByTitle(/^Package picker — /);
    expect(tile).toHaveAttribute("draggable", "true");
    expect(tile).not.toHaveAttribute("aria-disabled");
  });
});

describe("dragging a field onto the canvas", () => {
  /** Minimal DataTransfer stand-in — jsdom has no drag-and-drop. */
  function dataTransfer() {
    const store: Record<string, string> = {};
    return {
      data: store,
      setData: (k: string, v: string) => { store[k] = v; },
      getData: (k: string) => store[k] ?? "",
      set effectAllowed(_v: string) {},
      set dropEffect(_v: string) {},
    };
  }

  /** jsdom builds drop events without pointer coordinates, so set clientY by hand. */
  async function dropOnCard(cardName: RegExp, clientY: number) {
    const { fireEvent, createEvent } = await import("@testing-library/react");
    const tile = screen.getByTitle(/^Text — Short answer$/);
    const dt = dataTransfer();
    fireEvent.dragStart(tile, { dataTransfer: dt });

    const card = screen.getByRole("button", { name: cardName });
    card.getBoundingClientRect = () =>
      ({ top: 0, height: 100, bottom: 100, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    for (const type of ["dragOver", "drop"] as const) {
      const event = createEvent[type](card, { dataTransfer: dt });
      Object.defineProperty(event, "clientY", { value: clientY });
      fireEvent(card, event);
    }
  }

  it("accepts a drop on a field card, not just the thin gap between cards", async () => {
    setViewport(DESKTOP);
    renderBuilder();
    await screen.findByText("Fields (7)");

    // Lower half of the first card => lands after it, at position 2.
    await dropOnCard(/First Name field, position 1/i, 80);

    expect(await screen.findByText("Fields (8)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /position 2 of 8/i }).getAttribute("aria-label")).toMatch(
      /Text Field/,
    );
  });

  it("drops above the field when the pointer is on its top half", async () => {
    setViewport(DESKTOP);
    renderBuilder();
    await screen.findByText("Fields (7)");

    await dropOnCard(/First Name field, position 1/i, 20);

    expect(await screen.findByText("Fields (8)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /position 1 of 8/i }).getAttribute("aria-label")).toMatch(
      /Text Field/,
    );
  });
});
