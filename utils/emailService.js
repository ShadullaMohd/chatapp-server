import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const sendOtpEmail = async (toEmail, username, otp) => {
  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: "Chat App", email: "chatxapp4@gmail.com" },
        to: [{ email: toEmail }],
        subject: "Your OTP Code - Chat App Verification",
        htmlContent: `
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
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ OTP email sent to ${toEmail}`);
  } catch (error) {
    console.error("❌ Failed to send OTP email:", error.response?.data || error.message);
  }
};
