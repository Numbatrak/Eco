import { useState } from "react";
import { Mail, Send, Loader2, Copy, Check } from "lucide-react";
import { createInvitation } from "../../services/organizationInvitations";
import { OrganizationInvitation } from "../../types/organization";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface InvitationDialogProps {
  organizationId: string;
  organizationName: string;
  onClose: () => void;
  onInvitationCreated: (invitation: OrganizationInvitation) => void;
}

export function InvitationDialog({
  organizationId,
  organizationName,
  onClose,
  onInvitationCreated,
}: InvitationDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<
    "Owner" | "Admin" | "Customer Relations" | "Manager"
  >("Customer Relations");
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInvitation, setCreatedInvitation] =
    useState<OrganizationInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const invitation = await createInvitation(
        organizationId,
        email,
        role,
        expiresInDays
      );
      setCreatedInvitation(invitation);
      onInvitationCreated(invitation);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create invitation";
      console.error("Error creating invitation:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const copyInvitationLink = () => {
    if (!createdInvitation) return;
    const link = `${window.location.origin}/accept-invitation?code=${createdInvitation.invitation_code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyCode = () => {
    if (!createdInvitation) return;
    navigator.clipboard.writeText(createdInvitation.invitation_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const invitationLink = createdInvitation
    ? `${window.location.origin}/accept-invitation?code=${createdInvitation.invitation_code}`
    : "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden border border-border bg-card p-0 shadow-2xl">
        <div className="border-b border-border px-6 py-5">
          <DialogTitle className="text-foreground">
            {createdInvitation ? "Invitation created" : `Invite to ${organizationName}`}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {createdInvitation
              ? "Share the code or link with your teammate."
              : "They will join with the role you assign below."}
          </DialogDescription>
        </div>

        {createdInvitation ? (
          <div className="dialog-body-scroll max-h-standard space-y-4">
            <div className="dialog-readonly-panel space-y-2">
              <Label className="dialog-readonly-label">Invitation code</Label>
              <div className="flex gap-2">
                <code className="dialog-readonly-value min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
                  {createdInvitation.invitation_code}
                </code>
                <Button type="button" variant="outline" size="icon" onClick={copyCode}>
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="dialog-readonly-panel space-y-2">
              <Label className="dialog-readonly-label">Invitation link</Label>
              <div className="flex gap-2">
                <Input readOnly value={invitationLink} className="min-w-0 flex-1 text-sm" />
                <Button type="button" variant="outline" size="icon" onClick={copyInvitationLink}>
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Email: <span className="text-foreground">{createdInvitation.email}</span>
              </p>
              <p>
                Role: <span className="text-foreground">{createdInvitation.role}</span>
              </p>
            </div>
            <DialogFooter className="border-0 p-0 pt-2">
              <Button type="button" className="w-full" onClick={onClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="dialog-body-scroll max-h-standard space-y-4">
              {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="dialog-field-label">
                  Email address
                </Label>
                <div className="dialog-input-icon-wrap">
                  <Mail className="dialog-input-icon" aria-hidden />
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="dialog-field-label">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger className="w-full max-w-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer Relations">Customer Relations</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="dialog-field-label">Expires in (days)</Label>
                <Select
                  value={expiresInDays?.toString() ?? "7"}
                  onValueChange={(v) =>
                    setExpiresInDays(v === "never" ? undefined : Number(v))
                  }
                >
                  <SelectTrigger className="w-full max-w-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="dialog-footer-bar">
              <Button
                type="button"
                variant="outline"
                className="dialog-cancel-button flex-1 sm:flex-none"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 sm:flex-none" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send invite
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
