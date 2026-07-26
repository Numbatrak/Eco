"use client";

import { OrgExpenseCategory } from "../constants/expenseCategories";
import { apiRequest } from "../lib/apiClient";
import { emptyWithoutOrg } from "./orgQuery";

export interface ExpenseSubcategoryRow {
  id: string;
  organization_id: string;
  parent_category: OrgExpenseCategory;
  slug: string;
  label: string;
  created_at?: string | null;
}

interface SubcategoryDto {
  id: string;
  parentCategory: string;
  slug: string;
  label: string;
  createdAt: string | null;
}

function fromDto(dto: SubcategoryDto, organizationId: string): ExpenseSubcategoryRow {
  return {
    id: dto.id,
    organization_id: organizationId,
    parent_category: dto.parentCategory as OrgExpenseCategory,
    slug: dto.slug,
    label: dto.label,
    created_at: dto.createdAt,
  };
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export async function fetchCustomExpenseSubcategories(
  organizationId: string | null
): Promise<ExpenseSubcategoryRow[]> {
  const empty = emptyWithoutOrg<ExpenseSubcategoryRow>(organizationId);
  if (empty) return empty;

  const { subcategories } = await apiRequest<{ subcategories: SubcategoryDto[] }>("/org/numbatrak/expense-subcategories");
  return subcategories.map((s) => fromDto(s, organizationId!));
}

export async function createCustomExpenseSubcategory(input: {
  organization_id: string;
  parent_category: OrgExpenseCategory;
  label: string;
}): Promise<ExpenseSubcategoryRow> {
  const label = input.label.trim();
  if (!label) throw new Error("Subcategory label is required");

  const dto = await apiRequest<SubcategoryDto>("/org/numbatrak/expense-subcategories", {
    method: "POST",
    body: {
      parentCategory: input.parent_category,
      slug: slugify(label),
      label,
    },
  });
  return fromDto(dto, input.organization_id);
}

export async function deleteCustomExpenseSubcategory(id: string): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/expense-subcategories/${id}`, { method: "DELETE" });
}
