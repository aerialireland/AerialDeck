/**
 * Email alerts for the daily IAA zone check.
 *
 * Uses Resend — one HTTPS call, no SDK. Kept behind a small interface so
 * swapping to Postmark/SES later is a change in this file only.
 *
 * Environment:
 *   RESEND_API_KEY   from https://resend.com (free tier is 100 emails/day)
 *   ALERT_EMAIL_TO   comma-separated recipients
 *   ALERT_EMAIL_FROM optional; defaults to Resend's shared onboarding sender,
 *                    which works without verifying a domain but can land in
 *                    spam. Set it to something at aerial.ie once the domain is
 *                    verified in Resend.
 *
 * Unconfigured is a no-op, so nothing breaks before setup.
 */

const API = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'AerialDeck <onboarding@resend.dev>';

const isConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO);

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Build the HTML body for a zone-change alert. */
function renderZoneDiff({ versionId, previousId, diff, features }) {
  const TH = 'padding:4px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b8a6e';
  const TD = 'padding:8px 10px;border-bottom:1px solid #e0e8e0;vertical-align:top';
  const MONO = 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace';

  const section = (title, colour, zones, render) => {
    if (!zones.length) return '';
    return `
    <h3 style="margin:22px 0 6px;font-size:14px;color:${colour}">${title} (${zones.length})</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr><th style="${TH};width:70px">Zone</th><th style="${TH}">Name</th><th style="${TH}">Detail</th></tr>
      ${zones.map(render).join('')}
    </table>`;
  };

  const plain = (colour) => (z) => `
    <tr>
      <td style="${TD};${MONO};color:${colour};font-weight:600">${esc(z.id)}</td>
      <td style="${TD}">${esc(z.name)}</td>
      <td style="${TD};color:#6b8a6e;font-size:13px">${esc(z.type || '')}</td>
    </tr>`;

  // Changed zones list each altered field as "was → now", so the email says what
  // moved rather than just that something did.
  const changedRow = (z) => `
    <tr>
      <td style="${TD};${MONO};color:#92400e;font-weight:600">${esc(z.id)}</td>
      <td style="${TD}">${esc(z.name)}</td>
      <td style="${TD};font-size:13px">
        ${(z.details || z.fields.map(f => ({ field: f, from: '', to: '' }))).map(d => `
          <div style="margin-bottom:4px">
            <span style="color:#6b8a6e">${esc(d.field)}:</span>
            ${d.from ? `<span style="color:#991b1b">${esc(d.from)}</span> <span style="color:#6b8a6e">&rarr;</span> <span style="color:#166534">${esc(d.to)}</span>` : ''}
          </div>`).join('')}
      </td>
    </tr>`;

  const body =
    section('Added', '#166534', diff.added, plain('#166534')) +
    section('Removed', '#991b1b', diff.removed, plain('#991b1b')) +
    section('Changed', '#92400e', diff.changed, changedRow);

  return `
  <div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;color:#001803;max-width:760px">
    <h2 style="margin:0 0 4px">New IAA zone dataset: ${esc(versionId)}</h2>
    <p style="margin:0 0 16px;color:#6b8a6e">
      ${previousId ? `Compared against ${esc(previousId)}.` : 'First archived version — nothing to compare against.'}
      Now ${features} zones
      (<span style="color:#166534">${diff.counts.added} added</span>,
       <span style="color:#991b1b">${diff.counts.removed} removed</span>,
       <span style="color:#92400e">${diff.counts.changed} changed</span>).
    </p>
    ${body || '<p style="color:#6b8a6e">No zone-level differences detected.</p>'}
    <p style="margin:20px 0 0;padding:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:14px">
      <strong>This is archived, not yet live.</strong> The U.F.101 Creator and Flight Planner
      keep using their current dataset until it is switched over deliberately —
      saved applications stay tied to the dataset they were validated against.
    </p>
    <p style="margin:16px 0 0;color:#6b8a6e;font-size:12px">
      AerialDeck · daily IAA zone check
    </p>
  </div>`;
}

/**
 * @returns {Promise<{sent:boolean, reason?:string, id?:string}>} never throws
 */
async function send({ subject, html }) {
  if (!isConfigured()) return { sent: false, reason: 'email not configured' };
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.ALERT_EMAIL_FROM || DEFAULT_FROM,
        to: process.env.ALERT_EMAIL_TO.split(',').map(s => s.trim()).filter(Boolean),
        subject,
        html
      })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { sent: false, reason: `Resend ${res.status}: ${body.message || 'unknown'}` };
    return { sent: true, id: body.id };
  } catch (err) {
    // Never fatal — an email problem must not fail the daily check.
    return { sent: false, reason: err.message };
  }
}

module.exports = { send, renderZoneDiff, isConfigured };
