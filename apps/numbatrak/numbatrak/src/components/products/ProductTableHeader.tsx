import { TableHead, TableHeader, TableRow } from "../ui/table";

export function ProductTableHeader() {
  return (
    <TableHeader>
      <TableRow className="border-b-2 border-border bg-muted/50">
        <TableHead className="px-6 py-4 font-bold text-muted-foreground w-[7rem]">
          Product ID
        </TableHead>
        <TableHead className="px-6 py-4 font-bold text-muted-foreground">
          Product
        </TableHead>
        <TableHead className="px-6 py-4 font-bold text-muted-foreground">
          Stock
        </TableHead>
        <TableHead className="px-6 py-4 font-bold text-muted-foreground">
          Offers
        </TableHead>
        <TableHead className="px-6 py-4 font-bold text-muted-foreground">
          Performance
        </TableHead>
        <TableHead className="px-6 py-4 font-bold text-muted-foreground">
          Status
        </TableHead>
        <TableHead className="px-6 py-4 font-bold text-muted-foreground text-right">
          Actions
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
