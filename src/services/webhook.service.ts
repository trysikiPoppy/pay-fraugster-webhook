import { config } from "../config";
import { PaymentWebhookPayload } from "../types/payment.types";
import { FraudTransactionRequest } from "../types/fraud.types";
import { fraudService } from "./fraud.service";
import { PaymentService } from "./payment.service";
import { TransactionLogger, logger } from "../utils/logger";

export class WebhookService {
  private paymentService: PaymentService;
  private customerDataCache: Map<string, any> = new Map();

  constructor() {
    this.paymentService = new PaymentService();
  }

  private clearCache(): void {
    this.customerDataCache.clear();
  }

  private extractCountryFromPayload(payload: PaymentWebhookPayload): string {
    if ((payload as any).data?.from?.bankDetails?.country) {
      return (payload as any).data.from.bankDetails.country;
    }
    if ((payload as any).data?.to?.bankDetails?.country) {
      return (payload as any).data.to.bankDetails.country;
    }
    if ((payload as any).data?.payer?.bankDetails?.country) {
      return (payload as any).data.payer.bankDetails.country;
    }
    if ((payload as any).data?.payee?.bankDetails?.country) {
      return (payload as any).data.payee.bankDetails.country;
    }
    if ((payload as any).data?.from?.bankDetails?.iban) {
      const iban = (payload as any).data.from.bankDetails.iban;
      const countryCode = iban.substring(0, 2);
      return countryCode;
    }
    if ((payload as any).data?.to?.bankDetails?.iban) {
      const iban = (payload as any).data.to.bankDetails.iban;
      const countryCode = iban.substring(0, 2);
      return countryCode;
    }
    if ((payload as any).data?.payer?.bankDetails?.iban) {
      const iban = (payload as any).data.payer.bankDetails.iban;
      const countryCode = iban.substring(0, 2);
      return countryCode;
    }
    if ((payload as any).data?.payee?.bankDetails?.iban) {
      const iban = (payload as any).data.payee.bankDetails.iban;
      const countryCode = iban.substring(0, 2);
      return countryCode;
    }
    return "US";
  }

  private async enrichCountryData(
    payload: PaymentWebhookPayload
  ): Promise<string> {
    const fromPayload = this.extractCountryFromPayload(payload);
    if (fromPayload && fromPayload !== "US") {
      return fromPayload;
    }

    const customerIds = [
      payload.data?.fromId,
      payload.data?.toId,
      payload.data?.payerId,
      payload.data?.payeeId,
    ].filter(Boolean);

    for (const customerId of customerIds) {
      try {
        const cacheKey = `country_${customerId}`;
        if (this.customerDataCache.has(cacheKey)) {
          const cached = this.customerDataCache.get(cacheKey);
          if (cached) return cached;
        }

        const customerInfo = await this.paymentService.getCustomerInfo(
          customerId!
        );
        if (customerInfo?.address?.country) {
          this.customerDataCache.set(cacheKey, customerInfo.address.country);
          return customerInfo.address.country;
        }
      } catch (error) {
        logger.warn(`Failed to get country data for customer ${customerId}`, {
          event: "payment_api_error",
          customer_id: customerId,
          error: (error as Error).message,
        });
      }
    }

    return "US";
  }

  private async extractCustomerInfo(payload: PaymentWebhookPayload): Promise<{
    firstName: string;
    lastName: string;
    email: string;
    customerId: string;
  }> {
    const customerIds = [
      payload.data?.fromId,
      payload.data?.toId,
      payload.data?.payerId,
      payload.data?.payeeId,
    ].filter(Boolean);

    for (const customerId of customerIds) {
      try {
        const cacheKey = `customer_${customerId}`;
        if (this.customerDataCache.has(cacheKey)) {
          const cached = this.customerDataCache.get(cacheKey);
          if (cached) return cached;
        }

        const customerInfo = await this.paymentService.getCustomerInfo(
          customerId!
        );
        if (customerInfo) {
          const result = {
            firstName: customerInfo.firstName || "Unknown",
            lastName: customerInfo.lastName || "Unknown",
            email: customerInfo.email || "unknown@example.com",
            customerId: customerId!,
          };
          this.customerDataCache.set(cacheKey, result);
          return result;
        }
      } catch (error) {
        logger.warn(`Failed to get customer info for ${customerId}`, {
          event: "payment_api_error",
          customer_id: customerId,
          error: (error as Error).message,
        });
      }
    }

    return {
      firstName: "Unknown",
      lastName: "Unknown",
      email: "unknown@example.com",
      customerId: customerIds[0] || "unknown",
    };
  }

