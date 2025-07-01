import axios, { AxiosError } from "axios";
import {
  FraugsterAuthResponse,
  FraugsterTransactionRequest,
  FraugsterTransactionResponse,
} from "../types/fraugster.types";
import { config } from "../config";
import { TransactionLogger, logger } from "../utils/logger";

class FraugsterService {
  private baseUrl: string;
  private sessionToken: string | null = null;
  private username: string;
  private password: string;

  constructor() {
    this.baseUrl = config.fraugster.apiUrl;
    this.username = config.fraugster.username;
    this.password = config.fraugster.password;
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post<FraugsterAuthResponse>(
        `${this.baseUrl}/api/v2/sessions`,
        {},
        {
          auth: {
            username: this.username,
            password: this.password,
          },
          timeout: 40000,
        }
      );
      this.sessionToken = response.data.sessionToken;
    } catch (error) {
      const axiosError = error as AxiosError;
      TransactionLogger.logAuthenticationError(axiosError);
      throw new Error(
        `Failed to authenticate with Fraugster: ${axiosError.message}`
      );
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.sessionToken) {
      await this.authenticate();
    }
  }

  public async sendTransaction(
    transaction: FraugsterTransactionRequest
  ): Promise<FraugsterTransactionResponse> {
    await this.ensureAuthenticated();

    try {
      TransactionLogger.logFraugsterRequest(transaction);

      const response = await axios.post<FraugsterTransactionResponse>(
        `${this.baseUrl}/api/v2/transaction`,
        transaction,
        {
          headers: {
            Authorization: `SessionToken ${this.sessionToken}`,
            "Content-Type": "application/json",
          },
          timeout: 40000,
        }
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      TransactionLogger.logApiError(axiosError, transaction);

      if (axiosError.response?.status === 401) {
        logger.warn("Session token expired, reauthenticating", {
          event: "session_token_expired",
          trans_id: transaction.trans_id,
        });
        this.sessionToken = null;
        return this.sendTransaction(transaction);
      }
      throw new Error(
        `Failed to send transaction to Fraugster: ${axiosError.message}`
      );
    }
  }
}

export const fraugsterService = new FraugsterService();
