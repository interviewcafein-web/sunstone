// Sends email through Resend's HTTP API (https://resend.com). Configure:
//   RESEND_API_KEY  the API key
//   EMAIL_FROM      the sender, on a domain verified in Resend,
//                   e.g. "Sunstone PRIME Vertex <noreply@vertex.sunstone.in>"
// Locally, without RESEND_API_KEY, the email is printed to the dev server's terminal instead,
// so sign-in codes can be tried without sending anything.

export const canSendEmail = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || !process.env.VERCEL;

export interface Email {
  to: string | string[];
  /** Copied in (e.g. HQ on a campus email). */
  cc?: string[];
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail({ to, cc, subject, text, html }: Email): Promise<void> {
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
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      ...(cc?.length ? { cc } : {}),
      subject,
      text,
      html,
    }),
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

export const SITE = 'https://vertex.sunstone.in';

export const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export interface WelcomeDetails {
  /** First name or full name; the greeting falls back to "Hi there". */
  name?: string | null;
  email: string;
  /** "Super admin", "HQ" or "Campus". */
  roleLabel: string;
  /** Campus names for campus staff; empty means every campus. */
  campuses: string[];
  /** Who gave them access, when added on the Team page. */
  addedBy?: string | null;
}

/**
 * The onboarding email: what Vertex is, what this person can see, how to sign in. Built
 * with tables and inline styles so it renders in Gmail, Outlook and phone mail apps; the
 * images are on the live site, with alt text for clients that block them.
 */
