import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type PasswordResetRequest = {
  email: string;
};

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function passwordResetTemplate(link: string) {
  const safeLink = escapeHtml(link);
  return {
    subject: "Reset your password - Numbatrak",
    htmlContent: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:24px 28px;background:#0f172a;">
            <div style="font-size:28px;font-weight:800;letter-spacing:-0.04em;">
              <span style="color:#10b981;">Numba</span><span style="color:#ffffff;">trak</span>
            </div>
            <div style="color:#10b981;font-size:13px;margin-top:4px;">Know Your Numbers.</div>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:24px;color:#0f172a;">Reset your password</h1>
            <p style="margin:0 0 18px;color:#334155;line-height:1.6;">A password reset was requested for your account. Click the button below to continue.</p>
            <p style="margin:0 0 20px;">
              <a href="${safeLink}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">Reset Password</a>
            </p>
            <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">If the button does not work, copy and paste this URL into your browser:</p>
            <p style="margin:10px 0 0;word-break:break-all;font-size:12px;color:#0f172a;">${safeLink}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    textContent: `Numbatrak password reset\n\nOpen this link to reset your password:\n${link}\n\nIf you did not request this, ignore this email.`,
  };
}

async function sendBrevoEmail(to: string, subject: string, htmlContent: string, textContent: string) {
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
    const { email } = (await req.json()) as PasswordResetRequest;
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRole) {
      throw new Error("Missing Supabase environment variables");
    }
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
    const redirectTo = `${appUrl}/reset-password`;

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: email.toLowerCase().trim(),
      options: { redirectTo },
    });

    if (error) {
      // Never leak whether email exists; always return success-ish response.
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionLink = data?.properties?.action_link;
    if (actionLink) {
      const tpl = passwordResetTemplate(actionLink);
      await sendBrevoEmail(email.toLowerCase().trim(), tpl.subject, tpl.htmlContent, tpl.textContent);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
