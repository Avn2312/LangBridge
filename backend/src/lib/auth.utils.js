import jwt from "jsonwebtoken";

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

/**
 * Set JWT token as an httpOnly cookie on the response
 * @param {object} res - Express response object
 * @param {string} token - JWT token string
 * 
 * WHY httpOnly?
 *   - The cookie CANNOT be accessed by JavaScript (document.cookie won't show it)
 *   - This prevents XSS attacks from stealing the token
 *   - The browser automatically sends it with every request (we don't manage it manually)
 * 
 * WHY sameSite: "lax"?
 *   - "strict" blocks the cookie on OAuth redirects (Google → our callback → cookie not sent!)
 *   - "none" allows any site to send the cookie (dangerous, needs HTTPS)
 *   - "lax" is the sweet spot: blocks cross-site POST but allows top-level navigation (OAuth redirects ✅)
 * 
 * INTERVIEW: "What's the difference between sameSite strict, lax, and none?"
 *   → strict: cookie only sent for same-site requests (breaks OAuth)
 *   → lax: cookie sent for same-site + top-level navigations (perfect for OAuth)
 *   → none: cookie sent everywhere (requires Secure flag + HTTPS)
 */
const setAuthCookie = (res, token) => {
    res.cookie("jwt", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in milliseconds
        httpOnly: true,                     // JS can't access this cookie (XSS protection)
        sameSite: "lax",                    // allows OAuth redirects, blocks CSRF
        secure: process.env.NODE_ENV === "production", // HTTPS only in production
    });
};

/**
 * Clear the auth cookie (used for logout)
 */
const clearAuthCookie = (res) => {
    res.clearCookie("jwt");
};

export { generateToken, generateVerificationToken, setAuthCookie, clearAuthCookie };