// index.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import fileUpload from "express-fileupload";
import admin from "firebase-admin"; // Firebase Admin SDK
import bodyParser from "body-parser"; // Body-parser for JSON parsing
import cron from "node-cron"; // Node-cron for scheduling tasks

// Routes imports
import categoryRoutes from "./routes/categoryRoutes.js";
import shayariRoutes from "./routes/shayariRoutes.js";
import adminroutes from "./routes/authroutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import usersRoutes from "./routes/userroutes.js";
import usersShayarisRoutes from "./routes/usersShayarisroutes.js";

// Import your Mongoose models
import Shayari from "./models/Shayari.js";
import FCMToken from "./models/FcmToken.js"; // नया FCMToken मॉडल इम्पोर्ट करें
import { register } from "./controllers/authController.js";
import { sendRandomShayari } from "./sendShayariNotification.js";

// Load environment variables
dotenv.config();

// --- START: Updated Code for Firebase Service Account Key ---
// Load Firebase service account key from environment variable
let serviceAccount;
try {
  // Check if the environment variable exists
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set."
    );
  }

  // Decode the Base64 string and parse it as JSON
  const serviceAccountJson = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    "base64"
  ).toString("utf-8");

  serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
  console.error(
    "Failed to load Firebase service account key from environment variable:",
    error
  );
  // Exit the process if the key is not available
  process.exit(1);
}
// --- END: Updated Code ---

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();

// Configure CORS
app.use(
  cors({
    origin: "*", // सभी ओरिजिन से रिक्वेस्ट की अनुमति देता है
    credentials: true,
  })
);

// Middleware
app.use(express.json()); // JSON रिक्वेस्ट बॉडी को पार्स करने के लिए
app.use(fileUpload()); // फाइल अपलोड हैंडल करने के लिए
app.use(bodyParser.json()); // FCM टोकन रजिस्ट्रेशन के लिए JSON बॉडी को पार्स करने के लिए

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

app.post("/api/register-fcm-token", async (req, res) => {
  const { fcmToken } = req.body;
  console.log("fcmToken", req.body);

  if (!fcmToken) {
    return res.status(400).json({ error: "FCM टोकन आवश्यक है।" });
  }

  try {
    const updatePayload = {
      lastUpdatedAt: new Date(),
    };

    await FCMToken.findOneAndUpdate({ fcmToken: fcmToken }, updatePayload, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    console.log(`FCM टोकन सफलतापूर्वक रजिस्टर/अपडेट हुआ: ${fcmToken}`);
    res.status(200).json({ message: "FCM टोकन सफलतापूर्वक रजिस्टर हुआ।" });
  } catch (error) {
    console.error("FCM टोकन रजिस्टर करने में त्रुटि:", error);
    res.status(500).json({ error: "सर्वर त्रुटि" });
  }
});

cron.schedule("*/5 * * * *", sendRandomShayari, { timezone: "Asia/Kolkata" });
// Routes (आपके मौजूदा रूट्स)
app.use("/api/admin", adminroutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/shayaris", shayariRoutes);
app.use("/api/users/auth", usersRoutes);
app.use("/api/users/shayaris", usersShayarisRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
