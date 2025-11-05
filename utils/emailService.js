import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// Create transporter (SMTP)
export const transporter = nodemailer.createTransport({
  service: "gmail", // or "outlook", "yahoo", etc.
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Reusable function to send OTP
export const sendOtpEmail = async (toEmail, username, otp) => {
  const mailOptions = {
    from: `"Chat App Support" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Your OTP Code - Chat App Verification",
    html: `
      <div style="font-family:Arial,sans-serif;padding:10px">
        <h2>Hi ${username}, 👋</h2>
        <p>Thank you for registering with our Chat App!</p>
        <p>Your OTP for verification is:</p>
        <h2 style="color:#2E86C1;">${otp}</h2>
        <p>This code will expire in 15 minutes.</p>
        <br/>
        <p>Cheers,<br/>Chat App Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};
