import { AlertCircle, X } from "lucide-react";

interface ErrorAlertProps {
  message: string;
  onClose?: () => void;
}

export function ErrorAlert({ message, onClose }: ErrorAlertProps) {
  return (
    <div className="page-alert error" role="alert">
      <div className="page-alert-icon error">
        <AlertCircle className="h-5 w-5" aria-hidden />
      </div>
      <p className="page-alert-message error">{message}</p>
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
