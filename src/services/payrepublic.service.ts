import axios from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface PayeeResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    iban?: string;
    bic?: string;
    accountNumber?: string;
    routingCodes?: {
      type: string;
      value: string;
    };
    bankCountry?: string;
  };
  additionalDetails?: {
    address?: string;
    addressLine1?: string;
    addressLine2?: string;
    addressCity?: string;
    addressState?: string;
    addressPostalCode?: string;
    addressCountry?: string;
    dob?: string;
  };
  payAccount: {
    id: string;
    accountNumber: string;
    country: string;
    bankName?: string;
    routingNumber?: string;
  };
  createdAt?: number;
  updatedAt?: number;
  metadata?: string[];
}

export interface PayerResponse {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  type?: string;
  owner?: {
    type: string;
    id: string;
  };
  bankDetails?: {
    iban?: string;
    bic?: string;
    accountNumber?: string;
    bankCountry?: string;
    accountHolderName?: string;
    bankName?: string;
    routingCodes?: {
      type: string;
      value: string;
    };
  };
  additionalDetails?: {
    address?: string;
    addressLine1?: string;
    addressLine2?: string;
    addressCity?: string;
    addressState?: string;
    addressPostalCode?: string;
    addressCountry?: string;
    dob?: string;
  };
  payAccount?: {
    id: string;
    accountNumber: string;
    country: string;
    bankName?: string;
    routingNumber?: string;
  };
  country?: string;
  createdAt?: number;
  updatedAt?: number;
  metadata?: string[];
}

export class PayRepublicService {
  private readonly apiUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.apiUrl = config.payRepublic.apiUrl;
    this.clientId = config.payRepublic.clientId;
    this.clientSecret = config.payRepublic.clientSecret;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.apiUrl}/passport/oauth/token`,
        new URLSearchParams({
          grant_type: "client_credentials",
          scope: "PAYMENTS",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 10000,
        }
      );

      this.accessToken = response.data.access_token as string;
      this.tokenExpiresAt = now + response.data.expires_in * 1000 - 60000; // 1 minute buffer
      return this.accessToken;
    } catch (error: any) {
      logger.error("Failed to obtain OAuth access token", {
        event: "pay_oauth_error",
        error: error.message,
        status: error.response?.status,
        clientId: this.clientId,
      });
      throw new Error("Failed to authenticate with Pay Republic API");
    }
  }

  async getPayeeById(payeeId: string): Promise<PayeeResponse | null> {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.apiUrl}/api/v1/payees/${payeeId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error("Failed to fetch payee data from Pay Republic", {
        event: "pay_api_error",
        payeeId,
        error: error.message,
        status: error.response?.status,
      });

      return null;
    }
  }

  async getPayerById(payerId: string): Promise<PayerResponse | null> {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.apiUrl}/api/v1/payers/${payerId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error("Failed to fetch payer data from Pay Republic", {
        event: "pay_api_error",
        payerId,
        error: error.message,
        status: error.response?.status,
      });

      return null;
    }
  }
}
