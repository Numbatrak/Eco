/**
 * HTML email templates with a shared layout.
 *
 * Every template returns a full HTML string ready to pass to SES.
 * The shared `layout()` wrapper provides consistent branding, responsive
 * styling, and dark-mode support across all transactional emails.
 */

const BRAND_COLOR = "#6366f1";
const BRAND_NAME = "Numbatrak";

function layout(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${BRAND_NAME}</title>
<style>
  body { margin: 0; padding: 0; background: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .wrapper { width: 100%; background: #f4f4f7; padding: 40px 0; }
  .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .header { background: ${BRAND_COLOR}; padding: 28px 40px; text-align: center; }
  .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
  .body { padding: 36px 40px; color: #374151; font-size: 15px; line-height: 1.7; }
  .body p { margin: 0 0 16px; }
  .btn { display: inline-block; background: ${BRAND_COLOR}; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 8px 0 16px; }
  .code-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 16px 0; }
  .code { font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111827; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; }
  .order-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .order-table td { padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
  .order-table td:last-child { text-align: right; font-weight: 600; }
  .order-total td { border-bottom: none; border-top: 2px solid #e5e7eb; font-size: 16px; font-weight: 700; }
  .footer { padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; }
  .footer a { color: #9ca3af; }
  .muted { color: #6b7280; font-size: 13px; }
  @media (prefers-color-scheme: dark) {
    .wrapper { background: #1f2937 !important; }
    .container { background: #111827 !important; }
    .body { color: #d1d5db !important; }
    .code-box { background: #1f2937 !important; border-color: #374151 !important; }
    .code { color: #f9fafb !important; }
    .footer { border-color: #374151 !important; }
  }
  @media only screen and (max-width: 600px) {
    .body, .header, .footer { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body>
${preheader ? `<div style="display:none;font-size:1px;color:#f4f4f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
<div class="wrapper">
  <div class="container">
    <div class="header"><h1>${BRAND_NAME}</h1></div>
    <div class="body">${content}</div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
    </div>
  </div>
</div>
</body>
</html>`;
}

export function passwordResetEmail(resetUrl: string): string {
  return layout(
    `<p>Hi there,</p>
<p>We received a request to reset your password. Click the button below to choose a new one:</p>
<p style="text-align:center"><a href="${resetUrl}" class="btn">Reset Password</a></p>
<p class="muted">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
<p class="muted" style="word-break:break-all;">Or copy this link: ${resetUrl}</p>`,
    "Reset your password",
  );
}

export function otpEmail(otp: string): string {
  return layout(
    `<p>Hi there,</p>
<p>Use the code below to verify your identity:</p>
<div class="code-box"><span class="code">${otp}</span></div>
<p class="muted">This code expires in 5 minutes. If you didn't request this, please secure your account immediately.</p>`,
    `Your verification code is ${otp}`,
  );
}

export function orderConfirmationEmail(params: {
  customerName: string;
  orderNumber: string;
  amount: string;
  currency: string;
}): string {
  return layout(
    `<p>Hi ${params.customerName},</p>
<p>Thank you for your order! Here's your confirmation:</p>
<table class="order-table">
  <tr><td>Order Number</td><td>#${params.orderNumber}</td></tr>
  <tr class="order-total"><td>Total</td><td>${params.currency} ${params.amount}</td></tr>
</table>
<p>We'll notify you when your order is on its way.</p>
<p>Thanks for shopping with us!</p>`,
    `Order #${params.orderNumber} confirmed`,
  );
}

export function organizationInvitationEmail(params: {
  organizationName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}): string {
  return layout(
    `<p>Hi there,</p>
<p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.organizationName}</strong> on ${BRAND_NAME} as a <strong>${params.role}</strong>.</p>
<p style="text-align:center"><a href="${params.acceptUrl}" class="btn">Accept Invitation</a></p>
<p class="muted">If you weren't expecting this invitation, you can safely ignore this email.</p>
<p class="muted" style="word-break:break-all;">Or copy this link: ${params.acceptUrl}</p>`,
    `${params.inviterName} invited you to join ${params.organizationName}`,
  );
}

export function testEmail(): string {
  return layout(
    `<p>Hi there,</p>
<p>This is a test email from ${BRAND_NAME}. If you're reading this, your email integration is working correctly.</p>
<p style="text-align:center"><a href="#" class="btn">Looking Good!</a></p>
<p class="muted">This is an automated test — no action is required.</p>`,
    "Test email from " + BRAND_NAME,
  );
}
