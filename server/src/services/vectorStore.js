const QDRANT_URL = (process.env.QDRANT_URL || "http://localhost:6333").replace(/\/$/, "");
const COLLECTION = process.env.QDRANT_COLLECTION || "talentdesk_documents";

async function qdrant(path, options = {}) {
  const response = await fetch(`${QDRANT_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.status?.error || `Qdrant request failed (${response.status})`);
  return data;
}

export async function ensureCollection() {
  const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`);
  if (response.status === 200) return;
  if (response.status !== 404) throw new Error(`Cannot inspect Qdrant collection (${response.status})`);
  await qdrant(`/collections/${COLLECTION}`, {
    method: "PUT",
    body: JSON.stringify({ vectors: { size: 768, distance: "Cosine" } })
  });
}

export async function upsertChunks(chunks) {
  if (!chunks.length) return;
  await ensureCollection();
  await qdrant(`/collections/${COLLECTION}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({ points: chunks.map(chunk => ({
      id: chunk.id,
      vector: chunk.vector,
      payload: chunk.payload
    })) })
  });
}

export async function searchChunks(vector, limit = 5) {
  await ensureCollection();
  const data = await qdrant(`/collections/${COLLECTION}/points/search`, {
    method: "POST",
    body: JSON.stringify({ vector, limit, with_payload: true, score_threshold: Number(process.env.RAG_SCORE_THRESHOLD || 0.42) })
  });
  return data.result || [];
}

export async function deleteDocumentPoints(documentId) {
  await ensureCollection();
  await qdrant(`/collections/${COLLECTION}/points/delete?wait=true`, {
    method: "POST",
    body: JSON.stringify({ filter: { must: [{ key: "document_id", match: { value: documentId } }] } })
  });
}
