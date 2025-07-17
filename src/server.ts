import express from "express";
import fs from "fs";
import { config } from "./config";
import { logger } from "./utils/logger";
import { WebhookController } from "./controllers/webhook.controller";
import { securityHeaders } from "./middleware/security";
import { validateWebhook } from "./middleware/validateWebhook";
import { validatePayJson } from "./middleware/validateJson";
import { globalErrorHandler, notFoundHandler } from "./middleware/errorHandler";

const app = express();

app.set("trust proxy", 1);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const webhookController = new WebhookController();

const requiredEnvVars = [
  "PAYMENT_WEBHOOK_SECRET",
  "PAYMENT_CLIENT_ID",
  "PAYMENT_CLIENT_SECRET",
  "FRAUD_USERNAME",
  "FRAUD_PASSWORD",
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

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

app.post(
  "/webhook",
  validatePayJson,
  validateWebhook,
  webhookController.processWebhook.bind(webhookController)
);

app.use(notFoundHandler);
app.use(globalErrorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Payment-Fraud webhook server started`, {
    event: "server_start",
    port: config.port,
    environment: process.env.NODE_ENV,
    fraud_api_url: config.fraud.apiUrl,
    payment_api_url: config.payment.apiUrl,
    webhook_secret_configured: !!config.payment.webhookSecret,
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
