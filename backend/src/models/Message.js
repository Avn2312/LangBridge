import mongoose from "mongoose";

// ─── Message Schema ────────────────────────────────────────────────────────────
// Design: Each document = one message between two users.
// WHY no separate Conversation model?
//   For a 1-on-1 chat app, we can derive "conversations" on the fly
//   by querying messages where sender/receiver matches and grouping.
//   Adding a Conversation model adds write overhead (two writes per message)
//   with little benefit at this scale.
// INTERVIEW: "How would you scale this to group chats?"
//   → Add a Conversation model with a participants[] array,
//     change sender/receiver to conversationId + sender.
const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // The user who sent the message
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // The user who receives the message
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    read: {
      type: Boolean,
      default: false,
      // WHY track read status?
      //   Lets us show unread counts + "seen" indicators (like WhatsApp blue ticks)
    },
  },
  {
    timestamps: true,
    // createdAt = when message was sent
    // updatedAt = when read status last changed
  }
);

// ─── Compound Index ────────────────────────────────────────────────────────────
// WHY? The most common query is: "get all messages between User A and User B".
// Without this index, MongoDB does a full collection scan.
// With this index, it finds the matching documents instantly.
// INTERVIEW: "What indexes do you use and why?"
//   → "Compound index on [sender, receiver] because 99% of queries filter on both."
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ createdAt: -1 }); // for sorting newest-first

const Message = mongoose.model("Message", messageSchema);

export default Message;
