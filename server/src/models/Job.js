import mongoose from "mongoose";
import { JOB_STATUSES } from "../constants.js";
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  client_name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  openings: { type: Number, required: true, min: 1 },
  status: { type: String, enum: JOB_STATUSES, default: "Open" }
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });
export default mongoose.model("Job", jobSchema);
