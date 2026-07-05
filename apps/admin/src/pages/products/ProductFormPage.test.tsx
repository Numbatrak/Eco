import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProductFormPage from "./ProductFormPage";
import { commerceApi } from "../../lib/commerceApi";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    accessToken: "test-access-token",
    currentTenant: { id: "tenant-1", name: "Acme", subdomain: "acme", role: "owner" },
  })),
}));
vi.mock("../../lib/commerceApi", () => ({
  commerceApi: {
    getProduct: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
  },
}));

function renderNewProductForm() {
  return render(
    <MemoryRouter initialEntries={["/products/new"]}>
      <Routes>
        <Route path="/products/new" element={<ProductFormPage />} />
        <Route path="/products" element={<div>Products list page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProductFormPage validation", () => {
  it("shows validation errors for an empty form and never calls the API", async () => {
    const user = userEvent.setup();
    renderNewProductForm();

    // Name starts empty, currency has a default of "NGN" (valid) - clear it to trigger the length error.
    await user.clear(screen.getByLabelText("Currency"));
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/3-letter currency code/i)).toBeInTheDocument();
    expect(vi.mocked(commerceApi.createProduct)).not.toHaveBeenCalled();
  });

  it("rejects a negative price", async () => {
    const user = userEvent.setup();
    renderNewProductForm();

    await user.type(screen.getByLabelText("Name"), "Widget");
    await user.clear(screen.getByLabelText("Price"));
    await user.type(screen.getByLabelText("Price"), "-5");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/price can't be negative/i)).toBeInTheDocument();
    expect(vi.mocked(commerceApi.createProduct)).not.toHaveBeenCalled();
  });

  it("rejects an invalid image URL", async () => {
    const user = userEvent.setup();
    renderNewProductForm();

    await user.type(screen.getByLabelText("Name"), "Widget");
    await user.type(screen.getByLabelText("Image"), "not-a-url");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/must be a valid url/i)).toBeInTheDocument();
    expect(vi.mocked(commerceApi.createProduct)).not.toHaveBeenCalled();
  });

  it("converts a decimal price to integer cents on submit", async () => {
    vi.mocked(commerceApi.createProduct).mockResolvedValue({
      id: "product-1",
      tenantId: "tenant-1",
      name: "Widget",
      description: null,
      priceCents: 1999,
      currency: "NGN",
      imageUrl: null,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const user = userEvent.setup();
    renderNewProductForm();

    await user.type(screen.getByLabelText("Name"), "Widget");
    await user.clear(screen.getByLabelText("Price"));
    await user.type(screen.getByLabelText("Price"), "19.99");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText("Products list page")).toBeInTheDocument();
    expect(commerceApi.createProduct).toHaveBeenCalledWith(
      "test-access-token",
      "tenant-1",
      expect.objectContaining({ priceCents: 1999, status: "draft" }),
    );
  });
});
