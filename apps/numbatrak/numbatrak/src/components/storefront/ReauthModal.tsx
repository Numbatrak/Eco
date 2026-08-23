import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { PasswordField } from "./PasswordField";
import { OtpInput } from "./OtpInput";
import { ApiError } from "../../lib/apiClient";

const reauthRequireCodeSchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: z.string().min(1, "Code is required"),
});
const reauthPasswordOnlySchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: z.string(),
});

export interface ReauthFormValues {
  password: string;
  code: string;
}

export interface ReauthModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  requireCode?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (values: ReauthFormValues) => Promise<void>;
}

export function ReauthModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  requireCode = true,
  danger = true,
  onCancel,
  onConfirm,
}: ReauthModalProps): React.ReactElement {
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = useMemo(
    () => (requireCode ? reauthRequireCodeSchema : reauthPasswordOnlySchema),
    [requireCode],
  );
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReauthFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", code: "" },
  });

  function handleCancel(): void {
    reset();
    setServerError(null);
    onCancel();
  }

  async function submit(values: ReauthFormValues): Promise<void> {
    setServerError(null);
    try {
      await onConfirm(values);
      reset();
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.message : "Something went wrong. Try again.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          {requireCode ? (
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <OtpInput
                  label="Current 2FA code"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.code?.message}
                />
              )}
            />
          ) : null}
          {serverError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {serverError}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" variant={danger ? "destructive" : "default"} disabled={isSubmitting}>
              {isSubmitting ? "Confirming…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
