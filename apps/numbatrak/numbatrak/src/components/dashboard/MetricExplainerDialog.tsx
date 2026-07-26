import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  METRIC_EXPLAINERS,
  type MetricExplainerKey,
} from "../../constants/metricExplainers";

interface MetricExplainerDialogProps {
  explainerKey: MetricExplainerKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional live values for waterfall display */
  liveValues?: Partial<Record<string, string>>;
}

export function MetricExplainerDialog({
  explainerKey,
  open,
  onOpenChange,
  liveValues,
}: MetricExplainerDialogProps) {
  if (!explainerKey) return null;
  const content = METRIC_EXPLAINERS[explainerKey];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {content.summary}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {content.formula && (
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 font-mono text-xs text-foreground">
              {content.formula}
            </div>
          )}

          {content.waterfall && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Profit waterfall
              </p>
              <ul className="rounded-lg border border-border divide-y divide-border">
                {content.waterfall.map((step) => (
                  <li
                    key={step.label}
                    className={`flex items-center justify-between px-3 py-2 ${
                      step.highlight ? "bg-primary/5 font-medium" : ""
                    }`}
                  >
                    <span>{step.label}</span>
                    {liveValues?.[step.label] && (
                      <span className="font-metric text-foreground">
                        {liveValues[step.label]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.split && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3 bg-card">
                <p className="font-medium text-foreground mb-1">
                  {content.split.left.title}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {content.split.left.body}
                </p>
              </div>
              <div className="rounded-lg border border-primary/30 p-3 bg-primary/5">
                <p className="font-medium text-foreground mb-1">
                  {content.split.right.title}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {content.split.right.body}
                </p>
              </div>
            </div>
          )}

          {content.bullets && content.bullets.length > 0 && (
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {content.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
