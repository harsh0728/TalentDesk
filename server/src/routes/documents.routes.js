import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import KnowledgeDocument from "../models/KnowledgeDocument.js";
import { authenticate, requireRecruiter } from "../middleware/auth.js";
import { enqueueDocument } from "../services/documentQueue.js";
import { deleteDocumentPoints } from "../services/vectorStore.js";

const router = Router();
const uploadDir = process.env.UPLOAD_DIR || "/app/uploads";
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (![".pdf", ".txt"].includes(ext)) { const error = new Error("Only PDF and TXT files are supported"); error.status = 400; return cb(error); }
    if (ext === ".pdf" && file.mimetype !== "application/pdf") { const error = new Error("Invalid PDF file type"); error.status = 400; return cb(error); }
    cb(null, true);
  }
});
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const docs = await KnowledgeDocument.find().select("original_name mime_type size_bytes status chunk_count error_message created_at")
      .populate("uploaded_by", "name").sort({ created_at: -1 });
    res.json(docs);
  } catch (err) { next(err); }
});

router.post("/upload", requireRecruiter, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose a PDF or TXT file" });
    const doc = await KnowledgeDocument.create({
      filename: req.file.filename,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      uploaded_by: req.user._id,
      status: "queued"
    });
    await enqueueDocument(String(doc._id));
    res.status(202).json({ message: "Document uploaded and queued for processing", document: doc });
  } catch (err) { next(err); }
});

router.delete("/:id", requireRecruiter, async (req, res, next) => {
  try {
    const doc = await KnowledgeDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    if (["queued", "processing"].includes(doc.status)) return res.status(409).json({ message: "Wait until document processing finishes before deleting it" });
    await deleteDocumentPoints(String(doc._id));
    await fs.promises.unlink(path.join(uploadDir, doc.filename)).catch(() => {});
    await doc.deleteOne();
    res.json({ message: "Document and its indexed chunks deleted" });
  } catch (err) { next(err); }
});

export default router;
