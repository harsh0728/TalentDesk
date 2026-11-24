import Job from "../models/Job.js";
import Candidate from "../models/Candidate.js";
import { CANDIDATE_STAGES } from "../constants.js";

function assertReadAccess(user) {
  if (!user || !["Recruiter", "Viewer"].includes(user.role)) {
    const error = new Error("You are not allowed to access recruitment data");
    error.status = 403;
    throw error;
  }
}

function safeTitleRegex(title) {
  const escaped = String(title || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
}

async function findJob(jobTitle) {
  if (!jobTitle || !String(jobTitle).trim()) throw new Error("job_title is required");
  const exact = await Job.findOne({ title: safeTitleRegex(jobTitle) }).lean();
  if (exact) return exact;
  const escaped = String(jobTitle).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Job.findOne({ title: new RegExp(escaped, "i") }).lean();
}

export async function countCandidates(args, user) {
  assertReadAccess(user); // Role check is intentionally inside each tool.
  const job = await findJob(args.job_title);
  if (!job) return { found: false, message: `No job found with title '${args.job_title}'.` };
  const filter = { job: job._id };
  let stage = null;
  if (args.stage) {
    stage = CANDIDATE_STAGES.find(value => value.toLowerCase() === String(args.stage).toLowerCase());
    if (!stage) throw new Error("Invalid stage filter");
    filter.stage = stage;
  }
  const count = await Candidate.countDocuments(filter);
  return { job_title: job.title, stage: stage || "All stages", count };
}

export async function listCandidates(args, user) {
  assertReadAccess(user); // Role check is intentionally inside each tool.
  const filter = {};
  let job = null;
  if (args.job_title && String(args.job_title).trim()) {
    job = await findJob(args.job_title);
    if (!job) return { found: false, message: `No job found with title '${args.job_title}'.` };
    filter.job = job._id;
  }
  if (args.stage) {
    const stage = CANDIDATE_STAGES.find(value => value.toLowerCase() === String(args.stage).toLowerCase());
    if (!stage) throw new Error("Invalid stage filter");
    filter.stage = stage;
  }
  if (args.max_notice_days !== undefined && args.max_notice_days !== null) {
    const days = Number(args.max_notice_days);
    if (!Number.isInteger(days) || days < 0 || days > 365) throw new Error("max_notice_days must be between 0 and 365");
    filter.notice_days = { $lte: days };
  }
  const items = await Candidate.find(filter).select("name stage notice_days job")
    .populate("job", "title").sort({ name: 1 }).limit(50).lean();
  return { job_title: job?.title || "All jobs", total: items.length, candidates: items.map(c => ({
    name: c.name, job_title: c.job?.title || "Unknown job", stage: c.stage, notice_days: c.notice_days
  })) };
}

export async function jobSummary(args, user) {
  assertReadAccess(user); // Role check is intentionally inside each tool.
  const job = await findJob(args.job_title);
  if (!job) return { found: false, message: `No job found with title '${args.job_title}'.` };
  const grouped = await Candidate.aggregate([
    { $match: { job: job._id } },
    { $group: { _id: "$stage", count: { $sum: 1 } } }
  ]);
  const stage_counts = Object.fromEntries(CANDIDATE_STAGES.map(stage => [stage, 0]));
  grouped.forEach(row => { stage_counts[row._id] = row.count; });
  return {
    job_title: job.title, client_name: job.client_name, location: job.location,
    openings: job.openings, status: job.status,
    total_candidates: grouped.reduce((sum, row) => sum + row.count, 0), stage_counts
  };
}

export const TOOL_EXECUTORS = {
  count_candidates: countCandidates,
  list_candidates: listCandidates,
  job_summary: jobSummary
};
