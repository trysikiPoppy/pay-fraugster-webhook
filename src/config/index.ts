import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000"),
  nodeEnv: process.env.NODE_ENV || "development",
  payRepublic: {
    webhookSecret: process.env.PAY_WEBHOOK_SECRET || "",
    apiUrl: process.env.PAY_API_URL || "http://localhost:8080",
    clientId: process.env.PAY_CLIENT_ID || "",
    clientSecret: process.env.PAY_CLIENT_SECRET || "",
  },
  fraugster: {
    apiUrl: process.env.FRAUGSTER_API_URL || "https://api.fraugsterapi.com",
    username: process.env.FRAUGSTER_USERNAME || "",
    password: process.env.FRAUGSTER_PASSWORD || "",
  },
};
