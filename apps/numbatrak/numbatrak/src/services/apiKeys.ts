import { apiRequest } from "../lib/apiClient";

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
}

export interface CreatedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  plaintextKey: string;
  createdAt: string | null;
}

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const { apiKeys } = await apiRequest<{ apiKeys: ApiKey[] }>("/org/numbatrak/settings/api-keys");
  return apiKeys;
}

export async function createApiKey(name: string): Promise<CreatedApiKey> {
  return apiRequest<CreatedApiKey>("/org/numbatrak/settings/api-keys", { method: "POST", body: { name } });
}

export async function revokeApiKey(id: string): Promise<void> {
  await apiRequest<void>(`/org/numbatrak/settings/api-keys/${id}`, { method: "DELETE" });
}
