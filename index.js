// index.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import fileUpload from "express-fileupload";
import admin from "firebase-admin"; // Firebase Admin SDK
import bodyParser from "body-parser"; // Body-parser for JSON parsing
import cron from "node-cron"; // Node-cron for scheduling tasks
import fs from "fs"; // File system for token storage (for this example)

// Routes imports
import categoryRoutes from "./routes/categoryRoutes.js";
import shayariRoutes from "./routes/shayariRoutes.js";
import adminroutes from "./routes/authroutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import usersRoutes from "./routes/userroutes.js";
import usersShayarisRoutes from "./routes/usersShayarisroutes.js";

// Import your Shayari model (assuming it exists)
// Make sure the path is correct for your project structure
import Shayari from "./models/Shayari.js"; // <-- यहाँ अपनी शायरी मॉडल फाइल का पाथ दें

// Load environment variables
dotenv.config();

// Load Firebase service account key
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" }; // <-- 'assert { type: "json" }' ES Modules के लिए ज़रूरी है

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

// --- FCM टोकन स्टोरेज (इस उदाहरण के लिए फाइल का उपयोग) ---
// उत्पादन (production) में, आपको इन टोकन को डेटाबेस (जैसे MongoDB) में स्टोर करना चाहिए।
const FCM_TOKENS_FILE = "fcm_tokens.json";
let fcmTokens = [];

// फाइल से FCM टोकन लोड करें जब सर्वर शुरू हो
if (fs.existsSync(FCM_TOKENS_FILE)) {
  try {
    fcmTokens = JSON.parse(fs.readFileSync(FCM_TOKENS_FILE, "utf8"));
    console.log("Loaded FCM tokens:", fcmTokens.length);
  } catch (error) {
    console.error("Error loading FCM tokens from file:", error);
    fcmTokens = []; // अगर फाइल corrupt है तो खाली एरे से शुरू करें
  }
}

// FCM टोकन को फाइल में सेव करें
const saveTokens = () => {
  try {
    fs.writeFileSync(
      FCM_TOKENS_FILE,
      JSON.stringify(fcmTokens, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Error saving FCM tokens to file:", error);
  }
};

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err));

// --- API एंडपॉइंट: FCM टोकन रजिस्टर करें ---
// यह एंडपॉइंट आपके React Native ऐप से FCM टोकन प्राप्त करेगा
app.post("/api/register-fcm-token", (req, res) => {
  const { fcmToken, userId } = req.body; // userId को आपके ऐप से भेजा जाना चाहिए

  if (!fcmToken) {
    return res.status(400).json({ error: "FCM टोकन आवश्यक है।" });
  }

  // डुप्लीकेट टोकन से बचें और मौजूदा टोकन को अपडेट करें
  const existingTokenIndex = fcmTokens.findIndex(
    (t) => t.fcmToken === fcmToken
  );
  if (existingTokenIndex === -1) {
    fcmTokens.push({
      fcmToken,
      userId,
      registeredAt: new Date().toISOString(),
    });
    saveTokens();
    console.log(
      `नया FCM टोकन रजिस्टर हुआ: ${fcmToken} (यूज़र: ${userId || "अज्ञात"})`
    );
    res.status(200).json({ message: "FCM टोकन सफलतापूर्वक रजिस्टर हुआ।" });
  } else {
    // अगर टोकन पहले से है, तो उसे अपडेट करें (जैसे lastSeen टाइम)
    fcmTokens[existingTokenIndex].registeredAt = new Date().toISOString();
    // आप चाहें तो userId भी अपडेट कर सकते हैं अगर यह बदलता है
    if (userId && fcmTokens[existingTokenIndex].userId !== userId) {
      fcmTokens[existingTokenIndex].userId = userId;
    }
    saveTokens();
    res
      .status(200)
      .json({ message: "FCM टोकन पहले से मौजूद है और अपडेट हुआ।" });
  }
});

