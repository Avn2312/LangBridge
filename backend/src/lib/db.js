import mongoose from "mongoose";
import { logger } from "./logger.js";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info("MongoDB connected", { host: conn.connection.host });
  } catch (error) {
    logger.error("Error connecting to MongoDB", error);
    process.exit(1); // 1 means exit process with failure
  }
};

export { connectDB };
