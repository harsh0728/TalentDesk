import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null
};

export const documentQueue = new Queue("talentdesk-document-ingestion", { connection });
export async function enqueueDocument(documentId) {
  return documentQueue.add("ingest-document", { documentId }, {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 200
  });
}
