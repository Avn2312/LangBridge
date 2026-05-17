import User from "../../shared/models/User.js";

export async function getFriendIdsForUser(userId) {
  const user = await User.findById(userId).select("friends").lean();
  return (user?.friends || []).map((friendId) => friendId.toString());
}
