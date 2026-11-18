// ---------------------------------------------------------------------------
// Booking notification emails (approve / reject), sent via SMTP.
//
// Configure in server/.env:
//   SMTP_USER = the Gmail address to send from
//   SMTP_PASS = a Gmail App Password (myaccount.google.com/apppasswords)
//   SMTP_HOST / SMTP_PORT — optional, default smtp.gmail.com:465
//
// If SMTP is not configured, booking status still updates — the API just
// reports that no email was sent.
// ---------------------------------------------------------------------------
import nodemailer from 'nodemailer';

export function mailConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const ACCENT = '#ff6b35';
const INK = '#1a1714';

function prettyDate(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ymd
    : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function template({ heading, lines, booking, note }) {
  const rows = [
    ['Date', prettyDate(booking.date)],
    ['Time', `${booking.time}${booking.duration ? ` · ${booking.duration}` : ''}`],
    booking.topic ? ['Topic', booking.topic] : null,
  ].filter(Boolean);

  const text = [
    `Hi ${booking.name},`,
    '',
    ...lines,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(note ? ['', `Note from Chaitanya: ${note}`] : []),
    '',
    '— Chaitanya Tyagi',
    'Data Engineer',
  ].join('\n');

  const html = `
  <div style="font-family:system-ui,-apple-system,sans-serif;background:#faf8f4;padding:32px 16px">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e1d7;border-radius:14px;overflow:hidden">
      <div style="padding:22px 28px;border-bottom:3px solid ${ACCENT}">
        <span style="font-weight:700;font-size:17px;color:${INK}">Chaitanya Tyagi</span>
        <span style="color:#8a8377;font-size:13px"> · Data Engineer</span>
      </div>
      <div style="padding:26px 28px;color:${INK}">
        <h2 style="margin:0 0 14px;font-size:19px">${heading}</h2>
        <p style="margin:0 0 18px;font-size:14.5px;line-height:1.6;color:#3a352e">Hi ${booking.name},<br/>${lines.join('<br/>')}</p>
        <table style="width:100%;border-collapse:collapse;background:#faf8f4;border:1px solid #e6e1d7;border-radius:10px">
          ${rows.map(([k, v]) => `
          <tr>
            <td style="padding:10px 16px;font-size:12px;letter-spacing:.08em;color:#8a8377;text-transform:uppercase;width:80px">${k}</td>
            <td style="padding:10px 16px;font-size:14px;color:${INK};font-weight:500">${v}</td>
          </tr>`).join('')}
        </table>
        ${note ? `<p style="margin:18px 0 0;padding:14px 16px;background:#fff1ea;border:1px solid #ffd9c7;border-radius:10px;font-size:14px;line-height:1.6;color:#3a352e"><strong style="color:${ACCENT}">Note from Chaitanya:</strong> ${note}</p>` : ''}
        <p style="margin:22px 0 0;font-size:13px;color:#8a8377">— Chaitanya Tyagi</p>
      </div>
    </div>
  </div>`;

  return { text, html };
}

// Builds the notification email. status: 'confirmed' | 'cancelled'.
export function buildBookingEmail(booking, status, note = '') {
  const confirmed = status === 'confirmed';
  const subject = confirmed
    ? `✓ Confirmed — your 1:1 call on ${prettyDate(booking.date)}`
    : `About your 1:1 call request for ${prettyDate(booking.date)}`;

  const { text, html } = template({
    heading: confirmed ? 'Your 1:1 call is confirmed 🎉' : "This slot didn't work out",
    lines: confirmed
      ? ['Good news — your session is locked in. Here are the details:']
      : ["Unfortunately I can't make the slot you requested, so I've had to decline it.",
         'Please pick another available slot on the site — happy to talk then.'],
    booking,
    note,
  });

  return { subject, text, html };
}

// Returns { sent, error? } — never throws.
export async function sendBookingEmail(booking, status, note = '') {
  if (!mailConfigured()) return { sent: false, error: 'SMTP not configured' };

  const { subject, text, html } = buildBookingEmail(booking, status, note);

  try {
    await getTransporter().sendMail({
      from: `"Chaitanya Tyagi" <${process.env.SMTP_USER}>`,
      to: booking.email,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error('✉️  Email send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

// Generic transactional email (platform: password resets). Returns
// { sent, error? } — never throws, so a mail outage can't fail a request.
export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) return { sent: false, error: 'SMTP not configured' };
  try {
    await getTransporter().sendMail({ from: `"DataDrill" <${process.env.SMTP_USER}>`, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}
