import React,{ useEffect, useRef, useState } from "react";
import { Bot, Send, X, FileText, Upload, Trash2, MessageSquare, BookOpen, LoaderCircle } from "lucide-react";
import api from "./api";

export default function ChatWidget({ user }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("chat");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", answer: "Hi! Ask me about uploaded hiring documents or live jobs and candidates. I will cite document sources when I use them." }]);
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const isRecruiter = user?.role === "Recruiter";

  const loadDocuments = async () => {
    try { const { data } = await api.get("/documents"); setDocuments(data); }
    catch (e) { setError(e.response?.data?.message || "Could not load documents"); }
  };
  useEffect(() => { if (open) loadDocuments(); }, [open]);
  useEffect(() => {
    if (!open || tab !== "documents") return;
    const timer = setInterval(loadDocuments, 5000);
    return () => clearInterval(timer);
  }, [open, tab]);

  const send = async e => {
    e.preventDefault();
    const value = question.trim();
    if (!value || busy) return;
    setQuestion(""); setError(""); setBusy(true);
    setMessages(prev => [...prev, { role: "user", question: value }]);
    try {
      const { data } = await api.post("/chat", { question: value });
      setMessages(prev => [...prev, { role: "assistant", answer: data.answer, sources: data.sources || [], toolResults: data.tool_results || [] }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", answer: e.response?.data?.message || "The assistant could not process this question. Check your API configuration and try again." }]);
    } finally { setBusy(false); }
  };

  const upload = async e => {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    const form = new FormData(); form.append("file", file);
    setUploading(true); setError("");
    try {
      await api.post("/documents/upload", form);
      fileInput.current.value = "";
      await loadDocuments();
    } catch (e) { setError(e.response?.data?.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const removeDocument = async doc => {
    if (!confirm(`Delete ${doc.original_name} and its indexed chunks?`)) return;
    try { await api.delete(`/documents/${doc._id}`); await loadDocuments(); }
    catch (e) { setError(e.response?.data?.message || "Could not delete document"); }
  };

  return <>
    {!open && <button className="chat-launcher" onClick={() => setOpen(true)} aria-label="Open AI assistant"><Bot size={20}/><span>AI Assistant</span></button>}
    {open && <section className="chat-widget">
      <header className="chat-header"><div className="chat-header-icon"><Bot size={19}/></div><div><b>TalentDesk AI</b><span>Recruitment assistant</span></div><button className="icon-button" onClick={() => setOpen(false)}><X size={18}/></button></header>
      <div className="chat-tabs"><button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}><MessageSquare size={14}/> Chat</button><button className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}><BookOpen size={14}/> Knowledge base</button></div>
      {error && <div className="chat-error">{error}<button onClick={() => setError("")}>×</button></div>}
      {tab === "chat" ? <>
        <div className="chat-messages">
          {messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}>
            <div className="message-bubble">{message.role === "assistant" && <span className="assistant-label"><Bot size={13}/> TalentDesk AI</span>}{message.question || message.answer}
              {!!message.sources?.length && <div className="citation-list"><b>Document sources</b>{message.sources.map((source, i) => <span key={i}><FileText size={12}/>{source.filename} · {source.page ? `Page ${source.page}` : `Chunk ${source.chunk}`}</span>)}</div>}
              {!!message.toolResults?.length && <div className="tool-source"><b>Live database lookup</b>{message.toolResults.map((item, i) => <span key={i}>{item.tool.replaceAll("_", " ")}</span>)}</div>}
            </div>
          </div>)}
          {busy && <div className="chat-message assistant"><div className="message-bubble typing"><LoaderCircle size={14}/> Searching documents and app data…</div></div>}
        </div>
        <form className="chat-compose" onSubmit={send}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about candidates or policies…" maxLength={2000}/><button disabled={!question.trim() || busy}><Send size={16}/></button></form>
        <p className="chat-hint">Answers are grounded in uploaded documents and read-only recruitment data.</p>
      </> : <div className="knowledge-content">
        <div className="knowledge-intro"><b>Uploaded documents</b><span>PDF and TXT · Max 10 MB each</span></div>
        {isRecruiter ? <form className="upload-form" onSubmit={upload}><input ref={fileInput} type="file" accept=".pdf,.txt,application/pdf,text/plain" required/><button disabled={uploading}><Upload size={14}/>{uploading ? "Uploading…" : "Upload"}</button></form> : <p className="viewer-note">Only Recruiters can upload or delete documents. You can ask questions about indexed documents in the Chat tab.</p>}
        <div className="document-list">{documents.map(doc => <div className="document-row" key={doc._id}><FileText size={18}/><div className="document-meta"><b title={doc.original_name}>{doc.original_name}</b><span>{doc.chunk_count} chunks · {(doc.size_bytes / 1024).toFixed(0)} KB</span><small className={`doc-status ${doc.status}`}>{doc.status}{doc.error_message ? ` — ${doc.error_message}` : ""}</small></div>{isRecruiter && <button className="icon-button danger-text" title="Delete document" onClick={() => removeDocument(doc)}><Trash2 size={14}/></button>}</div>)}{!documents.length && <div className="empty">No documents uploaded yet.</div>}</div>
      </div>}
    </section>}
  </>;
}
