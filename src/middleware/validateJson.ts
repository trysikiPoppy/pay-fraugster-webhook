import { Request, Response, NextFunction } from "express";
import { PaymentWebhookPayload } from "../types/payment.types";
import { TransactionLogger } from "../utils/logger";

export const validatePayJson = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const payload = req.body as PaymentWebhookPayload;

    if (!payload || typeof payload !== "object") {
      TransactionLogger.logError(new Error("Invalid JSON payload"), {
        event: "json_validation_failed",
        reason: "not_object",
        ip: req.ip,
      });
      return res.status(400).json({
        error: "Invalid JSON payload",
      });
    }

    const requiredFields = ["id", "event", "data"];
    const missingFields = requiredFields.filter(
      (field) => !payload[field as keyof PaymentWebhookPayload]
    );

    if (missingFields.length > 0) {
      TransactionLogger.logError(new Error("Missing required fields"), {
        event: "json_validation_failed",
        reason: "missing_fields",
        missing_fields: missingFields,
        ip: req.ip,
      });
      return res.status(400).json({
        error: "Missing required fields",
        missing: missingFields,
      });
    }

    if (!payload.data || typeof payload.data !== "object") {
      TransactionLogger.logError(new Error("Invalid data field"), {
        event: "json_validation_failed",
        reason: "invalid_data",
        ip: req.ip,
      });
      return res.status(400).json({
        error: "Invalid data field",
      });
    }

    const dataRequiredFields = [
      "id",
      "amount",
      "currency",
      "status",
      "createdAt",
    ];
    const missingDataFields = dataRequiredFields.filter(
      (field) => !payload.data[field as keyof typeof payload.data]
    );

    if (missingDataFields.length > 0) {
      TransactionLogger.logError(new Error("Missing required data fields"), {
        event: "json_validation_failed",
        reason: "missing_data_fields",
        missing_data_fields: missingDataFields,
        ip: req.ip,
      });
      return res.status(400).json({
        error: "Missing required data fields",
        missing: missingDataFields,
      });
    }

    next();
  } catch (error) {
    TransactionLogger.logError(error as Error, {
      event: "json_validation_failed",
      ip: req.ip,
    });
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};
