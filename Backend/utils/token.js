const jwt = require("jsonwebtoken");

function signAccessToken(userId) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment variables");
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign({ sub: String(userId) }, secret, { expiresIn });
}

module.exports = {
  signAccessToken,
};
