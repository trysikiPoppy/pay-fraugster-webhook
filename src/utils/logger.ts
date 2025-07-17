import winston from "winston";
import path from "path";

const logFormat = winston.format.printf(
  ({ level, message, timestamp, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
    }`;
  }
);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 20 * 1024 * 1024,
      maxFiles: 15,
    }),
  ],
});

const transactionLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: "logs/transactions.log",
      maxsize: 50 * 1024 * 1024,
      maxFiles: 30,
    }),
  ],
});

export { logger };

export class TransactionLogger {
  static logWebhookReceived(payload: any, headers: any, ip: string) {
    transactionLogger.info("Webhook received", {
      event: "webhook_received",
      payment_transaction_id: payload.data?.id,
      event_type: payload.event,
      amount: payload.data?.amount,
      currency: payload.data?.currency,
      headers: {
        signature: headers.signature,
        digest: headers.digest,
        "signature-input": headers["signature-input"],
      },
      ip: ip,
      timestamp: new Date().toISOString(),
    });
  }

  static logSignatureValidation(isValid: boolean, payload: any) {
    transactionLogger.info(
      `Signature validation: ${isValid ? "PASSED" : "FAILED"}`,
      {
        event: "signature_validation",
        payment_transaction_id: payload.data?.id,
        is_valid: isValid,
        timestamp: new Date().toISOString(),
      }
    );
  }

  static logFraudRequest(transactionData: any) {}

  static logFraudResponse(requestData: any, response: any) {
    const isApproved = response.fraud_approved === 1;
    const level = isApproved ? "info" : "warn";

    logger.log(
      level,
      `Fraud detection decision: ${this.getDecisionText(
        response.fraud_approved
      )}`,
      {
        event: "fraud_response",
        payment_trans_id: requestData.trans_id,
        fraud_trans_id: response.fraud_trans_id,
        decision: response.fraud_approved,
        decision_text: this.getDecisionText(response.fraud_approved),
        score: response.score,
        is_liable: response.is_liable,
        liability_reason: response.liability_reason,
        validation_ok: response.validation?.ok,
        validation_errors: response.validation?.errors,
        signals_count: response.evidence?.signals?.length || 0,
        signals: response.evidence?.signals,
        device_id: response.fraud_device_id,
        timestamp: new Date().toISOString(),
      }
    );
  }

  static logDataMapping(originalPayload: any, fraudData: any) {
    transactionLogger.info("Data mapping completed", {
      event: "data_mapping",
      payment_transaction_id: originalPayload.data?.id,
      fraud_transaction_id: fraudData.trans_id,
      amount: fraudData.trans_amt,
      currency: fraudData.trans_currency,
      customer_id: fraudData.cust_id,
      customer_name: `${fraudData.cust_first_name} ${fraudData.cust_last_name}`,
      payment_method: fraudData.pmt_method,
      country: fraudData.bill_ad_ctry,
      timestamp: new Date().toISOString(),
    });
  }

  static logValidationErrors(transactionId: string, errors: any[]) {
    transactionLogger.warn("Fraud detection validation errors", {
      event: "validation_errors",
      payment_transaction_id: transactionId,
      errors: errors,
      timestamp: new Date().toISOString(),
    });
  }

  static logError(error: Error, context: any) {
    transactionLogger.error("Processing error", {
      event: "processing_error",
      error: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
    });
  }

  static logAuthenticationError(error: any) {
    transactionLogger.error("Authentication error", {
      event: "auth_error",
      error: error.message,
      status: error.response?.status,
      timestamp: new Date().toISOString(),
    });
  }

  static logApiError(error: any, context: any) {
    transactionLogger.error("API error", {
      event: "api_error",
      error: error.message,
      status: error.response?.status,
      context: context,
      timestamp: new Date().toISOString(),
    });
  }

  static logPaymentAuth(token: string) {
    transactionLogger.info("Payment service authentication successful", {
      event: "payment_auth",
      token_length: token.length,
      timestamp: new Date().toISOString(),
    });
  }

  static logPaymentOAuthError(error: any) {
    transactionLogger.error("Payment service OAuth error", {
      event: "payment_oauth_error",
      error: error.message,
      status: error.response?.status,
      timestamp: new Date().toISOString(),
    });
  }

  static logPaymentApiError(error: any, context: any) {
    transactionLogger.error("Payment service API error", {
      event: "payment_api_error",
      error: error.message,
      status: error.response?.status,
      context: context,
      timestamp: new Date().toISOString(),
    });
  }

  private static getDecisionText(decision: number): string {
    switch (decision) {
      case 0:
        return "DECLINED";
      case 1:
        return "APPROVED";
      case 2:
        return "REVIEW";
      case 3:
        return "CHALLENGE";
      default:
        return "UNKNOWN";
    }
  }
}