export function welcomeEmail({ name, email, roleLabel, campuses, addedBy }: WelcomeDetails) {
  const first = name?.trim().split(/\s+/)[0];
  const hello = first ? `Hi ${escape(first)},` : 'Hi there,';
  const scope = campuses.length
    ? campuses.length === 1
      ? campuses[0]
      : `${campuses.length} campuses: ${campuses.join(', ')}`
    : 'Every campus';
  const subject = 'Welcome to Sunstone PRIME Vertex';

  const text = `${first ? `Hi ${first},` : 'Hi there,'}

You now have access to Sunstone PRIME Vertex, where every PRIME student's coding practice, attendance, tests, AMCAT and exams come together in one place.

Your access: ${roleLabel} · ${scope}${addedBy ? `\nAdded by ${addedBy}` : ''}
Sign in: ${SITE}/login
Android app: ${SITE}/app

How to sign in (no password needed):
1. Continue with Google using ${email}, or
2. Enter ${email} and we'll email you a 6-digit code.

What you'll find:
- Students: every student ranked, with coding, attendance, AMCAT and test trends side by side.
- Campuses: each campus's PRIME journey, from Prime Mock Tests, Practice Tests and MCQs to AMCAT, exams and attendance.
- 360° view: campus and batch comparisons, with the pain points that need attention first.

Tip: open "Take the tour" from your profile menu for a one-minute walkthrough.

Sunstone PRIME Vertex`;

  const feature = (emoji: string, title: string, body: string, tint: string) => `
<tr><td style="padding:0 0 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
    <tr>
      <td width="56" valign="top" style="padding:14px 0 14px 14px">
        <div style="width:40px;height:40px;line-height:40px;border-radius:10px;background:${tint};text-align:center;font-size:20px">${emoji}</div>
      </td>
      <td valign="top" style="padding:14px 16px 14px 12px">
        <div style="font-size:15px;font-weight:bold;color:#0f172a">${title}</div>
        <div style="margin-top:3px;font-size:13px;line-height:19px;color:#475569">${body}</div>
      </td>
    </tr>
  </table>
</td></tr>`;

  const step = (number: number, body: string) => `
<tr>
  <td width="34" valign="top" style="padding:6px 0">
    <div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:#1a3e70;color:#ffffff;text-align:center;font-size:12px;font-weight:bold">${number}</div>
  </td>
  <td valign="top" style="padding:8px 0 6px;font-size:14px;line-height:20px;color:#334155">${body}</td>
</tr>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your access to Sunstone PRIME Vertex is ready: every student's climb, in one view.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(16,38,70,0.12)">

  <!-- Header -->
  <tr><td bgcolor="#102646" style="background:#102646;background-image:linear-gradient(135deg,#1a3e70 0%,#15325b 55%,#102646 100%);padding:36px 32px 34px;text-align:center">
    <img src="${SITE}/vertex-logo-white.png" width="190" alt="Vertex" style="display:block;margin:0 auto;width:190px;max-width:60%;height:auto;border:0">
    <div style="margin:14px auto 0;width:56px;height:3px;border-radius:2px;background:#f59e0b"></div>
    <div style="margin-top:14px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#b5cae6">Sunstone PRIME</div>
    <div style="margin-top:20px;font-size:28px;line-height:34px;font-weight:bold;color:#ffffff">Every student&rsquo;s climb,<br><span style="color:#fcd34d">in one view.</span></div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:32px 32px 8px">
    <div style="font-size:18px;font-weight:bold;color:#0f172a">${hello}</div>
    <p style="margin:10px 0 0;font-size:15px;line-height:24px;color:#334155">
      Welcome aboard! You now have access to <b>Sunstone PRIME Vertex</b>, where every PRIME student&rsquo;s coding practice, attendance, PRIME tests, AMCAT and exams come together in one place, so you can see who is thriving and who needs a hand.
    </p>
  </td></tr>

  <!-- Access -->
  <tr><td style="padding:18px 32px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px">
      <tr><td style="padding:16px 18px">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#b45309;font-weight:bold">Your access</div>
        <div style="margin-top:6px;font-size:16px;font-weight:bold;color:#0f172a">${escape(roleLabel)}</div>
        <div style="margin-top:2px;font-size:14px;line-height:20px;color:#475569">${escape(scope)}</div>
        ${addedBy ? `<div style="margin-top:8px;font-size:12px;color:#92400e">Added by ${escape(addedBy)}</div>` : ''}
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding:26px 32px 6px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td bgcolor="#1a3e70" style="border-radius:12px;background:#1a3e70;background-image:linear-gradient(135deg,#274f87,#102646)">
        <a href="${SITE}/login" style="display:inline-block;padding:15px 34px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px">Open Vertex &nbsp;&rarr;</a>
      </td>
    </tr></table>
    <div style="margin-top:10px;font-size:12px;color:#64748b">vertex.sunstone.in</div>
  </td></tr>

  <!-- Sign in -->
  <tr><td style="padding:26px 32px 6px">
    <div style="font-size:16px;font-weight:bold;color:#0f172a">Signing in takes seconds &mdash; no password</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
      ${step(1, `Click <b>Continue with Google</b> using <b>${escape(email)}</b>, or`)}
      ${step(2, `enter <b>${escape(email)}</b> and we&rsquo;ll email you a <b>6-digit code</b>.`)}
    </table>
  </td></tr>

  <!-- Features -->
  <tr><td style="padding:24px 32px 4px">
    <div style="font-size:16px;font-weight:bold;color:#0f172a;margin-bottom:12px">What you&rsquo;ll find inside</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${feature('🏆', 'Students', 'Every student ranked, with LeetCode, GFG and GitHub alongside attendance, AMCAT and PRIME tests, each with its trend.', '#fef3c7')}
      ${feature('🏫', 'Campuses', 'Each campus&rsquo;s PRIME journey: Prime Mock Tests and leaderboards, Practice Tests and MCQs, AMCAT, exams, and attendance by subject and instructor.', '#dbeafe')}
      ${feature('🎯', '360° view', 'Campuses and batches compared on every front, with the pain points and students who need attention first.', '#fce7f3')}
    </table>
  </td></tr>

  <!-- App -->
  <tr><td style="padding:10px 32px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#102646;background-image:linear-gradient(135deg,#1f4a85,#102646);border-radius:16px">
      <tr>
        <td style="padding:18px 20px">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#f7c873;font-weight:bold">New &middot; Mobile app</div>
          <div style="margin-top:6px;font-size:17px;font-weight:bold;color:#ffffff">Vertex on your Android phone</div>
          <div style="margin-top:4px;font-size:13px;line-height:19px;color:#cbd9ef">Students, campuses, the 360&deg; view and instant notifications, wherever you are.</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>
            <td bgcolor="#e8a33d" style="border-radius:10px;background:#e8a33d">
              <a href="${SITE}/app" style="display:inline-block;padding:10px 18px;font-size:14px;font-weight:bold;color:#1a1206;text-decoration:none">Download the app &rarr;</a>
            </td>
          </tr></table>
        </td>
        <td width="84" valign="middle" align="center" style="padding-right:18px">
          <div style="width:64px;height:64px;border-radius:16px;background:#ffffff;line-height:64px;text-align:center"><img src="${SITE}/vertex-mark.png" width="44" height="44" alt="" style="vertical-align:middle;border:0"></div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Tip -->
  <tr><td style="padding:10px 32px 30px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fa;border-radius:12px">
      <tr><td style="padding:14px 18px;font-size:13px;line-height:20px;color:#15325b">
        💡 <b>New here?</b> Open <b>Take the tour</b> from your profile menu (top right) for a one-minute walkthrough.
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:22px 32px;text-align:center">
    <img src="${SITE}/sunstone-logo.png" width="120" alt="Sunstone" style="display:block;margin:0 auto;width:120px;height:auto;border:0">
    <div style="margin-top:10px;font-size:12px;line-height:18px;color:#64748b">
      You&rsquo;re receiving this because the Sunstone PRIME team gave ${escape(email)} access to Vertex.<br>
      <a href="${SITE}/privacy" style="color:#274f87;text-decoration:underline">Privacy</a>
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  return { subject, text, html };
}

/** Sends many emails at once through Resend's batch endpoint (up to 100 per request). */
export async function sendEmails(emails: Email[]): Promise<number> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    if (process.env.VERCEL)
      throw new Error('Email is not configured (RESEND_API_KEY, EMAIL_FROM).');
    for (const email of emails) console.log(`\n[email to ${email.to}] ${email.subject}\n`);
    return emails.length;
  }
  let sent = 0;
  for (let start = 0; start < emails.length; start += 100) {
    const chunk = emails.slice(start, start + 100);
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        chunk.map(({ to, cc, subject, text, html }) => ({
          from,
          to: Array.isArray(to) ? to : [to],
          ...(cc?.length ? { cc } : {}),
          subject,
          text,
          html,
        }))
      ),
    });
    if (!response.ok) {
      throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    sent += chunk.length;
  }
  return sent;
}

const LEVEL_STYLE = {
  info: { label: 'Update', color: '#274f87', tint: '#eef3fa' },
  important: { label: 'Important', color: '#b45309', tint: '#fffbeb' },
  urgent: { label: 'Urgent', color: '#b91c1c', tint: '#fef2f2' },
} as const;

/** A notification from the bell, as an email: the same branded frame as the welcome email. */
export function notificationEmail({
  title,
  body,
  link,
  level,
  sender,
}: {
  title: string;
  body: string;
  /** Absolute URL, or a path on the site. */
  link?: string | null;
  level: keyof typeof LEVEL_STYLE;
  sender?: string | null;
}) {
  const style = LEVEL_STYLE[level];
  const url = link ? (link.startsWith('/') ? `${SITE}${link}` : link) : `${SITE}/`;
  const subject = level === 'info' ? title : `${style.label}: ${title}`;
  const text = `${style.label.toUpperCase()}: ${title}

${body}

Open: ${url}
${sender ? `\nSent by ${sender} on Sunstone PRIME Vertex.` : ''}`;

  const paragraphs = escape(body)
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:#334155">${paragraph.replace(/\n/g, '<br>')}</p>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(body.slice(0, 140))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(16,38,70,0.12)">
  <tr><td bgcolor="#102646" style="background:#102646;background-image:linear-gradient(135deg,#1a3e70 0%,#15325b 55%,#102646 100%);padding:24px 32px;text-align:left">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${SITE}/vertex-logo-white.png" width="120" alt="Vertex" style="display:block;width:120px;height:auto;border:0"></td>
      <td align="right" style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#b5cae6">🔔 Notification</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:30px 32px 6px">
    <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${style.tint};color:${style.color};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">${style.label}</span>
    <div style="margin-top:12px;font-size:22px;line-height:30px;font-weight:bold;color:#0f172a">${escape(title)}</div>
  </td></tr>
  <tr><td style="padding:12px 32px 4px">${paragraphs}</td></tr>
  <tr><td style="padding:12px 32px 30px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td bgcolor="#1a3e70" style="border-radius:12px;background:#1a3e70;background-image:linear-gradient(135deg,#274f87,#102646)">
        <a href="${escape(url)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px">${link ? 'Open in Vertex' : 'Open Vertex'} &nbsp;&rarr;</a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;text-align:center;font-size:12px;line-height:18px;color:#64748b">
    ${sender ? `Sent by ${escape(sender)} · ` : ''}Also in the 🔔 bell on <a href="${SITE}" style="color:#274f87">vertex.sunstone.in</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}
