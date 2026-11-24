import React, { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Users, LogOut, Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight, Clock3, X, RefreshCw } from "lucide-react";
import api from "./api";
import ChatWidget from "./ChatWidget.jsx";

const STAGES = ["Applied", "Screened", "Interviewed", "Selected", "Joined", "Rejected"];
const emptyCandidate = { name:"", email:"", phone:"", current_ctc:"", expected_ctc:"", notice_days:"", job:"", stage:"Applied" };
const emptyJob = { title:"", client_name:"", location:"", openings:1, status:"Open" };

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("talentdesk_user")); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem("talentdesk_token"));
  const [loginError, setLoginError] = useState("");
  const [email, setEmail] = useState("recruiter@talentdesk.local");
  const [password, setPassword] = useState("Recruiter123!");
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [candidates, setCandidates] = useState({ items:[], total:0, page:1, pages:1 });
  const [filters, setFilters] = useState({ search:"", stage:"", page:1 });
  const [modal, setModal] = useState(null);
  const [candidateForm, setCandidateForm] = useState(emptyCandidate);
  const [jobForm, setJobForm] = useState(emptyJob);
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isRecruiter = user?.role === "Recruiter";

  const request = async fn => {
    setError("");
    try { await fn(); }
    catch (e) { setError(e.response?.data?.message || "Something went wrong. Please try again."); }
  };

  const loadJobs = async () => {
    const { data } = await api.get("/jobs");
    setJobs(data);
    if (selectedJob) {
      const updated = data.find(j => j._id === selectedJob._id);
      setSelectedJob(updated || null);
    }
  };
  const loadCandidates = async (jobId = selectedJob?._id, page = filters.page) => {
    if (!jobId) return;
    const params = { job:jobId, page, limit:8, search:filters.search, stage:filters.stage };
    const { data } = await api.get("/candidates", { params });
    setCandidates(data);
  };
  useEffect(() => {
    if (token && user) request(async () => { await loadJobs(); });
  }, [token]);
  useEffect(() => {
    if (selectedJob) request(async () => { await loadCandidates(selectedJob._id); });
  }, [selectedJob?._id, filters.search, filters.stage, filters.page]);
  const login = async e => {
    e.preventDefault(); setBusy(true); setLoginError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("talentdesk_token", data.token);
      localStorage.setItem("talentdesk_user", JSON.stringify(data.user));
      setToken(data.token); setUser(data.user);
    } catch (e) { setLoginError(e.response?.data?.message || "Unable to login"); }
    finally { setBusy(false); }
  };
  const logout = () => {
    localStorage.removeItem("talentdesk_token"); localStorage.removeItem("talentdesk_user");
    setToken(null); setUser(null); setJobs([]); setSelectedJob(null);
  };
  const saveJob = async e => {
    e.preventDefault(); setBusy(true);
    await request(async () => {
      if (modal?.type === "editJob") await api.put(`/jobs/${modal.id}`, jobForm);
      else await api.post("/jobs", jobForm);
      setModal(null); await loadJobs();
    });
    setBusy(false);
  };
  const deleteJob = job => {
    if (!confirm(`Delete "${job.title}"? Jobs with candidates cannot be deleted.`)) return;
    request(async () => { await api.delete(`/jobs/${job._id}`); if (selectedJob?._id === job._id) setSelectedJob(null); await loadJobs(); });
  };
  const saveCandidate = async e => {
    e.preventDefault(); setBusy(true);
    await request(async () => {
      const payload = { ...candidateForm, current_ctc:Number(candidateForm.current_ctc), expected_ctc:Number(candidateForm.expected_ctc), notice_days:Number(candidateForm.notice_days) };
      if (modal?.type === "editCandidate") await api.put(`/candidates/${modal.id}`, payload);
      else await api.post("/candidates", payload);
      setModal(null); await loadCandidates();
      await loadJobs();
    });
    setBusy(false);
  };
  const deleteCandidate = candidate => {
    if (!confirm(`Delete ${candidate.name}? Its stage history will be retained.`)) return;
    request(async () => { await api.delete(`/candidates/${candidate._id}`); await loadCandidates(); await loadJobs(); });
  };
  const openHistory = async candidate => {
    await request(async () => {
      const { data } = await api.get(`/candidates/${candidate._id}/history`);
      setHistory({ candidate, events:data });
    });
  };
  const moveStage = async (candidate, stage) => {
    if (!isRecruiter) return;
    if (stage === candidate.stage) return;
    await request(async () => { await api.post(`/candidates/${candidate._id}/move-stage`, { stage }); await loadCandidates(); await loadJobs(); });
  };
  const openCandidate = (type, candidate) => {
    setCandidateForm(candidate ? {
      name:candidate.name, email:candidate.email, phone:candidate.phone,
      current_ctc:candidate.current_ctc, expected_ctc:candidate.expected_ctc,
      notice_days:candidate.notice_days, job:candidate.job?._id || selectedJob?._id,
      stage:candidate.stage
    } : { ...emptyCandidate, job:selectedJob?._id || "" });
    setModal({ type, id:candidate?._id });
  };
  const openJob = (type, job) => {
    setJobForm(job ? { title:job.title, client_name:job.client_name, location:job.location, openings:job.openings, status:job.status } : emptyJob);
    setModal({ type, id:job?._id });
  };

  if (!token || !user) return <main className="login-shell">
    <form className="login-card" onSubmit={login}>
      <div className="brand-mark"><BriefcaseBusiness size={22}/></div>
      <p className="eyebrow">RECRUITMENT WORKSPACE</p>
      <h1>Welcome to TalentDesk</h1>
      <p className="muted">Sign in to manage jobs and candidates.</p>
      <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      {loginError && <div className="alert error">{loginError}</div>}
      <button className="primary full" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      <div className="demo-credentials"><b>Demo accounts</b><br/>Recruiter: recruiter@talentdesk.local<br/>Viewer: viewer@talentdesk.local<br/>Password: Recruiter123!</div>
    </form>
  </main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><BriefcaseBusiness size={20}/></div><span>TalentDesk</span></div>
      <div className="side-label">WORKSPACE</div>
      <button className="nav-item active"><BriefcaseBusiness size={17}/> Jobs & candidates</button>
      <div className="sidebar-bottom"><div className="avatar">{user.name?.[0] || "U"}</div><div className="user-mini"><b>{user.name}</b><span>{user.role}</span></div><button className="icon-button" title="Log out" onClick={logout}><LogOut size={17}/></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><p className="eyebrow">RECRUITMENT OVERVIEW</p><h1>Jobs & candidates</h1></div><div className="top-actions"><span className={`role-pill ${isRecruiter?"recruiter":""}`}>{user.role}</span>{isRecruiter && <button className="primary" onClick={()=>openJob("newJob")}><Plus size={16}/> Add job</button>}</div></header>
      {error && <div className="alert error">{error}<button className="icon-button" onClick={()=>setError("")}><X size={15}/></button></div>}
      <section className="stats-grid">
        <Stat icon={<BriefcaseBusiness/>} label="Total jobs" value={jobs.length}/>
        <Stat icon={<Users/>} label="Total candidates" value={jobs.reduce((n,j)=>n+(j.candidate_count||0),0)}/>
        <Stat icon={<Clock3/>} label="Open positions" value={jobs.filter(j=>j.status==="Open").reduce((n,j)=>n+j.openings,0)}/>
      </section>
      <div className="content-grid">
        <section className="panel jobs-panel">
          <div className="panel-heading"><div><h2>All jobs</h2><p className="muted">Select a job to view its candidates</p></div><span className="count">{jobs.length}</span></div>
          <div className="job-list">
            {jobs.map(job=><button key={job._id} className={`job-card ${selectedJob?._id===job._id?"selected":""}`} onClick={()=>{setSelectedJob(job);setFilters({search:"",stage:"",page:1});}}>
              <div className="job-card-top"><b>{job.title}</b><span className={`status ${job.status.toLowerCase().replace(" ","-")}`}>{job.status}</span></div>
              <span className="muted small">{job.client_name} · {job.location}</span>
              <div className="job-card-bottom"><span>{job.candidate_count || 0} candidates</span><span>{job.openings} openings</span></div>
              <div className="stage-mini">{STAGES.map(s=><span key={s} title={`${s}: ${job.stage_counts?.[s]||0}`} className={`stage-dot ${s.toLowerCase()}`}>{job.stage_counts?.[s]||0}</span>)}</div>
              {isRecruiter && <div className="job-actions" onClick={e=>e.stopPropagation()}><button className="text-button" onClick={()=>openJob("editJob",job)}><Pencil size={13}/> Edit</button><button className="text-button danger-text" onClick={()=>deleteJob(job)}><Trash2 size={13}/> Delete</button></div>}
            </button>)}
            {!jobs.length && <div className="empty">No jobs yet. Add your first job.</div>}
          </div>
        </section>
        <section className="panel candidate-panel">
          {!selectedJob ? <div className="empty large"><BriefcaseBusiness size={32}/><h3>Select a job</h3><p>Choose a job from the left to manage its candidates.</p></div> : <>
            <div className="panel-heading detail-heading"><div><p className="eyebrow">JOB DETAILS</p><h2>{selectedJob.title}</h2><p className="muted">{selectedJob.client_name} · {selectedJob.location}</p></div>{isRecruiter && <button className="primary" onClick={()=>openCandidate("newCandidate")}><Plus size={16}/> Add candidate</button>}</div>
            <div className="filter-row">
              <div className="search-box"><Search size={16}/><input placeholder="Search name or email..." value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value,page:1}))}/></div>
              <select value={filters.stage} onChange={e=>setFilters(f=>({...f,stage:e.target.value,page:1}))}><option value="">All stages</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
              <button className="icon-button" title="Refresh" onClick={()=>request(async()=>{await loadCandidates();await loadJobs();})}><RefreshCw size={16}/></button>
            </div>
            <div className="table-wrap"><table><thead><tr><th>Candidate</th><th>CTC (LPA)</th><th>Notice</th><th>Stage</th><th>Actions</th></tr></thead><tbody>
              {candidates.items.map(c=><tr key={c._id}><td><b>{c.name}</b><span className="table-sub">{c.email}</span></td><td>{c.current_ctc} → {c.expected_ctc}</td><td>{c.notice_days} days</td><td><div className="table-stage-cell"><span className={`stage-badge ${c.stage.toLowerCase()}`}>{c.stage}</span>{isRecruiter && <select className="table-stage-select" value={c.stage} onChange={e=>moveStage(c,e.target.value)} title="Move candidate stage"><option disabled value={c.stage}>Move stage…</option>{STAGES.filter(s=>s!==c.stage).map(s=><option key={s} value={s}>{s}</option>)}</select>}</div></td><td><div className="row-actions"><button className="text-button" onClick={()=>openHistory(c)} title="Stage history"><Clock3 size={15}/></button>{isRecruiter && <><button className="text-button" onClick={()=>openCandidate("editCandidate",c)} title="Edit"><Pencil size={15}/></button><button className="text-button danger-text" onClick={()=>deleteCandidate(c)} title="Delete"><Trash2 size={15}/></button></>}</div></td></tr>)}
              {!candidates.items.length && <tr><td colSpan="5"><div className="empty">No candidates match these filters.</div></td></tr>}
            </tbody></table></div>
            <div className="pagination"><span>Showing {candidates.items.length} of {candidates.total} candidates</span><div><button className="icon-button" disabled={candidates.page<=1} onClick={()=>setFilters(f=>({...f,page:f.page-1}))}><ChevronLeft size={16}/></button><span>Page {candidates.page} of {candidates.pages}</span><button className="icon-button" disabled={candidates.page>=candidates.pages} onClick={()=>setFilters(f=>({...f,page:f.page+1}))}><ChevronRight size={16}/></button></div></div>
          </>}
        </section>
      </div>
    </main>

    {modal && <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}><form className="modal" onSubmit={modal.type.includes("Job")?saveJob:saveCandidate}>
      <div className="modal-heading"><div><p className="eyebrow">{modal.type.includes("Job")?"JOB MANAGEMENT":"CANDIDATE MANAGEMENT"}</p><h2>{modal.type==="newJob"?"Add job":modal.type==="editJob"?"Edit job":modal.type==="newCandidate"?"Add candidate":"Edit candidate"}</h2></div><button type="button" className="icon-button" onClick={()=>setModal(null)}><X size={18}/></button></div>
      {modal.type.includes("Job") ? <>
        <div className="form-grid"><label>Job title<input value={jobForm.title} onChange={e=>setJobForm(f=>({...f,title:e.target.value}))} required/></label><label>Client name<input value={jobForm.client_name} onChange={e=>setJobForm(f=>({...f,client_name:e.target.value}))} required/></label><label>Location<input value={jobForm.location} onChange={e=>setJobForm(f=>({...f,location:e.target.value}))} required/></label><label>Openings<input type="number" min="1" value={jobForm.openings} onChange={e=>setJobForm(f=>({...f,openings:e.target.value}))} required/></label><label>Status<select value={jobForm.status} onChange={e=>setJobForm(f=>({...f,status:e.target.value}))}><option>Open</option><option>On hold</option><option>Closed</option></select></label></div>
      </> : <>
        <div className="form-grid"><label>Full name<input value={candidateForm.name} onChange={e=>setCandidateForm(f=>({...f,name:e.target.value}))} required/></label><label>Email<input type="email" value={candidateForm.email} onChange={e=>setCandidateForm(f=>({...f,email:e.target.value}))} required/></label><label>Phone<input value={candidateForm.phone} onChange={e=>setCandidateForm(f=>({...f,phone:e.target.value}))} required/></label><label>Current CTC (LPA)<input type="number" min="0" step="0.1" value={candidateForm.current_ctc} onChange={e=>setCandidateForm(f=>({...f,current_ctc:e.target.value}))} required/></label><label>Expected CTC (LPA)<input type="number" min="0" step="0.1" value={candidateForm.expected_ctc} onChange={e=>setCandidateForm(f=>({...f,expected_ctc:e.target.value}))} required/></label><label>Notice period (days)<input type="number" min="0" value={candidateForm.notice_days} onChange={e=>setCandidateForm(f=>({...f,notice_days:e.target.value}))} required/></label><label>Job<select value={candidateForm.job} onChange={e=>setCandidateForm(f=>({...f,job:e.target.value}))} required>{jobs.map(j=><option key={j._id} value={j._id}>{j.title}</option>)}</select></label>{modal.type==="newCandidate" && <label>Initial stage<select value={candidateForm.stage} onChange={e=>setCandidateForm(f=>({...f,stage:e.target.value}))}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></label>}</div>
      </>}
      <div className="modal-footer"><button type="button" className="secondary" onClick={()=>setModal(null)}>Cancel</button><button className="primary" disabled={busy}>{busy?"Saving...":"Save changes"}</button></div>
    </form></div>}

    <ChatWidget user={user}/>

    {history && <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setHistory(null);}}><div className="modal history-modal"><div className="modal-heading"><div><p className="eyebrow">CANDIDATE ACTIVITY</p><h2>{history.candidate.name}</h2><p className="muted">Stage history</p></div><button className="icon-button" onClick={()=>setHistory(null)}><X size={18}/></button></div>
      <div className="timeline">{history.events.map((event,i)=><div className="timeline-item" key={event._id}><div className="timeline-marker">{i+1}</div><div><b>{event.from_stage ? `${event.from_stage} → ${event.to_stage}` : `Added as ${event.to_stage}`}</b><p className="muted small">{new Date(event.created_at).toLocaleString()} · {event.changed_by?.name || "Recruiter"}</p></div></div>)}</div>
      <div className="stage-change">{isRecruiter ? <label>Move to stage<select value={history.candidate.stage} onChange={e=>{const stage=e.target.value;moveStage(history.candidate,stage).then(()=>openHistory(history.candidate));}}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></label> : <span className="muted small">Read-only history view. Recruiter role required to advance candidate stages.</span>}</div>
    </div></div>}
  </div>;
}

function Stat({icon,label,value}) { return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>; }
export default App;
