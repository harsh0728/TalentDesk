import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pdfParse from "pdf-parse";
import KnowledgeDocument from "../models/KnowledgeDocument.js";
import { createEmbedding } from "./gemini.js";
import { upsertChunks } from "./vectorStore.js";

async function extractPdf(buffer) {
  const pages = [];
  let pageNumber = 0;
  await pdfParse(buffer, {
    pagerender: async page => {
      pageNumber += 1;
      const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      const text = content.items.map(item => item.str).join(" ").replace(/\s+/g, " ").trim();
      pages.push({ page_number: pageNumber, text });
      return text;
    }
  });
  return pages.filter(page => page.text);
}

function splitIntoChunks(text, maxChars = 1100, overlap = 160) {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(" ", end);
      if (boundary > start + Math.floor(maxChars * 0.65)) end = boundary;
    }
    const value = normalized.slice(start, end).trim();
    if (value) chunks.push(value);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export async function ingestDocument(documentId) {
  const doc = await KnowledgeDocument.findById(documentId);
  if (!doc) return;
  doc.status = "processing";
  doc.error_message = "";
  await doc.save();
  const fullPath = path.join(process.env.UPLOAD_DIR || "/app/uploads", doc.filename);
  try {
    const buffer = await fs.readFile(fullPath);
    let sourcePages;
    if (doc.mime_type === "application/pdf" || doc.original_name.toLowerCase().endsWith(".pdf")) {
      sourcePages = await extractPdf(buffer);
    } else {
      const text = buffer.toString("utf8").replace(/\u0000/g, "");
      sourcePages = [{ page_number: null, text }];
    }
    if (!sourcePages.length) throw new Error("No readable text found in this file");

    const chunks = [];
    for (const page of sourcePages) {
      const pageChunks = splitIntoChunks(page.text);
      pageChunks.forEach((text, index) => chunks.push({
        id: randomUUID(),
        text,
        page_number: page.page_number,
        chunk_index: chunks.length + 1
      }));
    }
    if (!chunks.length) throw new Error("No readable text found in this file");
    if (chunks.length > 300) throw new Error("Document is too large after text extraction (maximum 300 chunks per file)");

    const vectorPoints = [];
    for (let i = 0; i < chunks.length; i += 4) {
      const batch = chunks.slice(i, i + 4);
      const vectors = await Promise.all(batch.map(chunk => createEmbedding(chunk.text, "RETRIEVAL_DOCUMENT")));
      batch.forEach((chunk, index) => vectorPoints.push({
        id: chunk.id,
        vector: vectors[index],
        payload: {
          document_id: String(doc._id),
          original_name: doc.original_name,
          page_number: chunk.page_number,
          chunk_index: chunk.chunk_index,
          text: chunk.text
        }
      }));
    }
    await upsertChunks(vectorPoints);
    doc.status = "ready";
    doc.chunk_count = chunks.length;
    await doc.save();
  } catch (error) {
    doc.status = "failed";
    doc.error_message = error.message?.slice(0, 500) || "Document processing failed";
    await doc.save();
    throw error;
  }
}
