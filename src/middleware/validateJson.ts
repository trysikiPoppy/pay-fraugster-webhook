import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export interface PayWebhookStructure {
  id: string;
  event: string;
  data: any;
  previousValues?: any;
  createdAt: number;
}

export const validatePayJson = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body as PayWebhookStructure;

    const missingFields: string[] = [];

    if (!payload.id) missingFields.push("id");
    if (!payload.event) missingFields.push("event");
    if (!payload.data) missingFields.push("data");
    if (typeof payload.createdAt !== "number") missingFields.push("createdAt");

    if (missingFields.length > 0) {
      logger.warn("Invalid Pay webhook structure", {
        event: "json_validation_failed",
        missing_fields: missingFields,
        received_payload: payload,
        ip: req.ip,
      });

      return res.status(400).json({
        error: "Invalid webhook structure",
        missing_fields: missingFields,
      });
    }

    if (!payload.data.id) {
      logger.warn("Missing transaction ID in webhook data", {
        event: "json_validation_warning",
        payload: payload,
        ip: req.ip,
      });

      return res.status(400).json({
        error: "Missing transaction ID in data",
      });
    }

    logger.info("Pay webhook JSON structure validated", {
      event: "json_validation_success",
      webhook_id: payload.id,
      event_type: payload.event,
      transaction_id: payload.data.id,
    });

    next();
  } catch (error) {
    logger.error("JSON validation error", {
      event: "json_validation_error",
      error: (error as Error).message,
      body: req.body,
      ip: req.ip,
    });

    return res.status(400).json({
      error: "Invalid JSON format",
    });
  }
};
