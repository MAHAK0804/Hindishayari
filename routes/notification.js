// routes/notification.js
import express from "express";
import { sendRandomShayari } from "../sendShayariNotification.js";

const router = express.Router();

router.get("/send-random-shayari", async (req, res) => {
  try {
    await sendRandomShayari();
    res.json({ success: true, message: "Notification sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
