export const setAuthCookie = (res, token) => {
  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: process.env.JWT_COOKIE_SAMESITE || "lax",
    secure: process.env.NODE_ENV === "production",
    domain: process.env.JWT_COOKIE_DOMAIN || undefined,
  });
};

export const clearAuthCookie = (res) => {
  res.clearCookie("jwt", {
    sameSite: process.env.JWT_COOKIE_SAMESITE || "lax",
    secure: process.env.NODE_ENV === "production",
    domain: process.env.JWT_COOKIE_DOMAIN || undefined,
  });
};

