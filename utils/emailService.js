import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

// ✅ Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Reusable function to send OTP email
export const sendOtpEmail = async (toEmail, username, otp) => {
  try {
    await resend.emails.send({
      from: "Chat App <onboarding@resend.dev>", // ✅ required format
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
    });

    console.log(`✅ OTP sent to ${toEmail}`);
  } catch (error) {
    console.error("❌ Failed to send OTP email:", error);
  }
};
