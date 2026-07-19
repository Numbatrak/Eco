"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { Collection, CreateProductRequest } from "@platform/shared-types";
import { commerceApi } from "../../../lib/commerceApi";
import { TextField } from "../../../components/dashboard/TextField";
import { ApiError } from "../../../lib/apiClient";
import { VariantEditor } from "./VariantEditor";

const productFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(5000),
  priceAmount: z.coerce.number().nonnegative("Price can't be negative"),
  compareAtPriceAmount: z.coerce.number().nonnegative("Price can't be negative").optional(),
  currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code, e.g. NGN")
    .transform((value) => value.toUpperCase()),
  imageUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => value === "" || z.string().url().safeParse(value).success, {
      message: "Must be a valid URL",
    }),
  collectionId: z.string(),
  published: z.boolean(),
});
type ProductFormValues = z.infer<typeof productFormSchema>;

const DEFAULT_VALUES: ProductFormValues = {
  name: "",
  description: "",
  priceAmount: 0,
  compareAtPriceAmount: undefined,
  currency: "NGN",
  imageUrl: "",
  collectionId: "",
  published: false,
};

export function ProductForm({ productId }: { productId?: string } = {}): React.ReactElement {
  const isEditing = Boolean(productId);
  const router = useRouter();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!isEditing);
  const [collections, setCollections] = useState<Collection[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    commerceApi
      .listCollections()
      .then(({ collections: list }) => setCollections(list))
      .catch(() => setCollections([]));
  }, []);

  useEffect(() => {
    if (!isEditing || !productId) return;
    commerceApi
      .getProduct(productId)
      .then((product) => {
        reset({
          name: product.name,
          description: product.description ?? "",
          priceAmount: product.priceCents / 100,
          compareAtPriceAmount:
            product.compareAtPriceCents != null ? product.compareAtPriceCents / 100 : undefined,
          currency: product.currency,
          imageUrl: product.imageUrl ?? "",
          collectionId: product.collectionId ?? "",
          published: product.status === "published",
        });
        setLoaded(true);
      })
      .catch(() => setLoadError("Could not load this product."));
  }, [isEditing, productId, reset]);

  const published = watch("published");

  async function onSubmit(values: ProductFormValues): Promise<void> {
    setFormError(null);
    const payload: CreateProductRequest = {
      name: values.name,
      description: values.description || undefined,
      priceCents: Math.round(values.priceAmount * 100),
      compareAtPriceCents:
        values.compareAtPriceAmount != null ? Math.round(values.compareAtPriceAmount * 100) : null,
      currency: values.currency,
      imageUrl: values.imageUrl || undefined,
      collectionId: values.collectionId || null,
      status: values.published ? "published" : "draft",
    };
    try {
      if (isEditing && productId) {
        await commerceApi.updateProduct(productId, payload);
      } else {
        await commerceApi.createProduct(payload);
      }
      router.push("/dashboard/products");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not save this product.");
    }
  }

  if (loadError) {
    return (
      <div className="banner banner-danger" role="alert">
        {loadError}
      </div>
    );
  }
  if (!loaded) {
    return <p className="field-hint">Loading…</p>;
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1>{isEditing ? "Edit product" : "Add product"}</h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          marginTop: "var(--space-5)",
        }}
      >
        <TextField label="Name" error={errors.name?.message} {...register("name")} />

        <div className="field">
          <label className="field-label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="text-input"
            rows={4}
            {...register("description")}
          />
          {errors.description ? (
            <span className="field-error" role="alert">
              {errors.description.message}
            </span>
          ) : null}
        </div>

        <TextField
          label="Price"
          type="number"
          min={0}
          step="0.01"
          error={errors.priceAmount?.message}
          {...register("priceAmount")}
        />

        <TextField
          label="Compare-at price"
          type="number"
          min={0}
          step="0.01"
          hint={!errors.compareAtPriceAmount ? "Optional - shows as a strike-through sale price." : undefined}
          error={errors.compareAtPriceAmount?.message}
          {...register("compareAtPriceAmount")}
        />

        <TextField
          label="Currency"
          hint={!errors.currency ? "3-letter code, e.g. NGN, USD" : undefined}
          error={errors.currency?.message}
          {...register("currency")}
        />

        <TextField
          label="Image"
          hint={!errors.imageUrl ? "Image upload isn't built yet - paste a URL for now." : undefined}
          error={errors.imageUrl?.message}
          {...register("imageUrl")}
        />

        <div className="field">
          <label className="field-label" htmlFor="collectionId">
            Collection
          </label>
          <select id="collectionId" className="text-input" {...register("collectionId")}>
            <option value="">No collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={published}
            onChange={(event) => setValue("published", event.target.checked)}
          />
          Publish (visible on your storefront)
        </label>

        {formError ? (
          <div className="banner banner-danger" role="alert">
            {formError}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/dashboard/products")}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      {isEditing && productId ? <VariantEditor productId={productId} /> : null}
    </div>
  );
}
