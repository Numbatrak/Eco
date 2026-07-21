import { FormEvent, useRef } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { FileText } from "lucide-react";
import { DialogFooter } from "../agents/DialogFooter";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Form } from "../../types/form";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  form: Form | null;
  formName: string;
  onFormNameChange: (name: string) => void;
  formToken: string;
  onFormTokenChange: (token: string) => void;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function FormDialog({
  open,
  onOpenChange,
  mode,
  form,
  formName,
  onFormNameChange,
  formToken,
  onFormTokenChange,
  active,
  onActiveChange,
  error,
  saving,
  onSubmit,
}: FormDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmitClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<FileText className="h-7 w-7" aria-hidden />}
          title={mode === "create" ? "Create New Form" : "Edit Form"}
          description={
            mode === "create"
              ? "Create a new form for order collection"
              : "Update form details"
          }
        />

        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="dialog-body-scroll max-h-standard space-y-6"
        >
          {error && <ErrorAlert message={error} />}

          <div className="space-y-4">
            <div>
              <Label htmlFor="form-name" className="text-base font-semibold">
                Form Name
              </Label>
              <Input
                id="form-name"
                type="text"
                value={formName}
                onChange={(e) => onFormNameChange(e.target.value)}
                placeholder="e.g., Product Order Form"
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label htmlFor="form-token" className="text-base font-semibold">
                Form Token
              </Label>
              <Input
                id="form-token"
                type="text"
                value={formToken}
                onChange={(e) => onFormTokenChange(e.target.value)}
                placeholder="e.g., form_live_abc123"
                className="mt-2 font-mono text-sm"
                required
                disabled={mode === "edit"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {mode === "create"
                  ? "Unique token for embedding this form (cannot be changed later)"
                  : "Form token cannot be changed"}
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="form-active" className="text-base font-semibold">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Only active forms can be embedded and used
                </p>
              </div>
              <Switch
                id="form-active"
                checked={active}
                onCheckedChange={onActiveChange}
              />
            </div>
          </div>

          <DialogFooter
            onCancel={() => onOpenChange(false)}
            onConfirm={handleSubmitClick}
            confirmLabel={mode === "create" ? "Create Form" : "Save Changes"}
            saving={saving}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
