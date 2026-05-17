import User from "../../shared/models/User.js";

export function findUserByEmail(email) {
  return User.findOne({ email });
}

export function findUserByEmailWithPassword(email) {
  return User.findOne({ email }).select("+password");
}

export function findUserById(userId, projection) {
  const query = User.findById(userId);
  return projection ? query.select(projection) : query;
}

export function createLocalUser({ email, fullName, password, profilePic }) {
  return User.create({
    email,
    fullName,
    password,
    profilePic,
    provider: "local",
  });
}

export async function markUserVerified(userId) {
  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  user.verified = true;
  await user.save();
  return user;
}

export function updateOnboardingProfile({ userId, profile }) {
  return User.findByIdAndUpdate(
    userId,
    {
      ...profile,
      isOnboarded: true,
    },
    { new: true },
  ).select("-password");
}
