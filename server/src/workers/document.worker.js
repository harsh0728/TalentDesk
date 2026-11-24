import "dotenv/config";
import mongoose from "mongoose";
import { Worker } from "bullmq";
import { connectDB } from "../config/db.js";
import { ingestDocument } from "../services/documentIngestion.js";

await connectDB();
const worker = new Worker("talentdesk-document-ingestion", async job => {
  console.log(`Processing document ${job.data.documentId}`);
  await ingestDocument(job.data.documentId);
  console.log(`Finished document ${job.data.documentId}`);
}, {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null
  },
  concurrency: 2
});

worker.on("failed", (job, error) => console.error(`Document job ${job?.id} failed:`, error.message));
worker.on("error", error => console.error("Worker error:", error));

async function shutdown() {
  await worker.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
console.log("TalentDesk document worker is running");
