import { Table, TableBody } from "../ui/table";
import { Form } from "../../types/form";
import { Search, ArrowUp, ArrowDown, Edit, Trash2, Copy, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { useClientPagination } from "../../hooks/useClientPagination";
import { TablePagination } from "../ui/TablePagination";
import { LoadingState } from "../ui/LoadingState";

interface FormTableProps {
  forms: Form[];
  loading: boolean;
  error: string | null;
  onEdit: (form: Form) => void;
  onDelete: (formId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function FormTable({
  forms,
  loading,
  error,
  onEdit,
  onDelete,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  canEdit = true,
  canDelete = true,
}: FormTableProps) {
  const filteredForms = forms.filter((form) =>
    form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    form.form_token.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedForms = [...filteredForms].sort((a, b) => {
    const comparison = a.name.localeCompare(b.name);
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
  } = useClientPagination(sortedForms);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Shortcode copied to clipboard!", {
        description: text,
        duration: 3000,
      });
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        toast.success("Shortcode copied to clipboard!", {
          description: text,
          duration: 3000,
        });
      } catch (err) {
        toast.error("Failed to copy shortcode");
      }
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <LoadingState label="Loading forms…" size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-destructive/20 rounded-xl shadow-sm p-12 text-center">
        <p className="text-destructive font-semibold">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-4 mb-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-foreground font-bold text-lg">Forms</h2>
              <p className="text-muted-foreground text-xs font-medium">
                {sortedForms.length} form{sortedForms.length !== 1 ? "s" : ""} found
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search forms..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 border border-border bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm w-64 text-foreground transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1">
              <button
                onClick={() => onSortChange(sortOrder === "asc" ? "desc" : "asc")}
                className="p-2 hover:bg-accent hover:text-accent-foreground text-muted-foreground rounded transition-colors"
                title={`Sort ${sortOrder === "asc" ? "descending" : "ascending"}`}
              >
                {sortOrder === "asc" ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Table>
        <TableBody>
          {paginatedItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-12 text-muted-foreground">
                No forms found. Create your first form to get started.
              </td>
            </tr>
          ) : (
            paginatedItems.map((form) => (
              <tr
                key={form.id}
                className="border-b border-border hover:bg-accent/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <svg
                        className="w-5 h-5 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{form.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-1">
                        {form.form_token}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {form.active ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <span className="text-sm text-primary font-medium">Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground font-medium">Inactive</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(`[crm_form form="${form.form_token}"]`)}
                    className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy Shortcode
                  </Button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(form)}
                        className="text-primary hover:text-primary-foreground hover:bg-primary bg-primary/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(form.id)}
                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </TableBody>
      </Table>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
