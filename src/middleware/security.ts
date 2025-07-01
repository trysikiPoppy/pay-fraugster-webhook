import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

export const corsOptions = cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:8080",
      "http://localhost:4000",
      "http://localhost:5000",
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn("CORS blocked request", {
        event: "cors_blocked",
        origin,
        timestamp: new Date().toISOString(),
      });
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["POST"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "digest",
    "signature",
    "signature-input",
  ],
  credentials: false,
});

export const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    error: "Too many webhook requests",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const userAgent = req.get("User-Agent") || "";
    return userAgent.includes("pay-republic") || userAgent.includes("webhook");
  },
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      event: "rate_limit_exceeded",
      ip: req.ip,
      user_agent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });

    res.status(429).json({
      error: "Too many webhook requests",
      retryAfter: "1 minute",
    });
  },
});

export const webhookSlowDown = slowDown({
  windowMs: 1 * 60 * 1000,
  delayAfter: 50,
  delayMs: () => 200,
  maxDelayMs: 2000,
  skip: (req) => {
    const userAgent = req.get("User-Agent") || "";
    return userAgent.includes("pay-republic") || userAgent.includes("webhook");
  },
});

export const requestSizeLimit = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const contentLength = parseInt(req.get("Content-Length") || "0");
  const maxSize = 1024 * 1024;

  if (contentLength > maxSize) {
    logger.warn("Request too large", {
      event: "request_too_large",
      content_length: contentLength,
      max_size: maxSize,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
    return res.status(413).json({
      error: "Request too large",
      max_size: "1MB",
    });
  }
  next();
};