// --- नोटिफिकेशन भेजने का फंक्शन ---
// अब यह पूरी शायरी लिस्ट और रैंडम इंडेक्स भी स्वीकार करता है
async function sendShayariNotification(
  token,
  title,
  body,
  dataPayload = {},
  allShayaris = [],
  randomIndex = -1
) {
  // FCM डेटा पेलोड में केवल स्ट्रिंग वैल्यू स्वीकार करता है, इसलिए एरे को JSON स्ट्रिंगिफ़ाई करें
  const message = {
    notification: {
      title: title,
      body: body,
    },
    data: {
      ...dataPayload,
      type: "daily_shayari", // कस्टम डेटा जो ऐप में हैंडल किया जा सकता है
      // all_shayaris: JSON.stringify(
      //   allShayaris.map((s) => ({ _id: s._id, content: s.content }))
      // ), // केवल ID और content भेजें
      random_index: String(randomIndex), // इंडेक्स को स्ट्रिंग के रूप में भेजें
    },
    token: token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("सफलतापूर्वक नोटिफिकेशन भेजा:", response);
  } catch (error) {
    console.error("नोटिफिकेशन भेजने में त्रुटि:", error);
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      console.log(`अमान्य/अप्रयुक्त टोकन हटाया जा रहा है: ${token}`);
      fcmTokens = fcmTokens.filter((t) => t.fcmToken !== token);
      saveTokens();
    }
  }
}

// --- हर मिनट नोटिफिकेशन भेजने के लिए क्रॉन जॉब ---
// '* * * * *' का मतलब है हर मिनट चलेगा
cron.schedule("* * * * *", async () => {
  console.log("हर मिनट की शायरी नोटिफिकेशन भेज रहा हूँ...");
  if (fcmTokens.length === 0) {
    console.log("कोई FCM टोकन रजिस्टर नहीं है।");
    return;
  }

  try {
    const currentHour = new Date().getHours();
    console.log(currentHour);

    let notificationTitle = "आज की शायरी 🌟"; // डिफ़ॉल्ट टाइटल

    if (currentHour === 10) {
      // सुबह 10 बजे
      notificationTitle = "Good Morning! ☀️";
    } else if (currentHour === 21) {
      // रात 9 बजे (21:00)
      notificationTitle = "Good Night! 🌙";
    }
    // MongoDB से सभी शायरियाँ प्राप्त करें
    const allShayaris = await Shayari.find({}); // सभी शायरियाँ फेच करें
    const count = allShayaris.length;
    console.log(count);

    if (count === 0) {
      console.log("डेटाबेस में कोई शायरी नहीं मिली।");
      return;
    }

    const random = Math.floor(Math.random() * count);
    const randomShayari = allShayaris[random]; // एरे से रैंडम शायरी चुनें
    console.log("random", random);

    if (randomShayari) {
      const shayariText = randomShayari.text || "आज की खूबसूरत शायरी!"; // अपनी शायरी मॉडल के अनुसार फील्ड नेम बदलें
      const shayariId = randomShayari._id.toString(); // शायरी ID भेजें

      // सभी रजिस्टर किए गए टोकन को नोटिफिकेशन भेजें
      for (const user of fcmTokens) {
        await sendShayariNotification(
          user.fcmToken,
          notificationTitle,
          shayariText,
          { shayari_id: shayariId },
          // allShayaris, // पूरी शायरी लिस्ट भेजें
          random
        );
      }
    } else {
      console.log("रैंडम शायरी नहीं मिल पाई।");
    }
  } catch (error) {
    console.error("क्रॉन जॉब में त्रुटि:", error);
  }
});

// Routes (आपके मौजूदा रूट्स)
app.use("/api/admin", adminroutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/shayaris", shayariRoutes);
app.use("/api/users/auth", usersRoutes);
app.use("/api/users/shayaris", usersShayarisRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
