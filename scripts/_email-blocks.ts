// Building blocks for the automatic emails (new tests, weekly reports): the branded frame
// and small pieces (headings, stat rows, tables) as email-safe HTML: tables and inline
// styles only, so they render in Gmail, Outlook and phone mail apps.

import { SITE, escape } from '../api/_email';

export { escape, SITE };

export const BAND = { good: '#059669', ok: '#d97706', risk: '#dc2626', none: '#94a3b8' } as const;

/** Through Vercel's image resizer, so a 300 KB campus logo arrives as a few KB. */
export const logoUrl = (logo: string) =>
  `${SITE}/_vercel/image?url=${encodeURIComponent(logo)}&w=128&q=80`;

export function frame({
  kicker,
  title,
  subtitle,
  preheader,
  logo,
  content,
  cta,
  footer,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  preheader: string;
  /** Campus logo shown in the header next to the title. */
  logo?: string | null;
  content: string;
  cta: { label: string; href: string };
  footer: string;
}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 10px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(16,38,70,0.12)">
  <tr><td bgcolor="#102646" style="background:#102646;background-image:linear-gradient(135deg,#1a3e70 0%,#15325b 55%,#102646 100%);padding:24px 28px 26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${SITE}/vertex-logo-white.png" width="110" alt="Vertex" style="display:block;width:110px;height:auto;border:0"></td>
      <td align="right" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b5cae6">${escape(kicker)}</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr>
      ${
        logo
          ? `<td width="60" valign="middle"><div style="width:48px;height:48px;border-radius:12px;background:#ffffff;padding:3px;box-sizing:border-box"><img src="${logoUrl(logo)}" width="42" height="42" alt="" style="display:block;width:42px;height:42px;object-fit:contain;border:0"></div></td>`
          : ''
      }
      <td valign="middle">
        <div style="font-size:24px;line-height:30px;font-weight:bold;color:#ffffff">${escape(title)}</div>
        ${subtitle ? `<div style="margin-top:4px;font-size:13px;color:#b5cae6">${escape(subtitle)}</div>` : ''}
      </td>
    </tr></table>
  </td></tr>
  ${content}
  <tr><td align="center" style="padding:8px 28px 30px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td bgcolor="#1a3e70" style="border-radius:12px;background:#1a3e70;background-image:linear-gradient(135deg,#274f87,#102646)">
        <a href="${escape(cta.href)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px">${escape(cta.label)} &nbsp;&rarr;</a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 28px;text-align:center;font-size:12px;line-height:18px;color:#64748b">
    ${footer}<br>Also in the 🔔 bell on <a href="${SITE}" style="color:#274f87">vertex.sunstone.in</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** A titled section of the email body. */
export const section = (heading: string, inner: string, note?: string) => `
<tr><td style="padding:22px 28px 4px">
  <div style="font-size:16px;font-weight:bold;color:#0f172a">${heading}</div>
  ${note ? `<div style="margin-top:2px;font-size:12px;color:#64748b">${note}</div>` : ''}
  <div style="margin-top:12px">${inner}</div>
</td></tr>`;

/** A coloured pill, e.g. a band or severity. */
export const pill = (label: string, color: string) =>
  `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${color}1f;color:${color};font-size:11px;font-weight:bold">${escape(label)}</span>`;

/** A table with a shaded header row and zebra rows. */
export function table(
  headers: { label: string; align?: 'left' | 'right' | 'center' }[],
  rows: string[][]
) {
  const head = headers
    .map(
      (header) =>
        `<th align="${header.align ?? 'left'}" style="padding:8px 8px;font-size:11px;font-weight:bold;color:#475569;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">${header.label}</th>`
    )
    .join('');
  const body = rows
    .map(
      (cells, index) =>
        `<tr style="background:${index % 2 ? '#f8fafc' : '#ffffff'}">${cells
          .map(
            (cell, column) =>
              `<td align="${headers[column]?.align ?? 'left'}" style="padding:8px 8px;font-size:13px;color:#0f172a;border-bottom:1px solid #f1f5f9">${cell}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;border-collapse:separate;overflow:hidden"><tr style="background:#f1f5f9">${head}</tr>${body}</table>`;
}
