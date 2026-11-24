import { Router } from "express";
import mongoose from "mongoose";
import Candidate from "../models/Candidate.js";
import Job from "../models/Job.js";
import StageEvent from "../models/StageEvent.js";
import { CANDIDATE_STAGES } from "../constants.js";
import { authenticate, requireRecruiter } from "../middleware/auth.js";
const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const { search = "", stage, job, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (stage && CANDIDATE_STAGES.includes(stage)) filter.stage = stage;
    if (job && mongoose.isValidObjectId(job)) filter.job = job;
    if (search.trim()) {
      const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }];
    }
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
    const [items, total] = await Promise.all([
      Candidate.find(filter).populate("job", "title client_name").sort({ updated_at: -1 })
        .skip((pageNum - 1) * limitNum).limit(limitNum),
      Candidate.countDocuments(filter)
    ]);
    res.json({ items, total, page: pageNum, pages: Math.max(1, Math.ceil(total / limitNum)) });
  } catch (err) { next(err); }
});

router.post("/", requireRecruiter, async (req, res, next) => {
  try {
    if (!(await Job.exists({ _id: req.body.job }))) return res.status(400).json({ message: "Select a valid job" });
    const candidate = await Candidate.create(req.body);
    await StageEvent.create({ candidate: candidate._id, from_stage: null, to_stage: candidate.stage, changed_by: req.user._id });
    res.status(201).json(await candidate.populate("job", "title client_name"));
  } catch (err) { next(err); }
});
router.get("/:id", async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id).populate("job");
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    res.json(candidate);
  } catch (err) { next(err); }
});
router.put("/:id", requireRecruiter, async (req, res, next) => {
  try {
    if (req.body.job && !(await Job.exists({ _id: req.body.job }))) return res.status(400).json({ message: "Select a valid job" });
    if (req.body.stage) return res.status(400).json({ message: "Use move-stage endpoint to change candidate stage" });
    const candidate = await Candidate.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate("job", "title client_name");
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    res.json(candidate);
  } catch (err) { next(err); }
});
router.delete("/:id", requireRecruiter, async (req, res, next) => {
  try {
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    // History is retained as an audit trail; it is deliberately not deleted.
    res.json({ message: "Candidate deleted. Its stage history has been retained." });
  } catch (err) { next(err); }
});
router.post("/:id/move-stage", requireRecruiter, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { stage } = req.body;
    if (!CANDIDATE_STAGES.includes(stage)) return res.status(400).json({ message: "Invalid candidate stage" });
    let updated;
    await session.withTransaction(async () => {
      const candidate = await Candidate.findById(req.params.id).session(session);
      if (!candidate) {
        const error = new Error("Candidate not found"); error.status = 404; throw error;
      }
      if (candidate.stage === stage) {
        const error = new Error("Candidate is already in this stage"); error.status = 400; throw error;
      }
      const fromStage = candidate.stage;
      candidate.stage = stage;
      await candidate.save({ session });
      await StageEvent.create([{
        candidate: candidate._id, from_stage: fromStage, to_stage: stage, changed_by: req.user._id
      }], { session });
      updated = candidate;
    });
    res.json(await updated.populate("job", "title client_name"));
  } catch (err) { next(err); }
  finally { await session.endSession(); }
});
router.get("/:id/history", async (req, res, next) => {
  try {
    const candidateExists = await Candidate.exists({ _id: req.params.id });
    if (!candidateExists) return res.status(404).json({ message: "Candidate not found" });
    const history = await StageEvent.find({ candidate: req.params.id })
      .populate("changed_by", "name email").sort({ created_at: 1 });
    res.json(history);
  } catch (err) { next(err); }
});
export default router;
