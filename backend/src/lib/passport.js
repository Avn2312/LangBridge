import passport from "passport";
import { Strategy as GoogleStrategy }  from "passport-google-oauth20";
import User from "../models/User.js";

const googleCallbackUrl =
    process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/google/callback";

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: googleCallbackUrl,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Step 1: Check if user already has a Google account linked
                let user = await User.findOne({ googleId: profile.id });

                // Step 2: Account linking — if no googleId match, try email match
                // WHY: User might have signed up with email/password first,
                //       then later tries "Sign in with Google" with the same email.
                //       We should LINK accounts, not create a duplicate.
                if (!user) {
                    user = await User.findOne({
                        // ↑ FIXED: was "findONe" (typo — would crash with "User.findONe is not a function")
                        email: profile.emails[0].value,
                    });
                }

                if (!user) {
                    // Step 3: Brand new user — create account
                    // Generate a random avatar (same logic as email signup)
                    const idx = Math.floor(Math.random() * 100) + 1;
                    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

                    user = await User.create({
                        googleId: profile.id,
                        fullName: profile.displayName,
                        // ↑ FIXED: was "name" but our User model uses "fullName"
                        email: profile.emails[0].value,
                        profilePic: profile.photos?.[0]?.value || randomAvatar,
                        provider: "google",
                        // NOTE: No password field — our updated User model makes password optional for OAuth users
                    });
                } else {
                    // Step 4: Existing user — link Google account if not already linked
                    if (!user.googleId) {
                        user.googleId = profile.id;
                        user.provider = user.provider || "google";
                        // Also update profile pic from Google if they don't have one
                        if (!user.profilePic && profile.photos?.[0]?.value) {
                            user.profilePic = profile.photos[0].value;
                        }
                        await user.save();
                    }
                }
                return done(null, user);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

// Session serialization — stores just the user ID in the session
// WHY: We don't want to store the entire user object in the session cookie (too big)
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Session deserialization — retrieves full user from DB using the stored ID
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

export default passport;