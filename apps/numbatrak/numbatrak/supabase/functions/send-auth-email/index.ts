import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SendAuthEmailPayload =
  | {
      type: "invitation";
      to: string;
      organizationName: string;
      role: string;
      invitationCode: string;
      expiresAt?: string | null;
      invitedByName?: string | null;
    };

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function invitationTemplate(payload: Extract<SendAuthEmailPayload, { type: "invitation" }>) {
  const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
  const invitationLink = `${appUrl}/accept-invitation?code=${encodeURIComponent(payload.invitationCode)}`;
  const org = escapeHtml(payload.organizationName);
  const role = escapeHtml(payload.role);
  const inviter = payload.invitedByName ? escapeHtml(payload.invitedByName) : "your team";
  const expiryText = payload.expiresAt
    ? `This invitation expires on ${new Date(payload.expiresAt).toLocaleDateString("en-NG")}.`
    : "This invitation does not expire.";

  return {
    subject: `You are invited to join ${payload.organizationName} on Numbatrak`,
    htmlContent: `<!doctype html>
<html><body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Segoe UI,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:16px;overflow:hidden;">
<tr><td style="padding:24px 28px;background:#0f172a;">
  <div style="font-size:28px;font-weight:800;letter-spacing:-0.04em;"><span style="color:#10b981;">Numba</span><span style="color:#fff;">trak</span></div>
  <div style="color:#10b981;font-size:13px;margin-top:4px;">Know Your Numbers.</div>
</td></tr>
<tr><td style="padding:28px;">
  <h1 style="margin:0 0 12px;font-size:24px;color:#0f172a;">You have been invited</h1>
  <p style="margin:0 0 14px;color:#334155;line-height:1.6;">${inviter} invited you to join <strong>${org}</strong> as <strong>${role}</strong>.</p>
  <p style="margin:0 0 16px;color:#475569;font-size:14px;">${escapeHtml(expiryText)}</p>
  <p style="margin:0 0 20px;"><a href="${escapeHtml(invitationLink)}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">Accept Invitation</a></p>
  <p style="margin:0;color:#64748b;font-size:13px;">Invitation code:</p>
  <p style="margin:6px 0 0;font-family:ui-monospace,Consolas,monospace;font-size:18px;color:#0f172a;">${escapeHtml(payload.invitationCode)}</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
    textContent: `Numbatrak invitation

${inviter} invited you to join ${payload.organizationName} as ${payload.role}.
Accept here: ${invitationLink}
Invitation code: ${payload.invitationCode}
${expiryText}`,
  };
}

async function sendBrevoEmail(to: string, subject: string, htmlContent: string, textContent: string) {
  const senderEmail = Deno.env.get("EMAIL_FROM_ADDRESS") || "numbatrak@gmail.com";
  const senderName = Deno.env.get("EMAIL_FROM_NAME") || "Numbatrak";
  const smtpKey = Deno.env.get("BREVO_SMTP_KEY");
  const apiKey = Deno.env.get("BREVO_API_KEY");
  const primaryKey = smtpKey || apiKey;
  const fallbackKey = smtpKey && apiKey ? apiKey : null;

  if (!primaryKey) throw new Error("Brevo credentials are not configured");

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
  if (!res.ok && fallbackKey) res = await send(fallbackKey);
  if (!res.ok) throw new Error(`Brevo send failed: ${await res.text()}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendAuthEmailPayload;
    if (body.type !== "invitation") {
      return new Response(JSON.stringify({ error: "Unsupported email type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tpl = invitationTemplate(body);
    await sendBrevoEmail(body.to.toLowerCase().trim(), tpl.subject, tpl.htmlContent, tpl.textContent);

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
