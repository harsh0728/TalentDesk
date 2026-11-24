import mongoose from "mongoose";
const stageEventSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
  from_stage: { type: String, default: null },
  to_stage: { type: String, required: true },
  changed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  created_at: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });
stageEventSchema.pre("findOneAndUpdate", function () {
  throw new Error("StageEvent records are append-only");
});
stageEventSchema.pre("deleteOne", { document: true, query: false }, function () {
  throw new Error("StageEvent records are append-only");
});
export default mongoose.model("StageEvent", stageEventSchema);
