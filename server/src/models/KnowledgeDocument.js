import mongoose from "mongoose";

const knowledgeDocumentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  original_name: { type: String, required: true },
  mime_type: { type: String, required: true },
  size_bytes: { type: Number, required: true },
  status: { type: String, enum: ["queued", "processing", "ready", "failed"], default: "queued" },
  chunk_count: { type: Number, default: 0 },
  error_message: { type: String, default: "" },
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

export default mongoose.model("KnowledgeDocument", knowledgeDocumentSchema);
