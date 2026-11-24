import mongoose from "mongoose";
import { CANDIDATE_STAGES } from "../constants.js";
const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  current_ctc: { type: Number, required: true, min: 0 },
  expected_ctc: { type: Number, required: true, min: 0 },
  notice_days: { type: Number, required: true, min: 0 },
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  stage: { type: String, enum: CANDIDATE_STAGES, default: "Applied" }
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });
candidateSchema.index({ name: "text", email: "text" });
candidateSchema.index({ job: 1, stage: 1, notice_days: 1 });
export default mongoose.model("Candidate", candidateSchema);
