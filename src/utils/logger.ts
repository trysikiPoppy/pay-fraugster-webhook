import winston from "winston";
import path from "path";

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      logMessage += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return logMessage;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transports: [
    new winston.transports.Console({
      format: logFormat,
    }),
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error",
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
    new winston.transports.File({
      filename: path.join("logs", "transactions.log"),
      level: "info",
      format: jsonFormat,
      maxsize: 50 * 1024 * 1024,
      maxFiles: 30,
    }),
    new winston.transports.File({
      filename: path.join("logs", "combined.log"),
      format: jsonFormat,
      maxsize: 20 * 1024 * 1024,
      maxFiles: 15,
    }),
  ],
});

export class TransactionLogger {
  static logWebhookReceived(payload: any, headers: any) {
    logger.info("Webhook received from Pay Republic", {
      event: "webhook_received",
      pay_transaction_id: payload.data?.id,
      event_type: payload.event,
      amount: payload.data?.amount,
      currency: payload.data?.currency,
      status: payload.data?.status,
      timestamp: new Date().toISOString(),
      headers: {
        digest_present: !!headers.digest,
        signature_present: !!headers.signature,
        signature_input_present: !!headers["signature-input"],
      },
      full_payload: payload,
    });
  }

  static logSignatureValidation(isValid: boolean, details: any) {
    const level = isValid ? "info" : "warn";
    logger.log(
      level,
      `Webhook signature validation: ${isValid ? "SUCCESS" : "FAILED"}`,
      {
        event: "signature_validation",
        valid: isValid,
        validation_details: details,
        timestamp: new Date().toISOString(),
      }
    );
  }

  static logDataMapping(payData: any, fraugsterData: any) {
    // заглушки для логирования данных
  }

  static logFraugsterRequest(transactionData: any) {
    // заглушки для логирования запроса в fraugster
  }

  static logFraugsterResponse(requestData: any, response: any) {
    const isApproved = response.fraugster_approved === 1;
    const level = isApproved ? "info" : "warn";

    logger.log(
      level,
      `Fraugster decision: ${this.getDecisionText(
        response.fraugster_approved
      )}`,
      {
        event: "fraugster_response",
        pay_trans_id: requestData.trans_id,
        frg_trans_id: response.frg_trans_id,
        decision: response.fraugster_approved,
        decision_text: this.getDecisionText(response.fraugster_approved),
        score: response.score,
        is_liable: response.is_liable,
        liability_reason: response.liability_reason,
        validation_ok: response.validation?.ok,
        validation_errors: response.validation?.errors,
        signals_count: response.evidence?.signals?.length || 0,
        signals: response.evidence?.signals,
        device_id: response.frg_device_id,
        timestamp: new Date().toISOString(),
      }
    );
  }

  static logValidationErrors(transactionId: string, validationErrors: any[]) {
    logger.error("Fraugster data validation errors", {
      event: "validation_errors",
      trans_id: transactionId,
      error_count: validationErrors.length,
      errors: validationErrors.map((err) => ({
        field: err.datapoint,
        message: err.msg,
      })),
      timestamp: new Date().toISOString(),
    });
  }

  static logError(error: Error, context: any = {}) {
    logger.error("Transaction processing error", {
      event: "processing_error",
      error_message: error.message,
      error_stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  static logAuthenticationError(error: any) {
    logger.error("Fraugster authentication failed", {
      event: "auth_error",
      error_message: error.message,
      status: error.response?.status,
      response_data: error.response?.data,
      timestamp: new Date().toISOString(),
    });
  }

  static logApiError(error: any, requestData: any) {
    logger.error("Fraugster API error", {
      event: "api_error",
      trans_id: requestData?.trans_id,
      error_message: error.message,
      status: error.response?.status,
      response_data: error.response?.data,
      request_data: requestData,
      timestamp: new Date().toISOString(),
    });
  }

  static logTransactionStats(stats: {
    total: number;
    approved: number;
    declined: number;
    manual_review: number;
    errors: number;
  }) {
    logger.info("Transaction processing statistics", {
      event: "transaction_stats",
      ...stats,
      approval_rate: ((stats.approved / stats.total) * 100).toFixed(2) + "%",
      decline_rate: ((stats.declined / stats.total) * 100).toFixed(2) + "%",
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
        return "MANUAL_REVIEW";
      case 3:
        return "CUSTOM_ACTION";
      default:
        return "UNKNOWN";
    }
  }
}

export default logger;
