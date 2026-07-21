import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type RegisterUserRequest = {
  email: string;
  password: string;
};

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function verificationTemplate(email: string, otpCode: string) {
  const safeOtp = escapeHtml(otpCode);
  return {
    subject: "Verify your email - Numbatrak",
    htmlContent: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;">
                <div style="font-size:28px;font-weight:800;letter-spacing:-0.04em;">
                  <span style="color:#10b981;">Numba</span><span style="color:#ffffff;">trak</span>
                </div>
                <div style="color:#10b981;font-size:13px;margin-top:4px;">Know Your Numbers.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:24px;color:#0f172a;">Welcome to Numbatrak</h1>
                <p style="margin:0 0 18px;color:#334155;line-height:1.6;">Use the code below to verify your email and finish setting up your account.</p>
                <div style="border:2px dashed #10b981;border-radius:12px;background:#f8fafc;padding:18px;text-align:center;">
                  <div style="font-size:36px;letter-spacing:8px;font-weight:800;color:#0f172a;font-family:ui-monospace,Consolas,monospace;">${safeOtp}</div>
                  <div style="margin-top:8px;color:#b91c1c;font-size:13px;">Expires in 15 minutes</div>
                </div>
                <p style="margin:18px 0 0;color:#475569;line-height:1.6;">If you did not create this account, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#f8fafc;color:#64748b;font-size:12px;">
                This is an automated email from Numbatrak.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    textContent: `Numbatrak - Verify your email

Your verification code is: ${otpCode}
This code expires in 15 minutes.

If you did not create this account, ignore this email.`,
  };
}

async function sendBrevoEmail(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string,
) {
  const senderEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "numbatrak@gmail.com";
  const senderName = Deno.env.get("EMAIL_FROM_NAME") || "Numbatrak";
  const smtpKey = Deno.env.get("BREVO_SMTP_KEY");
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const primaryKey = smtpKey || apiKey;
  const fallbackKey = smtpKey && apiKey ? apiKey : null;

  if (!primaryKey) {
    throw new Error("Brevo credentials are not configured");
  }

  const send = async (key: string) =>
    fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": key },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent,
      }),
    });

  let res = await send(primaryKey);
  if (!res.ok && fallbackKey) {
    res = await send(fallbackKey);
  }
  if (!res.ok) {
    throw new Error(`Brevo send failed: ${await res.text()}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = (await req.json()) as RegisterUserRequest;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRole) {
      throw new Error("Missing Supabase environment variables");
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
      });

    if (createError) {
      const message = createError.message.toLowerCase();
      if (
        message.includes("already") ||
        message.includes("registered") ||
        message.includes("exists")
      ) {
        return new Response(
          JSON.stringify({ error: "An account with this email already exists" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw createError;
    }

    const userId = created.user?.id;
    if (!userId) {
      throw new Error("Failed to create user account");
    }

    const { data: otpCode, error: otpError } = await admin.rpc(
      "create_verification_otp",
      {
        p_email: normalizedEmail,
        p_user_id: userId,
      },
    );

    if (otpError || !otpCode) {
      throw otpError ?? new Error("Failed to create verification code");
    }

    const tpl = verificationTemplate(normalizedEmail, otpCode);
    await sendBrevoEmail(
      normalizedEmail,
      tpl.subject,
      tpl.htmlContent,
      tpl.textContent,
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
