import { CheckCircle2, X } from "lucide-react";

interface SuccessNotificationProps {
  message: string;
  onClose: () => void;
}

export function SuccessNotification({
  message,
  onClose,
}: SuccessNotificationProps) {
  return (
    <div className="page-toast" role="status" aria-live="polite">
      <div className="page-toast-panel success">
        <div className="page-toast-icon success">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
        <p className="page-toast-message">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="page-toast-dismiss"
          aria-label="Dismiss notification"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
