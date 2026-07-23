import "dotenv/config";
import nodemailer from "nodemailer";
import { logger } from "../core/observability/logger.js";

const isTest = process.env.NODE_ENV === "test";
const shouldVerifyTransporter =
  process.env.MAIL_VERIFY_ON_BOOT === "true" ||
  process.env.NODE_ENV !== "production";
const mailUser = process.env.GOOGLE_USER;
const appPassword =
  process.env.GOOGLE_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
const oauthConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
  Boolean(process.env.GOOGLE_REFRESH_TOKEN) &&
  Boolean(mailUser);

const createTransporter = () => {
  if (isTest) {
    return null;
  }

  if (appPassword) {
    return nodemailer.createTransport({
      service: "gmail",
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        user: mailUser,
        pass: appPassword,
      },
    });
  }

  if (oauthConfigured) {
    return nodemailer.createTransport({
      service: "gmail",
      family: 4,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        type: "OAuth2",
        user: mailUser,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        clientId: process.env.GOOGLE_CLIENT_ID,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    });
  }

  return null;
};

const transporter = createTransporter();

if (!transporter) {
  if (!isTest) {
    logger.warn(
      "Email transporter is disabled because mail credentials are missing",
    );
  }
} else if (shouldVerifyTransporter) {
  transporter
    .verify()
    .then(() => {
      logger.info("Email transporter is ready to send emails", {
        mode: appPassword ? "gmail-app-password" : "gmail-oauth2",
      });
    })
    .catch((err) => {
      const isInvalidGrant =
        err?.code === "EAUTH" ||
        err?.responseCode === 535 ||
        /invalid_grant/i.test(err?.message || "");

      logger.warn("Email transporter verification failed", {
        mode: appPassword ? "gmail-app-password" : "gmail-oauth2",
        error: err,
      });

      if (isInvalidGrant && oauthConfigured && !appPassword) {
        logger.warn(
          "Gmail OAuth refresh token is invalid or revoked. Set GOOGLE_APP_PASSWORD or replace GOOGLE_REFRESH_TOKEN to restore email delivery.",
        );
      }
    });
} else if (!isTest) {
  logger.info(
    "Email transporter configured; boot verification skipped in production",
    {
      mode: appPassword ? "gmail-app-password" : "gmail-oauth2",
    },
  );
}

export async function sendEmail({ to, subject, html, text }) {
  if (!transporter) {
    throw new Error(
      "Email transport is not configured. Set GOOGLE_APP_PASSWORD or valid Gmail OAuth credentials.",
    );
  }

  const details = await transporter.sendMail({
    from: `LangBridge <${mailUser}>`,
    to,
    subject,
    html,
    text,
  });

  if (details.rejected?.length) {
    throw new Error(`Email rejected for: ${details.rejected.join(", ")}`);
  }

  logger.info("Email sent", {
    messageId: details.messageId,
    accepted: details.accepted,
    rejected: details.rejected,
    response: details.response,
  });

  return details;
}
