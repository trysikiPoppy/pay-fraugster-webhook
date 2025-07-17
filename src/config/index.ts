import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",
  payment: {
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || "",
    apiUrl: process.env.PAYMENT_API_URL || "http://localhost:8080",
    clientId: process.env.PAYMENT_CLIENT_ID || "",
    clientSecret: process.env.PAYMENT_CLIENT_SECRET || "",
  },
  fraud: {
    apiUrl: process.env.FRAUD_API_URL || "https://api.fraud-detection.com",
    username: process.env.FRAUD_USERNAME || "",
    password: process.env.FRAUD_PASSWORD || "",
  },
};
