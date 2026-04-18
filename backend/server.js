import "dotenv/config";
import app from "./src/app.js";

// Import database connection
import { connectDB } from "./src/lib/db.js";

const PORT = process.env.PORT || 3000;

// ──── START SERVER ────
const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`🚀 Server is running on port ${PORT}`);
    });
};

startServer().catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
});
