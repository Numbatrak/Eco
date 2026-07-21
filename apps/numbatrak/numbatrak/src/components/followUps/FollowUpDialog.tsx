import { FormEvent, useRef, useState, useEffect } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { Pencil, Plus } from "lucide-react";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { FollowUpWithRelations, FollowUpStatus, FollowUpPriority, FollowUpOutcome } from "../../types/followUp";
import { formatWorkHours, meetsSLA } from "../../utils/workHours";
import { normalizeFollowUpStatus } from "../../utils/followUpStatus";
import { fetchCustomerRelationsUsers } from "../../services/customerRelations";
import { UserProfile } from "../../types/user";
import { usePermissions } from "../../hooks/usePermissions";
import { useOrganization } from "../../contexts/OrganizationContext";
import { formatCsrSelectLabel } from "../../utils/userDisplay";
import { CsrUserOption } from "../users/CsrUserOption";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followUp: FollowUpWithRelations | null;
  orderId?: string | null;
  abandonedCartId?: string | null;
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  mode: "create" | "edit";
}

export function FollowUpDialog({
  open,
  onOpenChange,
  followUp,
  orderId,
  abandonedCartId,
  error,
  saving,
  onSubmit,
  mode,
}: FollowUpDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { currentOrganization } = useOrganization();
  const { hasPermission, userRole } = usePermissions();
  const [status, setStatus] = useState<FollowUpStatus>("awaiting");
  const [priority, setPriority] = useState<FollowUpPriority>("medium");
  const [outcome, setOutcome] = useState<FollowUpOutcome | "">("");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [csrUsers, setCsrUsers] = useState<UserProfile[]>([]);
  const [loadingCsrUsers, setLoadingCsrUsers] = useState(false);
  
  // Check if user can reassign follow-ups (Owner, Admin, Manager)
  const canReassign = hasPermission("orders", "canViewAll") || hasPermission("orders", "canManage");

  // Valid outcome values
  const validOutcomes: FollowUpOutcome[] = ["converted", "not_converted"];

  // Load CSR users when dialog opens (if user can reassign)
  useEffect(() => {
    if (open && canReassign) {
      loadCsrUsers();
    }
  }, [open, canReassign, currentOrganization?.id]);

  const loadCsrUsers = async () => {
    if (!currentOrganization) {
      setCsrUsers([]);
      return;
    }
    try {
      setLoadingCsrUsers(true);
      const users = await fetchCustomerRelationsUsers(currentOrganization.id);
      setCsrUsers(users);
    } catch (err) {
      console.error("Error loading CSR users:", err);
    } finally {
      setLoadingCsrUsers(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (followUp && mode === "edit") {
        setStatus(normalizeFollowUpStatus(followUp.status));
        setPriority(followUp.priority);
        // Validate outcome - if it's not a valid value, set to empty string
        const outcomeValue = followUp.outcome || "";
        const isValidOutcome = validOutcomes.includes(outcomeValue as FollowUpOutcome);
        setOutcome(isValidOutcome ? (outcomeValue as FollowUpOutcome) : "");
        setNotes(followUp.notes || "");
        setAssignedTo(followUp.assigned_to || "");
      } else {
        // Reset for create mode
        setStatus("awaiting");
        setPriority("medium");
        setOutcome("");
        setNotes("");
        setAssignedTo("");
      }
    }
  }, [open, followUp, mode]);

  const handleSubmitClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  const responseTime = followUp?.response_time_minutes;
  const resolutionTime = followUp?.resolution_time_minutes;
  const slaMet = responseTime !== null && responseTime !== undefined ? meetsSLA(responseTime) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={
            mode === "edit" ? (
              <Pencil className="h-7 w-7" aria-hidden />
            ) : (
              <Plus className="h-7 w-7" aria-hidden />
            )
          }
          title={mode === "edit" ? "Edit Follow-Up" : "Create Follow-Up"}
          description={
            mode === "edit"
              ? "Update follow-up information"
              : "Track customer follow-up activity"
          }
        />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
            {error && <ErrorAlert message={error} />}

            {/* Customer Information */}
            {(followUp || orderId || abandonedCartId) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Customer Information
                </h3>
                <div className="p-4 bg-muted/40 rounded-lg border border-border">
                  {followUp?.order_id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                          Order #{followUp.order_id}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground">Customer Name</Label>
                          <p className="text-sm text-foreground font-medium">
                            {followUp.order_customer_name || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground">Phone Number</Label>
                          <p className="text-sm text-foreground">
                            {followUp.order_customer_phone || "N/A"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs font-semibold text-muted-foreground">Location</Label>
                          <p className="text-sm text-foreground">
                            {followUp.order_customer_location || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : followUp?.abandoned_cart_id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                          Abandoned Cart #{followUp.abandoned_cart_id}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground">Customer Name</Label>
                          <p className="text-sm text-foreground font-medium">
                            {followUp.cart_customer_name || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground">Phone Number</Label>
                          <p className="text-sm text-foreground">
                            {followUp.cart_customer_phone || followUp.cart_customer_whatsapp || "N/A"}
                          </p>
                        </div>
                        {followUp.cart_customer_whatsapp && followUp.cart_customer_phone && (
                          <div>
                            <Label className="text-xs font-semibold text-muted-foreground">WhatsApp</Label>
                            <p className="text-sm text-foreground">
                              {followUp.cart_customer_whatsapp}
                            </p>
                          </div>
                        )}
                        <div className="col-span-2">
                          <Label className="text-xs font-semibold text-muted-foreground">Location</Label>
                          <p className="text-sm text-foreground">
                            {followUp.cart_customer_location || followUp.cart_customer_state || "N/A"}
                          </p>
                        </div>
                        {followUp.cart_customer_address && (
                          <div className="col-span-2">
                            <Label className="text-xs font-semibold text-muted-foreground">Delivery Address</Label>
                            <p className="text-sm text-foreground">
                              {followUp.cart_customer_address}
                              {followUp.cart_customer_state && `, ${followUp.cart_customer_state}`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {orderId ? `Order #${orderId}` : abandonedCartId ? `Abandoned Cart #${abandonedCartId}` : "No reference"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reference Information (Create Mode Only) */}
            {mode === "create" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Reference
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {orderId && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">
                        Order ID
                      </Label>
                      <Input
                        type="text"
                        value={orderId}
                        disabled
                        className="bg-muted/50"
                      />
                      <input type="hidden" name="order_id" value={orderId || ""} />
                    </div>
                  )}
                  {abandonedCartId && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-foreground">
                        Abandoned Cart ID
                      </Label>
                      <Input
                        type="text"
                        value={abandonedCartId}
                        disabled
                        className="bg-muted/50"
                      />
                      <input type="hidden" name="abandoned_cart_id" value={abandonedCartId || ""} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status and Priority */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                Status & Priority
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-semibold text-foreground">
                    Status *
                  </Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as FollowUpStatus)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="awaiting">Awaiting follow-up</SelectItem>
                      <SelectItem value="followed_up">Followed up</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="status" value={status} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-sm font-semibold text-foreground">
                    Priority *
                  </Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as FollowUpPriority)}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="priority" value={priority} />
                </div>
              </div>
            </div>

            {/* Assignment (Only for Owner/Admin/Manager) */}
            {canReassign && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Assignment
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="assigned_to" className="text-sm font-semibold text-foreground">
                    Assign to Customer Relations Rep
                  </Label>
                  <Select
                    value={assignedTo || ""}
                    onValueChange={(value) => setAssignedTo(value || "")}
                    disabled={loadingCsrUsers}
                  >
                    <SelectTrigger id="assigned_to">
                      <SelectValue placeholder={loadingCsrUsers ? "Loading..." : "Select a CSR (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {csrUsers.map((csr) => (
                        <SelectItem
                          key={csr.id}
                          value={csr.id}
                          textValue={formatCsrSelectLabel(csr)}
                        >
                          <CsrUserOption
                            full_name={csr.full_name}
                            email={csr.email}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="assigned_to" value={assignedTo || ""} />
                  {followUp &&
                    (followUp.assigned_user_name ||
                      followUp.assigned_user_email) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Currently assigned to:{" "}
                      {followUp.assigned_user_name || "Unnamed CSR"}
                      {followUp.assigned_user_email
                        ? ` (${followUp.assigned_user_email})`
                        : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Metrics Display (Edit Mode Only) */}
            {mode === "edit" && followUp && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Performance Metrics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <Label className="text-sm font-semibold text-foreground">
                      Response Time
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-foreground">
                        {formatWorkHours(responseTime)}
                      </span>
                      {slaMet !== null && (
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            slaMet
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {slaMet ? "SLA Met" : "SLA Missed"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Time to first contact (work hours: 9 AM - 5 PM)
                    </p>
                  </div>
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                    <Label className="text-sm font-semibold text-foreground">
                      Resolution Time
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-foreground">
                        {formatWorkHours(resolutionTime)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Time to complete (work hours: 9 AM - 5 PM)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Outcome (Only for resolved status) */}
            {status === "resolved" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                  Outcome
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="outcome" className="text-sm font-semibold text-foreground">
                    Outcome *
                  </Label>
                  <Select
                    value={outcome || ""}
                    onValueChange={(value) => {
                      // Only set if it's a valid outcome value
                      if (value === "" || validOutcomes.includes(value as FollowUpOutcome)) {
                        setOutcome(value as FollowUpOutcome);
                      } else {
                        // If invalid, set to empty string
                        setOutcome("");
                      }
                    }}
                  >
                    <SelectTrigger id="outcome">
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="not_converted">Not converted</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="outcome" value={outcome || ""} />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">
                Notes
              </h3>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-semibold text-foreground">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about the follow-up interaction..."
                />
              </div>
            </div>

            {/* Hidden fields */}
            <input type="hidden" name="notes" value={notes} />
          </form>
        </div>

        <div className="dialog-footer-bar">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="dialog-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={saving || (status === "resolved" && !outcome)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-primary-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {mode === "edit" ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {mode === "edit" ? "Update Follow-Up" : "Create Follow-Up"}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

