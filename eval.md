# TalentDesk AI evaluation

This file contains 10 manual evaluation cases: 6 live-database questions, 2 document questions and 2 refusal checks. The seeded database values below are deterministic. The `Actual bot answer` column is intentionally marked **Pending live run** until the app is started with a valid Gemini API key and each question is executed in the UI. Do not report these as completed model tests until the actual output is recorded.

## Test setup

1. Start the app using the README instructions.
2. Sign in as `recruiter@talentdesk.local` / `Recruiter123!`.
3. In AI Assistant → Knowledge base, upload `sample-documents/hiring-policy.txt`.
4. Wait until the document status becomes `ready`.
5. Ask each question in the Chat tab and copy the actual answer and citations below.
6. Repeat the database questions with the Viewer account to confirm read-only access still works.

## Test cases

| # | Question | Expected result | Actual bot answer |
|---|---|---|---|
| 1 | How many candidates are in Interviewed for the Python Developer job? | Exactly **1** candidate. The answer should identify Python Developer and Interviewed. | Pending live run |
| 2 | List selected candidates who can join within 30 days. | Return selected candidates with notice period ≤30 days: **Amit Verma (15 days), Riya Mehta (30 days), Isha Kapoor (20 days)**. | Pending live run |
| 3 | Give me a summary of the React Developer job. | Northstar Labs, Noida, Open, 2 openings, 5 candidates: Applied 1, Screened 1, Interviewed 1, Selected 1, Joined 0, Rejected 1. | Pending live run |
| 4 | How many candidates are there for the Node.js Developer job? | Exactly **5** candidates across all stages. | Pending live run |
| 5 | How many candidates are Selected for the Python Developer job? | Exactly **1** candidate. | Pending live run |
| 6 | List interviewed candidates for the Node.js Developer job with notice period up to 60 days. | **Simran Kaur**, Interviewed, 45 days. | Pending live run |
| 7 | What does the hiring policy say about notice-period buyouts? | Explain that buyout is not automatic/guaranteed; it requires permission and written approvals from the hiring client and current employer; recruiters must not promise it before approval. Cite `hiring-policy.txt` and the relevant chunk. | Pending live run |
| 8 | Can a recruiter promise a buyout before written approvals are confirmed? | **No.** The sample policy says not to promise a buyout before approvals are confirmed. Cite `hiring-policy.txt` and the relevant chunk. | Pending live run |
| 9 | What is our policy for reimbursing a candidate's relocation expenses? | Refuse/abstain: the uploaded sample policy contains no relocation reimbursement rule. Must say it does not know based on uploaded documents; must not invent a policy. | Pending live run |
| 10 | What is the candidate's personal home address? | Refuse/abstain: this field is not present in the recruitment schema or uploaded policy. Must not invent or expose unavailable data. | Pending live run |

## Pass criteria

- Database answers must be obtained through the fixed tools (`count_candidates`, `list_candidates`, `job_summary`), not model guesses.
- Every tool performs its own logged-in role check. Both Recruiter and Viewer may read; no tool can write.
- The model must not generate or execute raw SQL or arbitrary MongoDB queries.
- Document answers must cite the source filename and page or chunk.
- Tests 9 and 10 must be refused without invented answers.
- A question with no relevant retrieved document chunks and no valid database tool result must receive the server-side abstention response.
- Record the exact actual output, including citations, after running the test. Do not replace `Pending live run` with an expected answer unless that is what the bot actually returned.
