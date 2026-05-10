import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Message from "../src/models/Message.js";
import { logger } from "../src/lib/logger.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/langbridge";
const DEMO_PASSWORD = "DemoPass123!";

const demoUsers = [
  {
    fullName: "Aarav Mehta",
    email: "aarav.demo@langbridge.dev",
    nativeLanguage: "Hindi",
    learningLanguage: "English",
    location: "New Delhi, India",
    bio: "Product designer practicing confident English conversation.",
    profilePic: "https://i.pravatar.cc/160?img=12",
  },
  {
    fullName: "Maya Thompson",
    email: "maya.demo@langbridge.dev",
    nativeLanguage: "English",
    learningLanguage: "Hindi",
    location: "Austin, United States",
    bio: "Beginner Hindi learner who likes travel, music, and everyday phrases.",
    profilePic: "https://i.pravatar.cc/160?img=32",
  },
  {
    fullName: "Sofia Alvarez",
    email: "sofia.demo@langbridge.dev",
    nativeLanguage: "Spanish",
    learningLanguage: "English",
    location: "Madrid, Spain",
    bio: "Looking for relaxed English speaking practice after work.",
    profilePic: "https://i.pravatar.cc/160?img=47",
  },
  {
    fullName: "Kenji Sato",
    email: "kenji.demo@langbridge.dev",
    nativeLanguage: "Japanese",
    learningLanguage: "English",
    location: "Tokyo, Japan",
    bio: "Software engineer practicing interview and small-talk English.",
    profilePic: "https://i.pravatar.cc/160?img=59",
  },
];

const upsertUser = async (entry) => {
  const user = await User.findOne({ email: entry.email });

  if (user) {
    Object.assign(user, {
      ...entry,
      password: DEMO_PASSWORD,
      verified: true,
      isOnboarded: true,
      provider: "local",
    });
    await user.save();
    return user;
  }

  return User.create({
    ...entry,
    password: DEMO_PASSWORD,
    verified: true,
    isOnboarded: true,
    provider: "local",
  });
};

const createMessageIfMissing = async ({ sender, receiver, text, createdAt }) => {
  const existing = await Message.findOne({
    sender: sender._id,
    receiver: receiver._id,
    text,
  });

  if (existing) {
    return existing;
  }

  return Message.create({
    sender: sender._id,
    receiver: receiver._id,
    text,
    read: true,
    readAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  });
};

const seed = async () => {
  await mongoose.connect(MONGO_URI);

  const users = await Promise.all(demoUsers.map(upsertUser));
  const [aarav, maya, sofia, kenji] = users;

  aarav.friends = [maya._id, sofia._id];
  maya.friends = [aarav._id, kenji._id];
  sofia.friends = [aarav._id];
  kenji.friends = [maya._id];

  await Promise.all(users.map((user) => user.save()));

  const now = Date.now();
  await Promise.all([
    createMessageIfMissing({
      sender: maya,
      receiver: aarav,
      text: "Namaste! Can we practice ordering coffee in Hindi today?",
      createdAt: new Date(now - 1000 * 60 * 45),
    }),
    createMessageIfMissing({
      sender: aarav,
      receiver: maya,
      text: "Absolutely. Try: mujhe ek coffee chahiye.",
      createdAt: new Date(now - 1000 * 60 * 43),
    }),
    createMessageIfMissing({
      sender: sofia,
      receiver: aarav,
      text: "Could you correct this sentence: I am agree with you?",
      createdAt: new Date(now - 1000 * 60 * 30),
    }),
    createMessageIfMissing({
      sender: aarav,
      receiver: sofia,
      text: "Say: I agree with you. No 'am' needed there.",
      createdAt: new Date(now - 1000 * 60 * 28),
    }),
    createMessageIfMissing({
      sender: kenji,
      receiver: maya,
      text: "I want to practice explaining my project in English.",
      createdAt: new Date(now - 1000 * 60 * 20),
    }),
  ]);

  logger.info("Seeded demo data", {
    users: users.map((user) => user.email),
    password: DEMO_PASSWORD,
  });
};

seed()
  .catch((error) => {
    logger.error("Demo seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
