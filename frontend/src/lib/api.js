import { axiosInstance } from "./axios.js";

export const signup = async (signupData) => {
  const response = await axiosInstance.post("/auth/signup", signupData);
  return response.data;
};

export const login = async (loginData) => {
  const response = await axiosInstance.post("/auth/login", loginData);
  return response.data;
};

export const logout = async () => {
  const response = await axiosInstance.post("/auth/logout");
  return response.data;
};

export const getAuthUser = async () => {
  try {
    const res = await axiosInstance.get("/auth/me");
    return res.data;
  } catch (error) {
    if (error?.response?.status === 401) {
      return null;
    }
    console.log("Error in getAuthUser: ", error);
    return null;
  }
};

export const completeOnboarding = async (userData) => {
  const response = await axiosInstance.post("/auth/onboarding", userData);
  return response.data;
};

export const uploadProfilePhoto = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axiosInstance.post("/auth/onboarding/photo", formData);
  return response.data.photo;
};

export const updateMyProfile = async (profileData) => {
  const response = await axiosInstance.patch("/users/me", profileData);
  return response.data;
};

export const resendVerificationEmail = async () => {
  const response = await axiosInstance.post("/auth/resend-verification");
  return response.data;
};

// ── Users ──────────────────────────────────────────────────────────────────────
export async function getUserFriends() {
  const response = await axiosInstance.get("/users/friends");
  return response.data.friends || response.data;
}

export async function getRecommendedUsers(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  const response = await axiosInstance.get(
    queryString ? `/users?${queryString}` : "/users",
  );
  return response.data.users || response.data;
}

export async function getUserById(userId) {
  const response = await axiosInstance.get(`/users/${userId}`);
  return response.data;
}

export async function sendFollowRequest(userId) {
  const response = await axiosInstance.post(`/users/follow/${userId}`);
  return response.data;
}

export async function unfollowUser(userId) {
  const response = await axiosInstance.delete(`/users/unfollow/${userId}`);
  return response.data;
}

export async function getSentFriendReqs() {
  const response = await axiosInstance.get("/users/sent/requests");
  return response.data.requests || response.data;
}

export async function getReceivedFriendReqs() {
  const response = await axiosInstance.get("/users/received/requests");
  return response.data;
}

export async function acceptFriendRequest(requestId) {
  const response = await axiosInstance.patch(
    `/users/follow/accept/${requestId}`,
  );
  return response.data;
}

export async function rejectFriendRequest(requestId) {
  const response = await axiosInstance.patch(
    `/users/follow/reject/${requestId}`,
  );
  return response.data;
}

export async function blockUser(userId) {
  const response = await axiosInstance.post(`/users/block/${userId}`);
  return response.data;
}

export async function unblockUser(userId) {
  const response = await axiosInstance.delete(`/users/block/${userId}`);
  return response.data;
}

export async function reportUser(userId, reason = "") {
  const response = await axiosInstance.post(`/users/report/${userId}`, {
    reason,
  });
  return response.data;
}

// ── Learning Assist ───────────────────────────────────────────────────────────
export async function correctMessageDraft({
  text,
  tone = "friendly",
  partnerId,
  messageId,
}) {
  const response = await axiosInstance.post("/learning/correct", {
    text,
    tone,
    partnerId,
    messageId,
  });
  return response.data;
}

export async function createPartnerCorrection({
  messageId,
  correctedText,
  note,
}) {
  const response = await axiosInstance.post("/learning/partner-corrections", {
    messageId,
    correctedText,
    note,
  });
  return response.data;
}

export async function getPartnerCorrections(partnerId) {
  const response = await axiosInstance.get(
    `/learning/partner-corrections?partnerId=${partnerId}`,
  );
  return response.data;
}

export async function translateMessage({
  text,
  messageId,
  partnerId,
  targetLanguage,
}) {
  const response = await axiosInstance.post("/learning/translate", {
    text,
    messageId,
    partnerId,
    targetLanguage,
  });
  return response.data;
}

export async function savePhrase({ phrase, messageId, partnerId, language }) {
  const response = await axiosInstance.post("/learning/phrases", {
    phrase,
    messageId,
    partnerId,
    language,
  });
  return response.data;
}

export async function getLearningDashboard(options = {}) {
  const params = new URLSearchParams();

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  const response = await axiosInstance.get(
    queryString ? `/learning/dashboard?${queryString}` : "/learning/dashboard",
  );
  return response.data;
}

// ── Moderation ────────────────────────────────────────────────────────────────
export async function getModerationReports(status = "open") {
  const response = await axiosInstance.get(`/moderation/reports?status=${status}`);
  return response.data;
}

export async function updateModerationReport(reportId, payload) {
  const response = await axiosInstance.patch(
    `/moderation/reports/${reportId}`,
    payload,
  );
  return response.data;
}

// ── Messages ───────────────────────────────────────────────────────────────────
/**
 * GET /api/messages/:userId — paginated history between me and userId
 * Returns { success, messages, page, limit }
 */
export async function getMessages(userId, page = 1, limit = 50) {
  const response = await axiosInstance.get(
    `/messages/${userId}?page=${page}&limit=${limit}`,
  );
  return response.data;
}

/**
 * GET /api/messages/conversations — all conversation threads with unread counts
 * Returns { success, conversations }
 */
export async function getConversations() {
  const response = await axiosInstance.get("/messages/conversations");
  return response.data;
}

export async function uploadMessageAttachment(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axiosInstance.post("/messages/attachments", formData);
  return response.data.attachment;
}

// ── Backward-compatible aliases used across page components ───────────────────
export const sendFriendRequest = sendFollowRequest;
export const getOutgoingFriendReqs = getSentFriendReqs;
export const getFriendRequests = getReceivedFriendReqs;
