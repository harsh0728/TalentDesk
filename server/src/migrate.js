import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Job from "./models/Job.js";
import Candidate from "./models/Candidate.js";
import StageEvent from "./models/StageEvent.js";
import KnowledgeDocument from "./models/KnowledgeDocument.js";

await connectDB();
await Promise.all([
  User.syncIndexes(),
  Job.syncIndexes(),
  Candidate.syncIndexes(),
  StageEvent.syncIndexes(),
  KnowledgeDocument.syncIndexes()
]);
console.log("MongoDB indexes are up to date");
await mongoose.disconnect();
