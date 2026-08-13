import nodemailer from 'nodemailer';

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function sendMail(input: MailInput) {
  const transport = getTransport();
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'Phonics Adventure <noreply@example.com>';

  if (!transport) {
    console.info('[email:console]', {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return;
  }

  await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export async function sendOtpEmail(email: string, code: string, purpose: 'verify_email' | 'password_reset') {
  const isReset = purpose === 'password_reset';
  const title = isReset ? 'Reset your Phonics Adventure password' : 'Verify your Phonics Adventure email';
  const message = isReset
    ? 'Use this code to reset your password.'
    : 'Use this code to verify your email and finish creating your account.';

  await sendMail({
    to: email,
    subject: title,
    text: `${message}\n\nYour code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2>${title}</h2>
        <p>${message}</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:6px;margin:24px 0">${code}</p>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
}
