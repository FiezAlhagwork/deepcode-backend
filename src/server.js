import app from "./app.js";
import { env } from "./config/env.js";

if (process.env.NODE_ENV !== "production") {
  app.listen(env.port, () => {
    console.log(`🚀 Server running on port ${env.port} (${env.nodeEnv})`);
  });
}

export default app; // ← Vercel بيحتاج هاد