import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { authApi } from "../../lib/authApi";

type VerifyState = "verifying" | "success" | "expired";

export default function VerifyEmailPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerifyState>(token ? "verifying" : "expired");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .verifyEmail({ token })
      .then(() => {
        if (!cancelled) setState("success");
      })
      .catch(() => {
        if (!cancelled) setState("expired");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "verifying") {
    return (
      <AuthLayout title="Verifying your email…">
        <p className="field-hint">One moment.</p>
      </AuthLayout>
    );
  }

  if (state === "success") {
    return (
      <AuthLayout title="Email verified" footer={<Link to="/login">Continue to log in</Link>}>
        <div className="banner banner-success" role="status">
          Your email address has been verified.
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Link expired" footer={<Link to="/login">Back to log in</Link>}>
      <div className="banner banner-danger" role="alert">
        This verification link is invalid or has expired.
      </div>
    </AuthLayout>
  );
}
