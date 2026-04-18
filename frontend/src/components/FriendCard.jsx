import { Link } from "react-router";
import { LANGUAGE_TO_FLAG } from "../constants";
import { motion } from "framer-motion";
import useAuthUser from "../hooks/useAuthUser.js";

const FriendCard = ({ friend }) => {
  const { authUser } = useAuthUser();
  const isVerified = Boolean(authUser?.verified);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 250 }}
      className="card bg-base-200 border border-base-300 hover:border-primary hover:shadow-lg transition-all duration-300"
    >
      <div className="card-body p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="avatar size-12 ring ring-base-300 ring-offset-1">
            <img src={friend.profilePic} alt={friend.fullName} />
          </div>
          <h3 className="font-semibold truncate">{friend.fullName}</h3>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="badge badge-secondary text-xs">
            {getLanguageFlag(friend.nativeLanguage)}
            Native: {friend.nativeLanguage}
          </span>
          <span className="badge badge-outline text-xs">
            {getLanguageFlag(friend.learningLanguage)}
            Learning: {friend.learningLanguage}
          </span>
        </div>

        {isVerified ? (
          <Link to={`/chat/${friend._id}`} className="btn btn-outline w-full">
            Message
          </Link>
        ) : (
          <button
            type="button"
            className="btn btn-disabled w-full"
            title="Verify email to start chat"
          >
            Verify Email Required
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default FriendCard;

export function getLanguageFlag(language) {
  if (!language) return null;
  const langLower = language.toLowerCase();
  const countryCode = LANGUAGE_TO_FLAG[langLower];
  if (countryCode) {
    return (
      <img
        src={`https://flagcdn.com/24x18/${countryCode}.png`}
        alt={`${langLower} flag`}
        className="h-3 mr-1 inline-block"
      />
    );
  }
  return null;
}
