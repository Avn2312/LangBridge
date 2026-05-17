import jwt from "jsonwebtoken";
export { clearAuthCookie, setAuthCookie } from "./auth.cookies.js";

/**
 * Generate a JWT token for a user
 * @param {string} userId - MongoDB user ID
 * @returns {string} JWT token
 * 
 * INTERVIEW: "Why JWT and not session-only auth?"
 * → JWT is stateless — the server doesn't need to look up a session store
 *   on every request. The token itself contains the userId (payload).
 *   This makes it perfect for horizontal scaling: any server instance
 *   can verify the token without talking to Redis/DB.
 */
const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },               // payload — data stored inside the token
        process.env.JWT_SECRET_KEY, // secret — only our server knows this
        { expiresIn: "7d" }        // expiry — token becomes invalid after 7 days
    );
};

/**
 * Generate a short-lived JWT specifically for email verification.
 * SEPARATE from the session token intentionally:
 *   - Short expiry (24h) vs session token (7d)
 *   - Contains a 'purpose' claim — verified in the controller so a
 *     session token can NEVER be used as a verification token and vice-versa.
 * @param {string} userId - MongoDB user ID
 * @returns {string} verification JWT
 */
const generateVerificationToken = (userId) => {
    return jwt.sign(
        { id: userId, purpose: "email-verification" }, // 'purpose' claim is the security guard
        process.env.JWT_SECRET_KEY,
        { expiresIn: "24h" }  // short-lived — user has 24h to click the link
    );
};

export { generateToken, generateVerificationToken };
