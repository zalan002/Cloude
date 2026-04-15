import nodemailer from 'nodemailer';
import { escapeHtml } from '@/lib/security';

const ALERT_EMAIL = 'CONSORTIO@traininghungary.com';
const FROM_EMAIL = 'riport@traininghungary.com';

const esc = escapeHtml;

function getTransporter() {
  const apiKey = process.env.MANDRILL_API_KEY;
  if (!apiKey) {
    console.warn('MANDRILL_API_KEY nincs beállítva, email nem küldhető.');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.mandrillapp.com',
    port: 587,
    auth: {
      user: 'Training Hungary Kft.',
      pass: apiKey,
    },
  });
}

export async function sendErrorAlert({ subject, message, context }) {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: ALERT_EMAIL,
      subject: `CONSORTIO - ${subject}`,
      html: `
        <h2 style="color:#c0392b;">${esc(subject)}</h2>
        <p>${esc(message)}</p>
        ${context ? `<pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:13px;">${esc(context)}</pre>` : ''}
        <p style="color:#888;font-size:13px;">Időpont: ${new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' })}</p>
        <hr>
        <p style="color:#aaa;font-size:11px;">Automatikus értesítés a CONSORTIO munkaidő-nyilvántartó rendszerből.</p>
      `,
    });
  } catch (err) {
    console.error('Email küldési hiba:', err);
  }
}

export async function sendInactivityAlert(daysSinceLastLogin) {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: ALERT_EMAIL,
      subject: 'CONSORTIO - Inaktivitás figyelmeztetés',
      html: `
        <h2 style="color:#e67e22;">Inaktivitás figyelmeztetés</h2>
        <p>Az elmúlt <strong>${daysSinceLastLogin} napban</strong> senki nem lépett be a CONSORTIO rendszerbe.</p>
        <p>Kérjük, ellenőrizze, hogy a rendszer megfelelően működik-e.</p>
        <p style="color:#888;font-size:13px;">Időpont: ${new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' })}</p>
        <hr>
        <p style="color:#aaa;font-size:11px;">Automatikus értesítés a CONSORTIO munkaidő-nyilvántartó rendszerből.</p>
      `,
    });
  } catch (err) {
    console.error('Inaktivitás email küldési hiba:', err);
  }
}
