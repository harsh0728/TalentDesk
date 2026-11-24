export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.name === "MulterError") return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "File must be 10 MB or smaller" : err.message });
  if (err.code === 11000) return res.status(409).json({ message: "Email already exists" });
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ message: err.message });
  }
  res.status(err.status || 500).json({ message: err.message || "Server error" });
}
