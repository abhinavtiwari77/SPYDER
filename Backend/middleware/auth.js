const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function decodeUserFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment variables");
  }

  const payload = jwt.verify(token, secret);
  if (!payload?.sub) return null;

  const user = await User.findById(payload.sub);
  return user || null;
}

async function requireAuth(req, res, next) {
  try {
    const user = await decodeUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "A valid access token is required",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired access token",
    });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const user = await decodeUserFromRequest(req);
    req.user = user;
    return next();
  } catch (error) {
    req.user = null;
    return next();
  }
}

module.exports = {
  requireAuth,
  optionalAuth,
};
