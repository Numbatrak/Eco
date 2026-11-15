import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formIntakeApi, type SubmittedData } from "../../services/formIntake";

const PROVIDER_LABELS: Record<string, string> = {
  "fluent-forms": "Fluent Forms",
  elementor: "Elementor",
  wpforms: "WPForms",
  embed: "NumbaTrak form",
  form: "NumbaTrak form",
};

/**
 * Everything the website form sent for this order, exactly as received.
 * Closed by default and only fetched when opened: the order's own fields
 * cover the usual case, this is for checking what the customer typed.
 */
export function SubmittedDetails({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SubmittedData | null | undefined>(undefined);
  const [error, setError] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && data === undefined) {
      setError(false);
      try {
        const { submittedData } = await formIntakeApi.submittedDetails(orderId);
        setData(submittedData);
      } catch (err) {
        console.error("Error loading submitted details:", err);
        setError(true);
      }
    }
  };

  const entries = data ? Object.entries(data.fields) : [];

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Submitted details
      </button>
      {open && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          {error ? (
            <p className="text-muted-foreground">Couldn&apos;t load the submission. Close and open this again to retry.</p>
          ) : data === undefined ? (
            <div className="h-16 animate-pulse rounded bg-muted" />
          ) : data === null || entries.length === 0 ? (
            <p className="text-muted-foreground">
              Nothing was saved for this order. Orders entered by hand, and website orders from before this was
              added, have no submission.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                From {PROVIDER_LABELS[data.provider] ?? data.provider} ·{" "}
                {new Date(data.receivedAt).toLocaleString()}
              </p>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(8rem,auto)_1fr]">
                {entries.map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="break-all font-mono text-xs text-muted-foreground">{key}</dt>
                    <dd className="whitespace-pre-wrap break-words text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      )}
    </div>
  );
}
