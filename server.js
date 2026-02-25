require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { MailtrapTransport } = require("mailtrap");

const app = express();
const port = process.env.PORT || 5000;

// Very permissive CORS for development (allows localhost:* and 127.0.0.1:*)
app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Parse JSON bodies
app.use(express.json());

// Global request logger – very useful for debugging
app.use((req, res, next) => {
  console.log(
    "───────────────────────────── NEW REQUEST ─────────────────────────────"
  );
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Origin:", req.headers.origin || "no origin");
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("Raw body (before parsing):", req.body); // usually undefined here
  next();
});

// Mailtrap transporter
const transporter = nodemailer.createTransport(
  MailtrapTransport({
    token: process.env.MAILTRAP_TOKEN,
  })
);

const sendOtpToMail = async (mail, otp) => {
  console.log(`[sendOtpToMail] Attempting to send OTP ${otp} to ${mail}`);

  const sender = {
    address: "hello@fashiontally.com",
    name: "TallyAfrica",
  };

  try {
    const info = await transporter.sendMail({
      from: sender,
      to: mail,
      subject: "Your OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px; color: #333;">
          <h2 style="color: #c99d3f;">Your One-Time Password (OTP)</h2>
          <p>Use the OTP below to complete your verification. This code is valid for the next 10 minutes:</p>
          <div style="font-size: 24px; font-weight: bold; margin: 20px 0; color: #222;">${otp}</div>
          <p style="font-size: 14px;">If you did not request this code, please ignore this email.</p>
          <br/>
          <p style="font-size: 13px; color: #999;">Thanks,<br/>The TallyAfrica Team</p>
        </div>
      `,
      category: "OTP Emails",
    });

    console.log(`[sendOtpToMail] SUCCESS → Message sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("[sendOtpToMail] FAILED:", error.message);
    if (error.response) {
      console.error("Mailtrap response data:", error.response.data);
      console.error("Mailtrap status:", error.response.status);
    }
    return false;
  }
};

// ────────────────────────────────────────────────
// FIXED & IMPROVED ENDPOINT
// ────────────────────────────────────────────────
app.post("/api/send-otp", async (req, res) => {
  console.log("→ Reached /api/send-otp handler");
  console.log("Received body:", req.body);

  // Accept either "mail" or "email"
  const recipient = req.body.mail || req.body.email;
  const otp = req.body.otp;

  if (!recipient || !otp) {
    console.log("Validation failed: missing recipient or otp");
    return res.status(400).json({
      success: false,
      message: "Both email/mail and otp are required",
      received: req.body,
    });
  }

  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    console.log("Validation failed: invalid OTP format");
    return res.status(400).json({
      success: false,
      message: "OTP must be a 6-digit string",
      receivedOtp: otp,
    });
  }

  console.log(`→ Valid request → sending to ${recipient} with OTP ${otp}`);

  const success = await sendOtpToMail(recipient, otp);

  if (success) {
    res.json({ success: true, message: "OTP sent successfully" });
  } else {
    res.status(500).json({
      success: false,
      message: "Failed to send OTP – check server logs for details",
    });
  }
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
