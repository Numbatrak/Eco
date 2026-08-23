import { Label } from "../ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";

export interface OtpInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function OtpInput({ label, value, onChange, error }: OtpInputProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <InputOTP maxLength={6} value={value} onChange={onChange}>
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, i) => (
            <InputOTPSlot key={i} index={i} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
