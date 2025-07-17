import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { config } from "../config";
import { TransactionLogger } from "../utils/logger";

export const validateWebhook = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers.signature as string;
    const signatureInput = req.headers["signature-input"] as string;
    const digest = req.headers.digest as string;

    if (!signature || !signatureInput || !digest) {
      TransactionLogger.logError(new Error("Missing required headers"), {
        event: "webhook_validation_failed",
        headers: req.headers,
        ip: req.ip,
      });
      return res.status(401).json({
        error: "Missing required headers",
        required: ["signature", "signature-input", "digest"],
      });
    }

    const bodyString = JSON.stringify(req.body);
    const calculatedDigest = crypto
      .createHash("sha1")
      .update(bodyString)
      .digest("hex");

    if (digest !== calculatedDigest) {
      TransactionLogger.logError(new Error("Invalid digest"), {
        event: "webhook_validation_failed",
        expected_digest: calculatedDigest,
        received_digest: digest,
        ip: req.ip,
      });
      return res.status(401).json({
        error: "Invalid digest",
      });
    }

    const signatureParams = signatureInput.replace("fr1=", "");
    const signatureBase = `"digest": "${digest}"\n@signature-params: ${signatureParams}`;
    const expectedSignature = crypto
      .createHmac("sha256", config.payment.webhookSecret)
      .update(signatureBase)
      .digest("hex");

    const receivedSignature = signature.replace(/^fr1=:/, "").replace(/:$/, "");

    if (expectedSignature !== receivedSignature) {
      TransactionLogger.logError(new Error("Invalid signature"), {
        event: "webhook_validation_failed",
        expected_signature: expectedSignature,
        received_signature: receivedSignature,
        ip: req.ip,
      });
      return res.status(401).json({
        error: "Invalid signature",
      });
    }

    TransactionLogger.logSignatureValidation(true, req.body);
    next();
  } catch (error) {
    TransactionLogger.logError(error as Error, {
      event: "webhook_validation_failed",
      ip: req.ip,
    });
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};
