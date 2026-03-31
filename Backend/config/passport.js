const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

const backendBaseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const googleCallbackUrl =
    process.env.GOOGLE_CALLBACK_URL || `${backendBaseUrl}/auth/google/callback`;

function sanitizeUsername(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "");
}

async function buildUniqueUsername(email) {
    const localPart = String(email || "").split("@")[0];
    const baseUsername = sanitizeUsername(localPart).slice(0, 20) || "user";
    let candidate = baseUsername;
    let counter = 1;

    while (await User.exists({ username: candidate })) {
        candidate = `${baseUsername}${counter}`;
        counter += 1;
    }

    return candidate;
}

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: googleCallbackUrl
},
async (accessToken, refreshToken, profile, done) => {
    try {
        const email = String(profile?.emails?.[0]?.value || "").trim().toLowerCase();
        const name = String(profile?.displayName || "Google User").trim();

        if (!email) {
            return done(new Error("Google profile did not include an email"), null);
    }

        let user = await User.findOne({ email });

        if (!user) {
            const username = await buildUniqueUsername(email);

            user = await User.create({
                name,
                email,
                username,
                // Random password keeps schema compatibility for OAuth accounts.
                password: `google-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`,
            });
        }

        return done(null, user);
    } catch (err) {
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user || null);
    } catch (error) {
        done(error, null);
    }
});