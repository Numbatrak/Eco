"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { CreateCollectionRequest } from "@platform/shared-types";
import { commerceApi } from "../../../lib/commerceApi";
import { TextField } from "../../../components/dashboard/TextField";
import { ApiError } from "../../../lib/apiClient";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const collectionFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(63)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().trim().max(2000),
  imageUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => value === "" || z.string().url().safeParse(value).success, {
      message: "Must be a valid URL",
    }),
  isActive: z.boolean(),
});
type CollectionFormValues = z.infer<typeof collectionFormSchema>;

const DEFAULT_VALUES: CollectionFormValues = {
  name: "",
  slug: "",
  description: "",
  imageUrl: "",
  isActive: true,
};

export function CollectionForm({ collectionId }: { collectionId?: string } = {}): React.ReactElement {
  const isEditing = Boolean(collectionId);
  const router = useRouter();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!isEditing);
  const slugTouched = useRef(isEditing);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!isEditing || !collectionId) return;
    commerceApi
      .getCollection(collectionId)
      .then((collection) => {
        reset({
          name: collection.name,
          slug: collection.slug,
          description: collection.description ?? "",
          imageUrl: collection.imageUrl ?? "",
          isActive: collection.isActive,
        });
        setLoaded(true);
      })
      .catch(() => setLoadError("Could not load this collection."));
  }, [isEditing, collectionId, reset]);

  const name = watch("name");
  const isActive = watch("isActive");

  useEffect(() => {
    if (slugTouched.current) return;
    setValue("slug", slugify(name));
  }, [name, setValue]);

  async function onSubmit(values: CollectionFormValues): Promise<void> {
    setFormError(null);
    const payload: CreateCollectionRequest = {
      name: values.name,
      slug: values.slug,
      description: values.description || undefined,
      imageUrl: values.imageUrl || undefined,
      isActive: values.isActive,
    };
    try {
      if (isEditing && collectionId) {
        await commerceApi.updateCollection(collectionId, payload);
      } else {
        await commerceApi.createCollection(payload);
      }
      router.push("/dashboard/collections");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not save this collection.");
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
      <h1>{isEditing ? "Edit collection" : "Add collection"}</h1>
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

        <TextField
          label="Slug"
          hint={!errors.slug ? "Used in the storefront URL: /collections/<slug>" : undefined}
          error={errors.slug?.message}
          {...register("slug", {
            onChange: () => {
              slugTouched.current = true;
            },
          })}
        />

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
          label="Image"
          hint={!errors.imageUrl ? "Image upload isn't built yet - paste a URL for now." : undefined}
          error={errors.imageUrl?.message}
          {...register("imageUrl")}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setValue("isActive", event.target.checked)}
          />
          Active (visible on your storefront)
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
            onClick={() => router.push("/dashboard/collections")}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