  private async enrichBillingAddress(payload: PaymentWebhookPayload): Promise<{
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }> {
    const customerIds = [
      payload.data?.fromId,
      payload.data?.toId,
      payload.data?.payerId,
      payload.data?.payeeId,
    ].filter(Boolean);

    for (const customerId of customerIds) {
      try {
        const cacheKey = `address_${customerId}`;
        if (this.customerDataCache.has(cacheKey)) {
          const cached = this.customerDataCache.get(cacheKey);
          if (cached) return cached;
        }

        const customerInfo = await this.paymentService.getCustomerInfo(
          customerId!
        );
        if (customerInfo?.address) {
          const result = {
            line1: customerInfo.address.street,
            city: customerInfo.address.city,
            state: customerInfo.address.state,
            zip: customerInfo.address.postalCode,
            country: customerInfo.address.country,
          };
          this.customerDataCache.set(cacheKey, result);
          return result;
        }
      } catch (error) {
        logger.warn(`Failed to get address for customer ${customerId}`, {
          event: "payment_api_error",
          customer_id: customerId,
          error: (error as Error).message,
        });
      }
    }

    return {};
  }

  private async mapToFraudFormat(
    payload: PaymentWebhookPayload
  ): Promise<FraudTransactionRequest> {
    let amount: number;

    if (typeof payload.data.amount === "string") {
      amount = parseFloat(payload.data.amount);
    } else {
      amount = payload.data.amount / 100;
    }

    const country = await this.enrichCountryData(payload);
    const billingAddress = await this.enrichBillingAddress(payload);
    const customerInfo = await this.extractCustomerInfo(payload);

    let paymentMethod = "bank_transfer";
    let ccBin = "";
    let ccLast4 = "";
    let binBrand = "";

    if ((payload as any).data?.from?.bankDetails?.iban) {
      const iban = (payload as any).data.from.bankDetails.iban;
      ccBin = iban.substring(0, 6).replace(/\s/g, "");
      ccLast4 = iban.substring(iban.length - 4);
      paymentMethod = "bank_transfer";
    }

    if ((payload as any).data?.payer?.bankDetails?.iban) {
      const iban = (payload as any).data.payer.bankDetails.iban;
      ccBin = iban.substring(0, 6).replace(/\s/g, "");
      ccLast4 = iban.substring(iban.length - 4);
      paymentMethod = "bank_transfer";
    }

    if ((payload as any).data?.to?.bankDetails?.iban) {
      const iban = (payload as any).data.to.bankDetails.iban;
      ccBin = iban.substring(0, 6).replace(/\s/g, "");
      ccLast4 = iban.substring(iban.length - 4);
      paymentMethod = "bank_transfer";
    }

    if ((payload as any).data?.payee?.bankDetails?.iban) {
      const iban = (payload as any).data.payee.bankDetails.iban;
      ccBin = iban.substring(0, 6).replace(/\s/g, "");
      ccLast4 = iban.substring(iban.length - 4);
      paymentMethod = "bank_transfer";
    }

    if ((payload as any).data?.paymentScheme) {
      const scheme = (payload as any).data.paymentScheme;
      if (scheme === "SCT" || scheme === "SEPA") {
        paymentMethod = "sepa_transfer";
        binBrand = "SEPA";
      }
    }

    const fraudData: FraudTransactionRequest = {
      trans_id: payload.data.id,
      trans_ts: new Date(payload.data.createdAt).toISOString(),
      trans_amt: amount,
      trans_currency: payload.data.currency,
      platform_id: "PaymentService",
      seller_id: "PaymentService",

      cust_first_name: customerInfo.firstName,
      cust_last_name:
        customerInfo.lastName && customerInfo.lastName !== "undefined"
          ? customerInfo.lastName
          : "",
      cust_id: customerInfo.customerId,
      cust_email: customerInfo.email,

      bill_ad_first_name: customerInfo.firstName,
      bill_ad_last_name:
        customerInfo.lastName && customerInfo.lastName !== "undefined"
          ? customerInfo.lastName
          : "",
      bill_ad_name:
        customerInfo.lastName && customerInfo.lastName !== "undefined"
          ? `${customerInfo.firstName} ${customerInfo.lastName}`.trim()
          : customerInfo.firstName,

      pmt_method: paymentMethod,
      cc_bin: ccBin || undefined,
      cc_last_4_dig: ccLast4 || undefined,
      bin_brand: binBrand || undefined,

      bill_ad_city: billingAddress.city || country,
      bill_ad_ctry: billingAddress.country || country,
      bill_ad_line1: billingAddress.line1,
      bill_ad_line2: billingAddress.line2,
      bill_ad_state: billingAddress.state,
      bill_ad_zip: billingAddress.zip,

      ship_ad_city: billingAddress.city || country,
      ship_ad_ctry: billingAddress.country || country,
      ship_ad_line1: billingAddress.line1,
      ship_ad_line2: billingAddress.line2,
      ship_ad_state: billingAddress.state,
      ship_ad_zip: billingAddress.zip,

      order_id: payload.data.reference || payload.data.id,
    };

    let bankIban = "";
    let bankBic = "";
    let bankName = "";

    if ((payload as any).data?.from?.bankDetails?.iban) {
      bankIban = (payload as any).data.from.bankDetails.iban;
      bankBic = (payload as any).data.from.bankDetails.bic || "";
      bankName = (payload as any).data.from.bankDetails.accountHolderName || "";
    }

    if ((payload as any).data?.payer?.bankDetails?.iban) {
      bankIban = (payload as any).data.payer.bankDetails.iban;
      bankBic = (payload as any).data.payer.bankDetails.bic || "";
      bankName =
        (payload as any).data.payer.bankDetails.accountHolderName || "";
    }

    if ((payload as any).data?.to?.bankDetails?.iban) {
      bankIban = (payload as any).data.to.bankDetails.iban;
      bankBic = (payload as any).data.to.bankDetails.bic || "";
      bankName = (payload as any).data.to.bankDetails.accountHolderName || "";
    }

    if ((payload as any).data?.payee?.bankDetails?.iban) {
      bankIban = (payload as any).data.payee.bankDetails.iban;
      bankBic = (payload as any).data.payee.bankDetails.bic || "";
      bankName =
        (payload as any).data.payee.bankDetails.accountHolderName || "";
    }

    if (bankIban) {
      fraudData.ba_iban = bankIban;
    }

    if (bankBic) {
      fraudData.ba_bic = bankBic;
    }

    if (bankName) {
      fraudData.ba_name = bankName;
    }

    return fraudData;
  }

  public async processWebhook(payload: PaymentWebhookPayload): Promise<void> {
    try {
      this.clearCache();

      const fraudData = await this.mapToFraudFormat(payload);

      TransactionLogger.logDataMapping(payload, fraudData);

      const response = await fraudService.sendTransaction(fraudData);
      TransactionLogger.logFraudResponse(fraudData, response);

      if (!response.validation?.ok && response.validation?.errors) {
        TransactionLogger.logValidationErrors(
          payload.data.id,
          response.validation.errors
        );
      }

      if (response.fraud_approved === 0) {
        TransactionLogger.logFraudResponse(fraudData, response);
      }
    } catch (error) {
      this.clearCache();
      TransactionLogger.logError(error as Error, {
        payment_transaction_id: payload.data?.id,
        event_type: payload.event,
        amount: payload.data?.amount,
        currency: payload.data?.currency,
        country: this.extractCountryFromPayload(payload),
      });
      throw new Error(
        "Failed to process transaction in fraud detection service"
      );
    }
  }
}
