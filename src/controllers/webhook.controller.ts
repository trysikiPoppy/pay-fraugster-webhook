import { Request, Response } from "express";
import { WebhookService } from "../services/webhook.service";
import { TransactionLogger } from "../utils/logger";

export class WebhookController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      TransactionLogger.logWebhookReceived(req.body, req.headers);

      await this.webhookService.processWebhook(req.body);

      res.status(200).json({ status: "success" });
    } catch (error) {
      TransactionLogger.logError(error as Error, {
        request_body: req.body,
        request_headers: req.headers,
        ip: req.ip,
      });
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
