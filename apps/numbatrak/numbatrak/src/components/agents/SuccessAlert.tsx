import { CheckCircle2, X } from "lucide-react";

interface SuccessAlertProps {
  message: string;
  onClose?: () => void;
}

export function SuccessAlert({ message, onClose }: SuccessAlertProps) {
  return (
    <div className="page-alert success" role="status">
      <div className="page-alert-icon success">
        <CheckCircle2 className="h-5 w-5" aria-hidden />
      </div>
      <p className="page-alert-message success">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="page-alert-dismiss"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
