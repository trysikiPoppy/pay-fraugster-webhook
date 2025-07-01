import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import crypto from "crypto";
import { TransactionLogger, logger } from "../utils/logger";

export const validateWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const digest = req.headers["digest"] as string;
  const signatureInput = req.headers["signature-input"] as string;
  const signature = req.headers["signature"] as string;
  const webhookSecret = config.payRepublic.webhookSecret;

  if (!digest || !signatureInput || !signature) {
    const missingHeaders = {
      digest: !!digest,
      signatureInput: !!signatureInput,
      signature: !!signature,
    };

    logger.warn("Missing required signature headers", {
      event: "webhook_validation_failed",
      reason: "missing_headers",
      missing_headers: missingHeaders,
      ip: req.ip,
    });

    return res.status(401).json({ error: "Missing signature headers" });
  }

  if (!webhookSecret) {
    logger.error("Webhook secret not configured", {
      event: "webhook_validation_error",
      reason: "missing_secret",
    });
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  try {
    const body = JSON.stringify(req.body);

    const calculatedDigest = crypto
      .createHash("sha1")
      .update(body)
      .digest("hex");

    if (digest !== calculatedDigest) {
      logger.warn("Digest mismatch", {
        event: "webhook_validation_failed",
        reason: "digest_mismatch",
        received_digest: digest,
        calculated_digest: calculatedDigest,
        ip: req.ip,
      });
      return res.status(401).json({ error: "Invalid digest" });
    }

    const signatureParams = signatureInput.replace("fr1=", "");
    const signatureBase = `"digest": "${digest}"\n@signature-params: ${signatureParams}`;
    const calculatedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signatureBase)
      .digest("hex");

    const expectedSignature = signature.replace(/^fr1=:|:$/g, "");

    const validationDetails = {
      receivedDigest: digest,
      calculatedDigest,
      expectedSignature,
      calculatedSignature,
      match: expectedSignature === calculatedSignature,
    };

    TransactionLogger.logSignatureValidation(
      validationDetails.match,
      validationDetails
    );

    if (expectedSignature !== calculatedSignature) {
      logger.warn("Webhook signature validation failed", {
        event: "webhook_validation_failed",
        reason: "invalid_signature",
        ip: req.ip,
        validation_details: validationDetails,
      });
      return res.status(401).json({ error: "Invalid signature" });
    }

    next();
  } catch (error) {
    TransactionLogger.logError(error as Error, {
      event: "webhook_validation_error",
      ip: req.ip,
      headers: req.headers,
    });
    return res.status(500).json({ error: "Validation error" });
  }
};
