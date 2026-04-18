import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            // CHANGED: removed "required: true"
            // WHY: OAuth users (Google login) don't have a password.
            //      If we keep required:true, User.create() for Google users crashes.
            // INTERVIEW: "How do you handle multi-provider auth in your schema?"
            //   → "Password is only required for local auth. OAuth users skip it."
            minlength: 8,
        },
        verified: {
            type: Boolean,
            default: false,
        },
        bio: {
            type: String,
            default: "",
        },
        profilePic: {
            type: String,
            default: "",
        },
        nativeLanguage: {
            type: String,
            default: "",
        },
        learningLanguage: {
            type: String,
            default: "",
        },
        location: {
            type: String,
            default: "",
        },
        isOnboarded: {
            type: Boolean,
            default: false,
        },
        friends: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        // ──── NEW FIELDS FOR OAUTH ────
        googleId: {
            type: String,
            default: null,
            // WHY: Links the MongoDB user to their Google account.
            // When user clicks "Sign in with Google", Passport receives a profile.id
            // from Google. We store it here so next time they login, we can find them
            // with: User.findOne({ googleId: profile.id })
        },
        provider: {
            type: String,
            enum: ["local", "google"],
            default: "local",
            // WHY: Tells us HOW the user originally signed up.
            // "local" = email + password
            // "google" = Google OAuth
            // INTERVIEW: Useful for knowing if "forgot password" makes sense
            //   (Google users don't have a password to reset!)
        },
    },
    {
        timestamps: true,
        // timestamps:true automatically adds createdAt and updatedAt fields
    }
);

// Pre Hook — hash password before saving to database
// WHY: We NEVER store plain text passwords. bcrypt adds a random salt + hashes.
// INTERVIEW: "If your database leaks, are passwords exposed?"
//   → "No, they're bcrypt-hashed with per-user salts. Even with the hash,
//      the original password can't be reversed."
userSchema.pre("save", async function (next) {
    // Only hash if password exists AND has been modified
    // (OAuth users have no password, so this check prevents crashes)
    if (!this.password || !this.isModified("password")) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare entered password with stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
    // If user signed up via Google and has no password, always return false
    if (!this.password) return false;

    const isPasswordCorrect = await bcrypt.compare(enteredPassword, this.password);
    return isPasswordCorrect;
};

const User = mongoose.model("User", userSchema);

export default User;