const express = require("express");
const User = require("../models/User");
const { signAccessToken } = require("../utils/token");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const passport = require("passport");

// Redirect user to Google for OAuth.
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Google OAuth callback creates JWT then sends user back to frontend.
router.get("/google/callback", passport.authenticate("google", { session: false }), (req, res) => {
  const token = signAccessToken(req.user._id);
  const redirectBase = process.env.CLIENT_SUCCESS_URL || "http://localhost:5173/login/success";
  res.redirect(`${redirectBase}?token=${encodeURIComponent(token)}`);
});


function sanitizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

router.post("/signup", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const usernameInput = sanitizeUsername(req.body?.username || "");
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Missing fields",
        message: "name, email and password are required",
      });
    }

    if (!email.includes("@")) {
      return res.status(400).json({
        error: "Invalid email",
        message: "Please provide a valid email address",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Weak password",
        message: "Password must be at least 8 characters",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        error: "Email already in use",
        message: "This email is already registered",
      });
    }

    let username = usernameInput;
    if (!username) {
      const baseUsername = email.split("@")[0].replace(/[^a-z0-9._-]/g, "").slice(0, 20) || "user";
      let candidate = baseUsername;
      let counter = 1;
      // Generate an available username when not provided.
      while (await User.exists({ username: candidate })) {
        candidate = `${baseUsername}${counter}`;
        counter += 1;
      }
      username = candidate;
    } else {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(409).json({
          error: "Username already in use",
          message: "Try another username",
        });
      }
    }

    const user = await User.create({
      name,
      email,
      username,
      password,
    });

    const token = signAccessToken(user._id);

    return res.status(201).json({
      success: true,
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("Error in signup:", error);
    return res.status(500).json({
      error: "Signup failed",
      message: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const usernameOrEmail = String(req.body?.usernameOrEmail || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        error: "Missing fields",
        message: "usernameOrEmail and password are required",
      });
    }

    const user = await User.findOne({
      $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Incorrect username/email or password",
      });
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Incorrect username/email or password",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signAccessToken(user._id);

    return res.json({
      success: true,
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("Error in login:", error);
    return res.status(500).json({
      error: "Login failed",
      message: error.message,
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({
    success: true,
    user: req.user.toSafeObject(),
  });
});

router.put("/settings", requireAuth, async (req, res) => {
  try {
    const name = req.body?.name === undefined ? undefined : String(req.body.name || "").trim();
    const usernameRaw = req.body?.username === undefined ? undefined : req.body.username;
    const currentPassword = req.body?.currentPassword === undefined ? undefined : String(req.body.currentPassword || "");
    const newPassword = req.body?.newPassword === undefined ? undefined : String(req.body.newPassword || "");

    const updates = {};

    if (name !== undefined) {
      if (!name) {
        return res.status(400).json({
          error: "Invalid name",
          message: "Name cannot be empty",
        });
      }
      updates.name = name;
    }

    if (usernameRaw !== undefined) {
      const username = sanitizeUsername(usernameRaw);

      if (!username || username.length < 3) {
        return res.status(400).json({
          error: "Invalid username",
          message: "Username must be at least 3 valid characters",
        });
      }

      const usernameTaken = await User.findOne({
        username,
        _id: { $ne: req.user._id },
      });

      if (usernameTaken) {
        return res.status(409).json({
          error: "Username already in use",
          message: "Try another username",
        });
      }

      updates.username = username;
    }

    if (newPassword !== undefined || currentPassword !== undefined) {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: "Missing password fields",
          message: "currentPassword and newPassword are both required",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          error: "Weak password",
          message: "Password must be at least 8 characters",
        });
      }

      const userWithPassword = await User.findById(req.user._id).select("+password");
      if (!userWithPassword) {
        return res.status(404).json({
          error: "User not found",
          message: "Account no longer exists",
        });
      }

      const passwordMatches = await userWithPassword.comparePassword(currentPassword);

      if (!passwordMatches) {
        return res.status(401).json({
          error: "Invalid password",
          message: "Current password is incorrect",
        });
      }

      updates.password = newPassword;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No changes provided",
        message: "Provide at least one field to update",
      });
    }

    Object.assign(req.user, updates);
    await req.user.save();

    return res.json({
      success: true,
      message: "Settings updated successfully",
      user: req.user.toSafeObject(),
    });
  } catch (error) {
    console.error("Error in settings update:", error);
    return res.status(500).json({
      error: "Update failed",
      message: error.message,
    });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  return res.json({
    success: true,
    message: "Logged out. Delete token on client side.",
  });
});

module.exports = router;
