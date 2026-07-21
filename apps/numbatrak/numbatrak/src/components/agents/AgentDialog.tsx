import { FormEvent, useRef } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { DialogHeader } from "./DialogHeader";
import { DialogFooter } from "./DialogFooter";
import { ErrorAlert } from "./ErrorAlert";
import { AgentNameInput } from "./AgentNameInput";
import { LocationSelector } from "./LocationSelector";
import { Label } from "../ui/label";
import { Input } from "../ui/input";

interface AgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  agentName: string;
  onAgentNameChange: (name: string) => void;
  selectedLocations: string[];
  onLocationsChange: (locations: string[]) => void;
  contactPerson: string;
  onContactPersonChange: (value: string) => void;
  contactPhone: string;
  onContactPhoneChange: (value: string) => void;
  contactEmail: string;
  onContactEmailChange: (value: string) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function AgentDialog({
  open,
  onOpenChange,
  mode,
  agentName,
  onAgentNameChange,
  selectedLocations,
  onLocationsChange,
  contactPerson,
  onContactPersonChange,
  contactPhone,
  onContactPhoneChange,
  contactEmail,
  onContactEmailChange,
  error,
  saving,
  onSubmit,
}: AgentDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmitClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <DialogHeader mode={mode} />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
            {error && <ErrorAlert message={error} />}

            <AgentNameInput value={agentName} onChange={onAgentNameChange} />

            <LocationSelector
              selectedLocations={selectedLocations}
              onLocationsChange={onLocationsChange}
            />

            <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Contact</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Optional — how your team reaches this delivery partner.
                </p>
              </div>

              <div className="dialog-form-field space-y-2">
                <Label htmlFor="contact-person" className="dialog-field-label">
                  Contact person
                </Label>
                <Input
                  id="contact-person"
                  type="text"
                  value={contactPerson}
                  onChange={(e) => onContactPersonChange(e.target.value)}
                  placeholder="e.g. John at Gologistics"
                  className="w-full max-w-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="contact-phone" className="dialog-field-label">
                    Phone / WhatsApp
                  </Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => onContactPhoneChange(e.target.value)}
                    placeholder="08012345678"
                    className="w-full max-w-none"
                  />
                </div>

                <div className="dialog-form-field space-y-2">
                  <Label htmlFor="contact-email" className="dialog-field-label">
                    Email
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => onContactEmailChange(e.target.value)}
                    placeholder="agent@example.com"
                    className="w-full max-w-none"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <DialogFooter
          mode={mode}
          saving={saving}
          disabled={saving || !agentName.trim()}
          onSubmit={handleSubmitClick}
        />
      </DialogContent>
    </Dialog>
  );
}
