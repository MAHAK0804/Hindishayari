import express from "express";
import Users from "../models/Users.js";
import sendOtp from "../utils/sendOtp.js";

const router = express.Router();

const generateOTP = (email, name) =>
  email === "jhingurlab@gmail.com"
    ? "123456"
    : Math.floor(100000 + Math.random() * 900000).toString();

// Step 1: Request OTP
router.post("/request-otp", async (req, res) => {
  const { name, email, phone } = req.body;

  console.log("✅ Incoming req.body:", req.body); // Should be user input

  if (!email && !phone && !name)
    return res.status(400).json({ message: "Name, Email or phone required" });

  const otp = generateOTP(email, name);
  const otpExpires =
    email === "jhingurlab@gmail.com" ? null : Date.now() + 5 * 60 * 1000;
  // const expiryTimeFormatted = new Date(otpExpires).toLocaleString();
  // const remainingSeconds = Math.floor((otpExpires - Date.now()) / 1000);
  // const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  // const seconds = String(remainingSeconds % 60).padStart(2, "0");
  // const countdownTime = `${minutes}:${seconds}`;

  let user;
  if (email) {
    user = await Users.findOne({ email: email });
  } else if (phone) {
    user = await Users.findOne({ phone: phone });
  }

  if (!user) {
    user = new Users({ email, phone, name });
    console.log("🆕 Creating new user:", user);
  } else {
    console.log("♻️ Updating existing user:", user);
  }

  user.otp = otp;
  user.otpExpires = otpExpires;
  user.isVerifed = false;
  console.log(otp);

  await user.save();

  console.log("📦 Saved user in DB:", user);

  await sendOtp({
    name,
    email: req.body.email,
    phone: req.body.phone,
    otp,
    otpExpires,
  });

  res.json({ message: "OTP sent successfully", data: { user } });
});

// Step 2: Verify OTP
// Step 2: Verify OTP
router.post("/verify-otp", async (req, res) => {
  const { name, email, phone, otp } = req.body;

  let user;
  if (email) {
    user = await Users.findOne({ email });
  } else if (phone) {
    user = await Users.findOne({ phone });
  }

  // ✅ Dummy user ke liye OTP kabhi expire nahi hoga
  if (
    !user ||
    user.otp !== otp ||
    (user.otpExpires && user.otpExpires < Date.now())
  ) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  user.name = name;
  user.otp = email === "jhingurlab@gmail.com" ? "123456" : null;
  user.otpExpires = null;
  user.isVerifed = true;
  await user.save();

  res.json({ message: "OTP verified", userId: user._id });
});

export default router;
