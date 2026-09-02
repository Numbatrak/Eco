import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";

interface PageHeaderProps {
  onTransfer: () => void;
  onAdjust: () => void;
}

export function PageHeader({ onTransfer, onAdjust }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground text-sm">
          Products × agents stock grid from the ledger — warehouse, transfers,
          and shrinkage
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" onClick={onTransfer}>
          <ArrowRightLeft className="w-4 h-4 mr-2" />
          Transfer stock
        </Button>
        <Button type="button" variant="outline" onClick={onAdjust}>
          <AlertTriangle className="w-4 h-4 mr-2" />
          Mark damaged / missing
        </Button>
      </div>
    </div>
  );
}
