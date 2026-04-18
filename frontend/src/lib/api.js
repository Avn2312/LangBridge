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

export const resendVerificationEmail = async () => {
  const response = await axiosInstance.post("/auth/resend-verification");
  return response.data;
};

export async function getUserFriends() {
  const response = await axiosInstance.get("/users/friends");
  return response.data;
}

export async function getRecommendedUsers() {
  const response = await axiosInstance.get("/users");
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
  return response.data;
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

export async function getStreamToken() {
  const response = await axiosInstance.get("/chat/token");
  return response.data;
}

// Backward-compatible aliases used across page components.
export const sendFriendRequest = sendFollowRequest;
export const getOutgoingFriendReqs = getSentFriendReqs;
export const getFriendRequests = getReceivedFriendReqs;
