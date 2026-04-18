import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.GOOGLE_USER,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    clientId: process.env.GOOGLE_CLIENT_ID,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
});

transporter
  .verify()
  .then(() => {
    console.log("✅ Email transporter is ready to send emails.");
  })
  .catch((err) => {
    console.error("Email transporter verification failed:", err);
  });

export async function sendEmail({ to, subject, html, text }) {
  const details = await transporter.sendMail({
    from: `LangBridge <${process.env.GOOGLE_USER}>`,
    to,
    subject,
    html,
    text,
  });

  if (details.rejected?.length) {
    throw new Error(`Email rejected for: ${details.rejected.join(", ")}`);
  }

  console.log("Email sent:", {
    messageId: details.messageId,
    accepted: details.accepted,
    rejected: details.rejected,
    response: details.response,
  });

  return details;
}
