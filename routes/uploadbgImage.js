import express from "express";
import fileUpload from "express-fileupload";
import { uploadBgImage } from "../controllers/uploadBgImages.js";

const router = express.Router();

// Middleware to handle file upload
router.use(fileUpload());

router.post("/upload-bg-image", uploadBgImage);

export default router;
