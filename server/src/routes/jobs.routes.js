import { Router } from "express";
import Job from "../models/Job.js";
import Candidate from "../models/Candidate.js";
import { authenticate, requireRecruiter } from "../middleware/auth.js";
const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const jobs = await Job.find().sort({ created_at: -1 }).lean();
    const counts = await Candidate.aggregate([
      { $group: { _id: { job: "$job", stage: "$stage" }, count: { $sum: 1 } } }
    ]);
    const result = jobs.map(job => {
      const stageCounts = {};
      counts.filter(c => String(c._id.job) === String(job._id))
        .forEach(c => { stageCounts[c._id.stage] = c.count; });
      return { ...job, candidate_count: Object.values(stageCounts).reduce((a, b) => a + b, 0), stage_counts: stageCounts };
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post("/", requireRecruiter, async (req, res, next) => {
  try { res.status(201).json(await Job.create(req.body)); }
  catch (err) { next(err); }
});
router.get("/:id", async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (err) { next(err); }
});
router.put("/:id", requireRecruiter, async (req, res, next) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (err) { next(err); }
});
router.delete("/:id", requireRecruiter, async (req, res, next) => {
  try {
    const linked = await Candidate.exists({ job: req.params.id });
    if (linked) return res.status(409).json({ message: "Move or delete this job's candidates before deleting the job" });
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json({ message: "Job deleted" });
  } catch (err) { next(err); }
});
export default router;
