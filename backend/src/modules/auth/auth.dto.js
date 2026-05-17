export const serializeAuthUser = (user) => ({
  id: user._id,
  email: user.email,
  fullName: user.fullName,
  profilePic: user.profilePic,
  nativeLanguage: user.nativeLanguage,
  learningLanguage: user.learningLanguage,
});

export const serializeAuthSuccess = ({ message, user }) => ({
  success: true,
  message,
  user: serializeAuthUser(user),
});

export const serializeCurrentUser = (user) => ({
  success: true,
  user,
});

export const serializeOnboardingResult = (user) => ({
  success: true,
  user,
});
