import jwt from "jsonwebtoken";

const parseCookieHeader = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((acc, pair) => {
    const [key, ...val] = pair.trim().split("=");
    if (key) acc[key.trim()] = decodeURIComponent(val.join("=").trim());
    return acc;
  }, {});

export const authenticateSocket = (socket, next) => {
  try {
    const cookies = parseCookieHeader(socket.handshake.headers.cookie);
    const token = cookies.jwt;

    if (!token) {
      return next(new Error("Authentication error: No token provided."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid or expired token."));
  }
};
