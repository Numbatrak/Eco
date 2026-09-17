import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { fetchApiKeys, createApiKey, revokeApiKey, type ApiKey } from "../../services/apiKeys";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setKeys(await fetchApiKeys());
    } catch (err) {
      console.error("Failed to load API keys", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await createApiKey(name.trim());
      setRevealedKey(created.plaintextKey);
      setName("");
      void load();
    } catch (err) {
      console.error("Failed to create API key", err);
      alert(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? Any integration using it will stop working immediately.")) return;
    try {
      await revokeApiKey(id);
      void load();
    } catch (err) {
      console.error("Failed to revoke API key", err);
    }
  }

  function copyRevealedKey() {
    if (!revealedKey) return;
    void navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="org-settings-section">
      <h2 className="org-settings-section-title flex items-center gap-2">
        <Key className="w-5 h-5" />
        API Keys
      </h2>
      <p className="text-sm text-muted-foreground mb-3">
        Use an API key to authenticate external integrations against your organization's data (read-only).
      </p>

      {revealedKey && (
        <div className="mb-3 p-3 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 rounded-lg">
          <p className="text-sm font-medium mb-1">Copy this key now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded overflow-x-auto">{revealedKey}</code>
            <button onClick={copyRevealedKey} className="p-1.5 border border-border rounded hover:bg-accent">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end mb-3">
        <input
          type="text"
          placeholder="Key name (e.g. Zapier integration)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-64 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground"
        />
        <button
          onClick={() => void handleCreate()}
          disabled={creating || !name.trim()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus size={14} /> {creating ? "Creating..." : "Create Key"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-2">Name</th><th className="text-left py-2 px-2">Key</th><th className="text-left py-2 px-2">Last Used</th><th className="text-left py-2 px-2">Created</th><th className="text-left py-2 px-2">Status</th><th className="py-2 px-2"></th>
            </tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-border/50">
                  <td className="py-2 px-2 text-foreground">{k.name}</td>
                  <td className="py-2 px-2 text-muted-foreground font-mono">{k.keyPrefix}…</td>
                  <td className="py-2 px-2 text-muted-foreground">{formatDate(k.lastUsedAt)}</td>
                  <td className="py-2 px-2 text-muted-foreground">{formatDate(k.createdAt)}</td>
                  <td className="py-2 px-2">
                    {k.revokedAt ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">Revoked</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {!k.revokedAt && (
                      <button onClick={() => void handleRevoke(k.id)} className="p-1 text-red-600 hover:text-red-800 dark:text-red-400" title="Revoke">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No API keys yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
