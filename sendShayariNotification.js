// sendShayariNotification.js
import admin from "firebase-admin";
import FCMToken from "./models/FcmToken.js";
import Shayari from "./models/Shayari.js";

// ✅ Notification भेजने का function
export async function sendShayariNotification(
  token,
  title,
  body,
  dataPayload = {}
) {
  const message = {
    notification: {
      title: "Random Shayari",
      body: shayariText,
    },
    data: {
      ...dataPayload,
    },
    android: {
      priority: "high",
    },
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Notification sent:", response);
  } catch (error) {
    console.error("❌ Error sending notification:", error);
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      await FCMToken.deleteOne({ fcmToken: token });
    }
  }
}

// ✅ Random Shayari भेजने का function
export async function sendRandomShayari() {
  try {
    const allTokens = await FCMToken.find({});
    console.log("Token Length", allTokens.length);

    if (!allTokens.length) {
      console.log("❌ No FCM tokens found.");
      return;
    }

    const allShayaris = await Shayari.find({});
    console.log("Shayari length", allShayaris);

    if (!allShayaris.length) {
      console.log("❌ No Shayaris found in DB.");
      return;
    }

    const random = Math.floor(Math.random() * allShayaris.length);
    const randomShayari = allShayaris[random];
    const shayariText = randomShayari.text || "आज की खूबसूरत शायरी!";
    const shayariId = randomShayari._id.toString();

    for (const tokenDoc of allTokens) {
      await sendShayariNotification(
        tokenDoc.fcmToken,
        "आज की शायरी 🌟",
        shayariText,
        { shayari_id: shayariId, random_index: String(random) }
      );
    }
  } catch (err) {
    console.error("Error sending random Shayari:", err);
  }
}
