import { v4 as uuidv4 } from "uuid";
import { Upload } from "@aws-sdk/lib-storage";
import sharp from "sharp";
// import s3Client from "../config/s3Client.js"; // apna configured client import karo
const s3Client = new S3Client({
  region: process.env.MY_AWS_REGION,
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY,
    secretAccessKey: process.env.MY_AWS_SECRET_KEY,
  },
});

export const uploadBgImage = async (req, res) => {
  try {
    const file = req.files?.image; // frontend se form-data me "image" bhejna
    if (!file) {
      return res.status(400).json({ error: "No image provided" });
    }

    // 1. Optimize image before upload (Baseline JPEG, max width 1080px)
    const optimizedImageBuffer = await sharp(file.data)
      .resize({ width: 1080 })
      .jpeg({ quality: 80, progressive: false })
      .toBuffer();

    // 2. Create unique file name in S3
    const fileName = `bgImage/${uuidv4()}.jpeg`;

    // 3. Upload params
    const uploadParams = {
      Bucket: process.env.MY_AWS_BUCKET_NAME,
      Key: fileName,
      Body: optimizedImageBuffer,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=31536000", // caching for faster load
    };

    // 4. Upload using AWS SDK
    const uploader = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    const result = await uploader.done();

    // 5. Return S3 file URL
    res.status(201).json({
      success: true,
      url: result.Location,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Failed to upload background image" });
  }
};
