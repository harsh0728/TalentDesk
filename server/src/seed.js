import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Job from "./models/Job.js";
import Candidate from "./models/Candidate.js";
import StageEvent from "./models/StageEvent.js";

await connectDB();
if (await Job.countDocuments()) {
  console.log("Seed skipped: existing jobs detected; preserving application data.");
  await mongoose.disconnect();
  process.exit(0);
}
const password = await bcrypt.hash("Recruiter123!", 10);
const [recruiter, viewer] = await Promise.all([
  User.findOneAndUpdate({ email: "recruiter@talentdesk.local" },
    { name: "Demo Recruiter", email: "recruiter@talentdesk.local", password, role: "Recruiter" },
    { upsert: true, new: true, setDefaultsOnInsert: true }),
  User.findOneAndUpdate({ email: "viewer@talentdesk.local" },
    { name: "Demo Viewer", email: "viewer@talentdesk.local", password, role: "Viewer" },
    { upsert: true, new: true, setDefaultsOnInsert: true })
]);
await Candidate.deleteMany({});
await StageEvent.deleteMany({});
await Job.deleteMany({});
const jobs = await Job.insertMany([
  { title: "Python Developer", client_name: "ABC Technologies", location: "Bangalore", openings: 3, status: "Open" },
  { title: "React Developer", client_name: "Northstar Labs", location: "Noida", openings: 2, status: "Open" },
  { title: "Node.js Developer", client_name: "BrightApps", location: "Remote", openings: 4, status: "On hold" }
]);
const names = [
  ["Rahul Sharma","rahul.sharma@example.com","9876500001",5,8,30,0,"Interviewed"],
  ["Amit Verma","amit.verma@example.com","9876500002",6,9,15,0,"Selected"],
  ["Neha Singh","neha.singh@example.com","9876500003",4,7,45,0,"Applied"],
  ["Karan Gupta","karan.gupta@example.com","9876500004",7,10,60,0,"Screened"],
  ["Pooja Das","pooja.das@example.com","9876500005",5,8,0,0,"Joined"],
  ["Riya Mehta","riya.mehta@example.com","9876500006",6,9,30,1,"Selected"],
  ["Arjun Rao","arjun.rao@example.com","9876500007",8,12,90,1,"Interviewed"],
  ["Sneha Jain","sneha.jain@example.com","9876500008",4,6,15,1,"Applied"],
  ["Vikas Kumar","vikas.kumar@example.com","9876500009",7,10,30,1,"Rejected"],
  ["Anjali Roy","anjali.roy@example.com","9876500010",6,9,60,1,"Screened"],
  ["Mohit Sinha","mohit.sinha@example.com","9876500011",7,11,30,2,"Applied"],
  ["Simran Kaur","simran.kaur@example.com","9876500012",5,8,45,2,"Interviewed"],
  ["Deepak Yadav","deepak.yadav@example.com","9876500013",9,13,0,2,"Joined"],
  ["Isha Kapoor","isha.kapoor@example.com","9876500014",6,9,20,2,"Selected"],
  ["Nitin Das","nitin.das@example.com","9876500015",5,7,60,2,"Rejected"]
];
const candidates = await Candidate.insertMany(names.map(n => ({
  name:n[0], email:n[1], phone:n[2], current_ctc:n[3], expected_ctc:n[4],
  notice_days:n[5], job:jobs[n[6]]._id, stage:n[7]
})));
await StageEvent.insertMany(candidates.map(c => ({
  candidate:c._id, from_stage:null, to_stage:c.stage, changed_by:recruiter._id
})));
console.log(`Seed complete: ${jobs.length} jobs, ${candidates.length} candidates. Viewer: ${viewer.email}`);
await mongoose.disconnect();
