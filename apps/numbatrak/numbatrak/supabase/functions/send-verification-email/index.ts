import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type VerificationPayload = {
  email: string;
  otp_code: string;
  user_name?: string;
};

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function verificationTemplate(payload: VerificationPayload): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const name = payload.user_name?.trim() || "there";
  const safeName = escapeHtml(name);
  const safeOtp = escapeHtml(payload.otp_code);

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
                <h1 style="margin:0 0 12px;font-size:24px;color:#0f172a;">Verify your email</h1>
                <p style="margin:0 0 18px;color:#334155;line-height:1.6;">Hi ${safeName}, use the code below to verify your Numbatrak account.</p>
                <div style="border:2px dashed #10b981;border-radius:12px;background:#f8fafc;padding:18px;text-align:center;">
                  <div style="font-size:36px;letter-spacing:8px;font-weight:800;color:#0f172a;font-family:ui-monospace,Consolas,monospace;">${safeOtp}</div>
                  <div style="margin-top:8px;color:#b91c1c;font-size:13px;">Expires in 15 minutes</div>
                </div>
                <p style="margin:18px 0 0;color:#475569;line-height:1.6;">If you did not request this, you can safely ignore this email.</p>
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

Hi ${name},

Your verification code is: ${payload.otp_code}
This code expires in 15 minutes.

If you did not request this, ignore this email.`,
  };
}

async function sendViaBrevoSMTPApi(opts: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}) {
  const smtpKey = Deno.env.get("BREVO_SMTP_KEY");
  if (!smtpKey) {
    return { ok: false as const, reason: "BREVO_SMTP_KEY missing" };
  }

  const senderEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "numbatrak@gmail.com";
  const senderName = Deno.env.get("EMAIL_FROM_NAME") || "Numbatrak";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": smtpKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.htmlContent,
      textContent: opts.textContent,
    }),
  });

  if (!res.ok) {
    return { ok: false as const, reason: await res.text() };
  }
  return { ok: true as const };
}

async function sendViaBrevoApiFallback(opts: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    return { ok: false as const, reason: "BREVO_API_KEY missing" };
  }

  const senderEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "numbatrak@gmail.com";
  const senderName = Deno.env.get("EMAIL_FROM_NAME") || "Numbatrak";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.htmlContent,
      textContent: opts.textContent,
    }),
  });

  if (!res.ok) {
    return { ok: false as const, reason: await res.text() };
  }
  return { ok: true as const };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as VerificationPayload;
    if (!body.email || !body.otp_code) {
      return new Response(JSON.stringify({ error: "Missing email or otp_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = verificationTemplate(body);
    const primary = await sendViaBrevoSMTPApi({
      to: body.email.toLowerCase().trim(),
      ...template,
    });
    if (!primary.ok) {
      const fallback = await sendViaBrevoApiFallback({
        to: body.email.toLowerCase().trim(),
        ...template,
      });
      if (!fallback.ok) {
        return new Response(
          JSON.stringify({
            error: "Failed to send verification email",
            smtpReason: primary.reason,
            fallbackReason: fallback.reason,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
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
