import axios, { AxiosError } from "axios";
import {
  PaymentOAuthToken,
  PaymentOAuthError,
  PaymentCustomerInfo,
  PaymentApiResponse,
  PaymentTransactionInfo,
} from "../types/payment.types";
import { config } from "../config";
import { TransactionLogger, logger } from "../utils/logger";

export class PaymentService {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor() {
    this.baseUrl = config.payment.apiUrl;
    this.clientId = config.payment.clientId;
    this.clientSecret = config.payment.clientSecret;
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post<PaymentOAuthToken>(
        `${this.baseUrl}/oauth/token`,
        {
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 30000,
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

      TransactionLogger.logPaymentAuth(this.accessToken);
    } catch (error) {
      const axiosError = error as AxiosError<PaymentOAuthError>;
      TransactionLogger.logPaymentOAuthError(axiosError);
      throw new Error(
        `Failed to authenticate with payment service: ${axiosError.message}`
      );
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (
      !this.accessToken ||
      !this.tokenExpiresAt ||
      Date.now() >= this.tokenExpiresAt - 60000
    ) {
      await this.authenticate();
    }
  }

  public async getCustomerInfo(
    customerId: string
  ): Promise<PaymentCustomerInfo | null> {
    await this.ensureAuthenticated();

    try {
      const response = await axios.get<PaymentApiResponse<PaymentCustomerInfo>>(
        `${this.baseUrl}/api/v1/customers/${customerId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      return response.data.data || null;
    } catch (error) {
      const axiosError = error as AxiosError;
      TransactionLogger.logPaymentApiError(axiosError, customerId);

      if (axiosError.response?.status === 401) {
        logger.warn("Payment service token expired, reauthenticating", {
          event: "payment_oauth_error",
          customer_id: customerId,
        });
        this.accessToken = null;
        this.tokenExpiresAt = null;
        return this.getCustomerInfo(customerId);
      }

      if (axiosError.response?.status === 404) {
        return null;
      }

      throw new Error(
        `Failed to get customer info from payment service: ${axiosError.message}`
      );
    }
  }

  public async getTransactionInfo(
    transactionId: string
  ): Promise<PaymentTransactionInfo | null> {
    await this.ensureAuthenticated();

    try {
      const response = await axios.get<
        PaymentApiResponse<PaymentTransactionInfo>
      >(`${this.baseUrl}/api/v1/transactions/${transactionId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });

      return response.data.data || null;
    } catch (error) {
      const axiosError = error as AxiosError;
      TransactionLogger.logPaymentApiError(axiosError, transactionId);

      if (axiosError.response?.status === 401) {
        logger.warn("Payment service token expired, reauthenticating", {
          event: "payment_oauth_error",
          transaction_id: transactionId,
        });
        this.accessToken = null;
        this.tokenExpiresAt = null;
        return this.getTransactionInfo(transactionId);
      }

      if (axiosError.response?.status === 404) {
        return null;
      }

      throw new Error(
        `Failed to get transaction info from payment service: ${axiosError.message}`
      );
    }
  }
}
