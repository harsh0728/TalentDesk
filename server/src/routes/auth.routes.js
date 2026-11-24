import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) { next(err); }
});
export default router;
