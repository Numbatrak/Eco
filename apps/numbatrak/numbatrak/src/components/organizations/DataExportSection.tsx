import { useState } from "react";
import { Download } from "lucide-react";
import { API_BASE_URL } from "../../lib/apiClient";

const ENTITIES = [
  { key: "customers", label: "Customers" },
  { key: "orders", label: "Orders" },
] as const;

async function downloadExport(entity: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/org/numbatrak/settings/export/${entity}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entity}-export.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataExportSection() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(entity: string) {
    setDownloading(entity);
    try {
      await downloadExport(entity);
    } catch (err) {
      console.error("Failed to export data", err);
      alert(err instanceof Error ? err.message : "Failed to export data");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="org-settings-section">
      <h2 className="org-settings-section-title flex items-center gap-2">
        <Download className="w-5 h-5" />
        Data Export
      </h2>
      <p className="text-sm text-muted-foreground mb-3">Download a CSV copy of your organization's data.</p>
      <div className="flex flex-wrap gap-2">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            onClick={() => void handleDownload(e.key)}
            disabled={downloading !== null}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded hover:bg-accent disabled:opacity-50"
          >
            <Download size={14} /> {downloading === e.key ? "Exporting..." : `Export ${e.label}`}
          </button>
        ))}
      </div>
    </div>
  );
}
