// Sends email through a chain of providers, so running out of one free plan does not stop
// sign-in codes: Resend first, then Brevo, then Mailjet, each used only when configured.
// When a provider refuses (daily quota used up, rate limit, outage), the next one sends it.
//
//   EMAIL_FROM          the sender, e.g. "Sunstone PRIME Vertex <noreply@vertex.sunstone.in>"
//                       (its domain must be verified with each provider)
//   RESEND_API_KEY      Resend (free: 100 a day, 3,000 a month)
//   BREVO_API_KEY       Brevo, backup (free: 300 a day)
//   BREVO_FROM          optional: Brevo's own sender, until EMAIL_FROM's domain is verified
//                       there (e.g. "Sunstone PRIME Vertex <vertex.sunstone@gmail.com>")
//   MAILJET_API_KEY     Mailjet, second backup (free: 200 a day),
//   MAILJET_SECRET_KEY    with its secret key
//   MAILJET_FROM        optional: Mailjet's own sender, as BREVO_FROM
//
// Locally, with no provider configured, the email is printed to the dev server's terminal
// instead, so sign-in codes can be tried without sending anything.

const setting = (name: string) => process.env[name]?.trim() || undefined;

/** Brevo's key, also when pasted as Brevo shows it wrapped: base64 of {"api_key": "xkeysib-…"}. */
function brevoKey() {
  const value = setting('BREVO_API_KEY');
  if (!value || value.startsWith('xkeysib-')) return value;
  try {
    return (JSON.parse(atob(value)) as { api_key?: string }).api_key?.trim() || value;
  } catch {
    return value;
  }
}

/** "Name <address>" → its parts. */
function sender(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match
    ? { name: match[1].replace(/^"|"$/g, ''), email: match[2] }
    : { name: '', email: from.trim() };
}

const list = (to: string | string[]) => (Array.isArray(to) ? to : [to]);

interface Provider {
  name: string;
  /** The setting that overrides EMAIL_FROM for this provider. */
  from?: string;
  ready: () => boolean;
  send: (email: Email, from: string) => Promise<Response>;
}

const PROVIDERS: Provider[] = [
  {
    name: 'Resend',
    ready: () => Boolean(setting('RESEND_API_KEY')),
    send: ({ to, cc, subject, text, html }, from) =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${setting('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: list(to),
          ...(cc?.length ? { cc } : {}),
          subject,
          text,
          html,
        }),
      }),
  },
  {
    name: 'Brevo',
    from: 'BREVO_FROM',
    ready: () => Boolean(brevoKey()),
    send: ({ to, cc, subject, text, html }, from) =>
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey()!,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: sender(from),
          to: list(to).map((email) => ({ email })),
          ...(cc?.length ? { cc: cc.map((email) => ({ email })) } : {}),
          subject,
          textContent: text,
          htmlContent: html,
        }),
      }),
  },
  {
    name: 'Mailjet',
    from: 'MAILJET_FROM',
    ready: () => Boolean(setting('MAILJET_API_KEY') && setting('MAILJET_SECRET_KEY')),
    send: ({ to, cc, subject, text, html }, from) => {
      const { name, email } = sender(from);
      return fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${setting('MAILJET_API_KEY')}:${setting('MAILJET_SECRET_KEY')}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [
            {
              From: { Email: email, Name: name },
              To: list(to).map((address) => ({ Email: address })),
              ...(cc?.length ? { Cc: cc.map((address) => ({ Email: address })) } : {}),
              Subject: subject,
              TextPart: text,
              HTMLPart: html,
            },
          ],
        }),
      });
    },
  },
];

const ready = () => PROVIDERS.filter((provider) => provider.ready());

export const canSendEmail = () =>
  Boolean(ready().length && setting('EMAIL_FROM')) || !process.env.VERCEL;

export interface Email {
  to: string | string[];
  /** Copied in (e.g. HQ on a campus email). */
  cc?: string[];
  subject: string;
  text: string;
  html: string;
}

