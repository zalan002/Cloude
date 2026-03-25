import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.MANDRILL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'MANDRILL_API_KEY nincs beállítva a Vercel environment variables-ben.' },
      { status: 500 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.mandrillapp.com',
      port: 587,
      auth: {
        user: 'Training Hungary Kft.',
        pass: apiKey,
      },
    });

    await transporter.sendMail({
      from: 'riport@traininghungary.com',
      to: 'CONSORTIO@traininghungary.com',
      subject: 'CONSORTIO - Teszt email',
      html: `
        <h2>Teszt email</h2>
        <p>Ez egy teszt email a CONSORTIO rendszerből.</p>
        <p>Ha ezt látod, az email küldés megfelelően működik!</p>
        <p>Időpont: ${new Date().toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' })}</p>
        <hr>
        <p style="color:#888;font-size:12px;">Ez egy automatikus értesítés a CONSORTIO rendszerből.</p>
      `,
    });

    return NextResponse.json({ success: true, message: 'Teszt email sikeresen elküldve!' });
  } catch (err) {
    return NextResponse.json(
      { error: 'Email küldési hiba: ' + err.message },
      { status: 500 }
    );
  }
}
