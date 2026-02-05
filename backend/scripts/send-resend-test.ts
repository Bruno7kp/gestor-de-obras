import 'dotenv/config';
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  throw new Error('RESEND_API_KEY is not set');
}

const resend = new Resend(apiKey);

async function main() {
  const result = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'bruno7kp@gmail.com',
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
  });

  console.log('Email sent:', result);
}

main().catch((error) => {
  console.error('Failed to send email:', error);
  process.exit(1);
});
