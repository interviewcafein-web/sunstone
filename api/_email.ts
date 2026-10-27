// Sends email through Resend's HTTP API (https://resend.com). Configure:
//   RESEND_API_KEY  the API key
//   EMAIL_FROM      the sender, on a domain verified in Resend,
//                   e.g. "Sunstone PRIME Vertex <noreply@vertex.sunstone.in>"
// Locally, without RESEND_API_KEY, the email is printed to the dev server's terminal instead,
// so sign-in codes can be tried without sending anything.

export const canSendEmail = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || !process.env.VERCEL;

interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail({ to, subject, text, html }: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    if (process.env.VERCEL)
      throw new Error('Email is not configured (RESEND_API_KEY, EMAIL_FROM).');
    console.log(`\n[email to ${to}] ${subject}\n${text}\n`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}

/** The sign-in code email: plain, with the code large and nothing else to click. */
export function signInCodeEmail(code: string, minutes: number) {
  const subject = `${code} is your Sunstone PRIME Vertex sign-in code`;
  const text = `Your sign-in code is ${code}

It expires in ${minutes} minutes. If you did not try to sign in, you can ignore this email.

Sunstone PRIME Vertex`;
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#1a3e70;padding:20px 28px;color:#ffffff;font-size:16px;font-weight:bold">Sunstone PRIME <span style="color:#f59e0b">Vertex</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:15px">Your sign-in code is</p>
<p style="margin:0 0 20px;font-size:34px;font-weight:bold;letter-spacing:8px;color:#1a3e70">${code}</p>
<p style="margin:0;font-size:13px;color:#64748b">It expires in ${minutes} minutes. If you did not try to sign in, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
