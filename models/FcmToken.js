// models/FCMToken.js
import mongoose from "mongoose";

const FCMTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, // या स्ट्रिंग, जैसा आपके यूजर मॉडल में हो
    required: false,
  },
  fcmToken: {
    type: String,
    required: true,
    unique: true, // सुनिश्चित करें कि कोई डुप्लीकेट टोकन न हो
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const FCMToken = mongoose.model("FCMToken", FCMTokenSchema);

export default FCMToken;
