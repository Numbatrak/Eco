export interface PlatformClientOptions {
  apiUrl?: string;
}

/**
 * Placeholder entry point proving the SDK build pipeline works end to end.
 * Real client methods land once the API surface is defined.
 */
export function createPlatformClient(options: PlatformClientOptions = {}): { apiUrl: string } {
  return {
    apiUrl: options.apiUrl ?? "https://api.example.com",
  };
}
