import mongoose from "mongoose";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";

const startServer = async () => {
  await connectDB();

  const server = app.listen(env.port, () => {
    console.log(`🚀 Server running on port ${env.port} (${env.nodeEnv})`);
  });

  // Graceful shutdown: stop accepting new connections, let in-flight requests
  // finish, then close the DB connection — so a deploy/restart never cuts a
  // request (e.g. a Cloudinary upload) off halfway.
  const shutdown = (signal) => {
    console.log(`${signal} received — shutting down.`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    // Force-exit if something keeps a connection open too long.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

startServer();

export default app;