/** Sends one email through the first provider that accepts it; returns that provider's name. */
export async function sendEmail(email: Email): Promise<string> {
  const from = setting('EMAIL_FROM');
  const providers = ready();
  if (!providers.length || !from) {
    if (process.env.VERCEL)
      throw new Error('Email is not configured (EMAIL_FROM and a provider key).');
    console.log(`\n[email to ${email.to}] ${email.subject}\n${email.text}\n`);
    return 'terminal';
  }

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const response = await provider.send(
        email,
        (provider.from && setting(provider.from)) || from
      );
      if (response.ok) return provider.name;
      failures.push(
        `${provider.name} ${response.status}: ${(await response.text()).slice(0, 200)}`
      );
    } catch (error) {
      failures.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`No email provider could send it. ${failures.join(' | ')}`);
}

/** What a code email is for: staff sign-in (the default) or the student form. */
const CODE_PURPOSES = {
  signIn: {
    subject: 'your Sunstone PRIME Vertex sign-in code',
    lead: 'Your sign-in code is',
    ignore: 'If you did not try to sign in, you can ignore this email.',
  },
  studentForm: {
    subject: 'your code to add your coding profiles',
    lead: 'Your code to add your coding profiles is',
    ignore:
      'If you did not ask for it, you can ignore this email: nothing changes without the code.',
  },
};

/** A one-time code email: plain, with the code large and nothing else to click. */
export function signInCodeEmail(
  code: string,
  minutes: number,
  purpose: keyof typeof CODE_PURPOSES = 'signIn'
) {
  const { subject: about, lead, ignore } = CODE_PURPOSES[purpose];
  const subject = `${code} is ${about}`;
  const text = `${lead} ${code}

It expires in ${minutes} minutes. ${ignore}

Sunstone PRIME Vertex`;
  const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#1a3e70;padding:20px 28px;color:#ffffff;font-size:16px;font-weight:bold">Sunstone PRIME <span style="color:#f59e0b">Vertex</span></td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:15px">${lead}</p>
<p style="margin:0 0 20px;font-size:34px;font-weight:bold;letter-spacing:8px;color:#1a3e70">${code}</p>
<p style="margin:0;font-size:13px;color:#64748b">It expires in ${minutes} minutes. ${ignore}</p>
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
- Campuses: each campus's PRIME journey, from PRIME Mock Tests, Practice Tests and MCQs to AMCAT, exams and attendance.
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
      Welcome aboard! You now have access to <b>Sunstone PRIME Vertex</b>, where every PRIME student&rsquo;s coding practice, attendance, PRIME Mock Tests, AMCAT and exams come together in one place, so you can see who is thriving and who needs a hand.
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
      ${feature('🏆', 'Students', 'Every student ranked, with LeetCode, GFG and GitHub alongside attendance, AMCAT and PRIME Mock Tests, each with its trend.', '#fef3c7')}
      ${feature('🏫', 'Campuses', 'Each campus&rsquo;s PRIME journey: PRIME Mock Tests and leaderboards, Practice Tests and MCQs, AMCAT, exams, and attendance by subject and instructor.', '#dbeafe')}
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
/**
 * Sends many emails: Resend's batch API in hundreds, and whatever it refuses one by one
 * through the chain (so the backups take over when Resend's quota runs out).
 */
export async function sendEmails(emails: Email[]): Promise<number> {
  const from = setting('EMAIL_FROM');
  const key = setting('RESEND_API_KEY');
  if (!ready().length || !from) {
    if (process.env.VERCEL)
      throw new Error('Email is not configured (EMAIL_FROM and a provider key).');
    for (const email of emails) console.log(`\n[email to ${email.to}] ${email.subject}\n`);
    return emails.length;
  }
  let sent = 0;
  for (let start = 0; start < emails.length; start += 100) {
    const chunk = emails.slice(start, start + 100);
    const response = key
      ? await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(
            chunk.map(({ to, cc, subject, text, html }) => ({
              from,
              to: list(to),
              ...(cc?.length ? { cc } : {}),
              subject,
              text,
              html,
            }))
          ),
        }).catch(() => null)
      : null;
    if (response?.ok) {
      sent += chunk.length;
      continue;
    }
    if (ready().length < 2 && key) {
      throw new Error(
        `Resend ${response?.status ?? 'unreachable'}: ${(await response?.text())?.slice(0, 300) ?? ''}`
      );
    }
    for (const email of chunk) {
      await sendEmail(email);
      sent++;
    }
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
