import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import resellerRoutes from "./routes/reseller.routes.js";
// fiez alhag 
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(helmet());
console.log("fiez alhag ");

app.use(
  cors({
    origin: ["https://deepcodesolution.com", "https://www.deepcodesolution.com"],
    credentials: true,
  }),
);

app.use(express.json());

app.use(morgan("dev"));

app.use("/api/reseller", resellerRoutes);


app.use(errorHandler);

export default app;
