import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import resellerRoutes from "./routes/reseller.routes.js";

import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: ["http://localhost:3000", "https://deepcode-solutions.vercel.app"],
    credentials: true,
  }),
);
app.use(express.json());

app.use(morgan("dev"));

app.use("/api/reseller", resellerRoutes);


app.use(errorHandler);

export default app;
