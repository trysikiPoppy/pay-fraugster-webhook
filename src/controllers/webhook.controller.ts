import { Request, Response } from "express";
import { PaymentWebhookPayload } from "../types/payment.types";
import { WebhookService } from "../services/webhook.service";
import { TransactionLogger } from "../utils/logger";

export class WebhookController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  public async processWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as PaymentWebhookPayload;
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";

      TransactionLogger.logWebhookReceived(payload, req.headers, clientIp);

      await this.webhookService.processWebhook(payload);

      res.status(200).json({
        status: "success",
        message: "Webhook processed successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      TransactionLogger.logError(error as Error, {
        event: "webhook_processing_error",
        ip: req.ip,
        payload: req.body,
      });

      res.status(500).json({
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
