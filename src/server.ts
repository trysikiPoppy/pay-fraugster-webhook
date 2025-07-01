import express from "express";
import { config } from "./config";
import { validateWebhook } from "./middleware/validateWebhook";
import { validatePayJson } from "./middleware/validateJson";
import {
  securityHeaders,
  corsOptions,
  webhookRateLimit,
  webhookSlowDown,
  requestSizeLimit,
} from "./middleware/security";
import {
  globalErrorHandler,
  notFoundHandler,
  asyncErrorCatcher,
} from "./middleware/errorHandler";
import { WebhookController } from "./controllers/webhook.controller";
import { logger } from "./utils/logger";
import fs from "fs";

const app = express();
app.set("trust proxy", 1);
const webhookController = new WebhookController();

const requiredEnvVars = [
  "PAY_WEBHOOK_SECRET",
  "PAY_CLIENT_ID",
  "PAY_CLIENT_SECRET",
  "FRAUGSTER_USERNAME",
  "FRAUGSTER_PASSWORD",
];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
  logger.error("Missing required environment variables", {
    event: "startup_error",
    missing_variables: missingVars,
  });
  process.exit(1);
}

if (!fs.existsSync("logs")) {
  fs.mkdirSync("logs", { recursive: true });
}

app.use(securityHeaders);
app.use(corsOptions);
app.use("/webhook", webhookRateLimit);
app.use("/webhook", webhookSlowDown);
app.use(requestSizeLimit);
app.use(express.json({ limit: "1mb" }));

app.post(
  "/webhook",
  validatePayJson,
  validateWebhook,
  asyncErrorCatcher(webhookController.handleWebhook)
);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Pay-Fraugster webhook server started`, {
    event: "server_start",
    port: config.port,
    environment: process.env.NODE_ENV,
    fraugster_api_url: config.fraugster.apiUrl,
    pay_api_url: config.payRepublic.apiUrl,
    webhook_secret_configured: !!config.payRepublic.webhookSecret,
  });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});
