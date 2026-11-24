import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { createEmbedding, generateWithTools, completeToolCalls } from "../services/gemini.js";
import { searchChunks } from "../services/vectorStore.js";
import { TOOL_EXECUTORS } from "../services/recruitmentTools.js";

const router = Router();
router.use(authenticate);

router.post("/", async (req, res, next) => {
  try {
    const question = String(req.body.question || "").trim();
    if (!question) return res.status(400).json({ message: "Question is required" });
    if (question.length > 2000) return res.status(400).json({ message: "Question must be 2,000 characters or fewer" });

    const queryVector = await createEmbedding(question, "RETRIEVAL_QUERY");
    const matches = await searchChunks(queryVector, 5);
    const relevant = matches.filter(item => item.score >= Number(process.env.RAG_SCORE_THRESHOLD || 0.42));
    const context = relevant.map((item, index) => {
      const p = item.payload;
      const citation = p.page_number ? `${p.original_name}, page ${p.page_number}` : `${p.original_name}, chunk ${p.chunk_index}`;
      return `[D${index + 1}] Source: ${citation}\n${p.text}`;
    }).join("\n\n");

    const needsDatabase = /\b(how many|count|list|show|find|who|which|summary|summarize|summarise)\b/i.test(question)
      && /\b(candidates?|applicants?|jobs?|openings?)\b/i.test(question);
    const result = await generateWithTools({ question, context });
    const toolResults = [];
    const functionResponses = [];
    for (const call of result.calls) {
      const executor = TOOL_EXECUTORS[call.name];
      let response;
      if (!executor) response = { error: "This tool is not available" };
      else {
        try {
          response = await executor(call.args || {}, req.user);
          toolResults.push({ tool: call.name, result: response });
        } catch (error) {
          response = { error: error.message || "Tool execution failed" };
        }
      }
      functionResponses.push({ name: call.name, response });
    }

    let answer = result.firstText;
    if (result.calls.length) {
      answer = await completeToolCalls({ question, context, functionParts: result.functionParts, functionResponses });
    } else if (needsDatabase) {
      // Do not let a semantically similar document passage substitute for a live database lookup.
      answer = "I couldn't retrieve a live recruitment-data result for that question. Please rephrase it with a job title and/or a recruitment stage.";
    } else if (!relevant.length) {
      // Server-side abstention: do not allow model-only answers without retrieved evidence or a DB tool result.
      answer = "I don't know based on the uploaded documents or available recruitment data. Please upload a relevant document or ask about a job/candidate in TalentDesk.";
    }
    if (!answer) answer = "I don't know based on the available TalentDesk data.";

    const sources = relevant.map(item => ({
      type: "document",
      filename: item.payload.original_name,
      page: item.payload.page_number || null,
      chunk: item.payload.chunk_index,
      score: Number(item.score.toFixed(3))
    }));
    const uniqueSources = [...new Map(sources.map(source => [`${source.filename}:${source.page || source.chunk}`, source])).values()];
    res.json({ answer, sources: uniqueSources, tool_results: toolResults });
  } catch (err) { next(err); }
});
export default router;
