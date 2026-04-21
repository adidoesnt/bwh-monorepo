import nodemailer from "nodemailer";
import {
  SES_SMTP_HOST,
  SES_SMTP_PORT,
  SES_SMTP_USER,
  SES_SMTP_PASS,
  SENDER_EMAIL,
  RECEIVER_EMAIL,
} from "../constants";

const transporter = nodemailer.createTransport({
  host: SES_SMTP_HOST,
  port: parseInt(SES_SMTP_PORT),
  secure: false,
  auth: {
    user: SES_SMTP_USER,
    pass: SES_SMTP_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("SMTP server is ready to send emails");
  }
});

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
}

export async function sendContactFormEmail(formData: ContactFormData) {
  const { firstName, lastName, email, subject, message } = formData;

  const mailOptions = {
    from: SENDER_EMAIL,
    to: RECEIVER_EMAIL,
    subject: `New Builtwithhabit Contact Form Submission: ${subject}`,
    html: `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #f5f5dc; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
					.field { margin-bottom: 15px; }
					.label { font-weight: bold; color: #8B4513; }
					.value { margin-top: 5px; }
					.message-box { background-color: #f9f9f9; padding: 15px; border-left: 4px solid #8B4513; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>New Contact Form Submission</h1>
						<p>You have received a new message from your website contact form.</p>
					</div>
					
					<div class="field">
						<div class="label">From:</div>
						<div class="value">${firstName} ${lastName} (${email})</div>
					</div>
					
					<div class="field">
						<div class="label">Subject:</div>
						<div class="value">${subject}</div>
					</div>
					
					<div class="field">
						<div class="label">Message:</div>
						<div class="message-box">${message.replace(/\n/g, "<br>")}</div>
					</div>
					
					<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
						<p>This email was sent from your website contact form at ${new Date().toLocaleString()}</p>
					</div>
				</div>
			</body>
			</html>
		`,
    text: `
New Contact Form Submission

From: ${firstName} ${lastName} (${email})
Subject: ${subject}

Message:
${message}

---
Sent from the builtwithhabit contact form at ${new Date().toLocaleString()}
		`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error };
  }
}
