import { config } from "../config";
import { PayWebhookPayload } from "../types/pay.types";
import { FraugsterTransactionRequest } from "../types/fraugster.types";
import { fraugsterService } from "./fraugster.service";
import { PayRepublicService } from "./payrepublic.service";
import { TransactionLogger, logger } from "../utils/logger";

export class WebhookService {
  private payRepublicService: PayRepublicService;
  private customerDataCache: Map<string, any> = new Map();

  constructor() {
    this.payRepublicService = new PayRepublicService();
  }

  private normalizeCountryToISO(country: string): string {
    if (!country) return "";

    const countryMappings: { [key: string]: string } = {
      lithuania: "LT",
      germany: "DE",
      "germany branch": "DE",
      "united states": "US",
      usa: "US",
      "united kingdom": "GB",
      uk: "GB",
      france: "FR",
      spain: "ES",
      italy: "IT",
      netherlands: "NL",
      belgium: "BE",
      austria: "AT",
      switzerland: "CH",
      poland: "PL",
      "czech republic": "CZ",
      slovakia: "SK",
      hungary: "HU",
      slovenia: "SI",
      croatia: "HR",
      romania: "RO",
      bulgaria: "BG",
      latvia: "LV",
      estonia: "EE",
      finland: "FI",
      sweden: "SE",
      norway: "NO",
      denmark: "DK",
    };

    const normalizedCountry = country.toLowerCase().trim();

    if (normalizedCountry.length === 2) {
      return normalizedCountry.toUpperCase();
    }

    return (
      countryMappings[normalizedCountry] ||
      country.substring(0, 2).toUpperCase()
    );
  }

  private extractCountryFromIBAN(iban: string): string {
    if (!iban) return "";
    const cleanIban = iban.replace(/\s/g, "");
    if (cleanIban.length >= 2) {
      return cleanIban.substring(0, 2).toUpperCase();
    }
    return "";
  }

  private extractCountryFromPayload(payload: PayWebhookPayload): string {
    return (
      payload.data.bankDetails?.country ||
      payload.data.payee?.bankDetails?.country ||
      payload.data.payer?.bankDetails?.country ||
      (payload as any).data?.from?.bankDetails?.country ||
      (payload as any).data?.from?.bankDetails?.bankCountry ||
      (payload as any).data?.payer?.bankDetails?.bankCountry ||
      (payload as any).data?.payee?.bankDetails?.bankCountry ||
      ""
    );
  }

  private async enrichCountryData(payload: PayWebhookPayload): Promise<string> {
    let countryFromPayload = this.extractCountryFromPayload(payload);

    let countryFromIBAN = "";
    if ((payload as any).data?.from?.bankDetails?.iban) {
      countryFromIBAN = this.extractCountryFromIBAN(
        (payload as any).data.from.bankDetails.iban
      );
    }
    if ((payload as any).data?.payer?.bankDetails?.iban) {
      countryFromIBAN = this.extractCountryFromIBAN(
        (payload as any).data.payer.bankDetails.iban
      );
    }

    if ((payload as any).data?.to?.bankDetails?.iban) {
      countryFromIBAN = this.extractCountryFromIBAN(
        (payload as any).data.to.bankDetails.iban
      );
    }

    if (countryFromIBAN) {
      return countryFromIBAN;
    }

    if (countryFromPayload) {
      const isoCountry = this.normalizeCountryToISO(countryFromPayload);
      return isoCountry;
    }

    const customerData = await this.getCustomerData(payload);

    if (customerData) {
      let country = "";
      if (
        "additionalDetails" in customerData &&
        customerData.additionalDetails
      ) {
        country = customerData.additionalDetails.addressCountry || "";
      }
      if (
        !country &&
        "bankDetails" in customerData &&
        customerData.bankDetails
      ) {
        country = customerData.bankDetails.bankCountry || "";
      }
      if (!country && "payAccount" in customerData && customerData.payAccount) {
        country = customerData.payAccount.country || "";
      }
      if (!country && "country" in customerData) {
        country = customerData.country || "";
      }

      if (country) {
        const isoCountry = this.normalizeCountryToISO(country);
        return isoCountry;
      }
    }

    return (
      countryFromIBAN || this.normalizeCountryToISO(countryFromPayload) || ""
    );
  }

  private extractCityFromPayload(payload: PayWebhookPayload): string {
    return (
      payload.data.bankDetails?.bankAddress ||
      payload.data.payee?.bankDetails?.bankAddress ||
      payload.data.payer?.bankDetails?.bankAddress ||
      ""
    );
  }

  private async enrichBillingAddress(payload: PayWebhookPayload) {
    const customerData = await this.getCustomerData(payload);

    const defaultAddress = {
      city: this.extractCityFromPayload(payload),
      country: "",
      line1: "",
      line2: "",
      state: "",
      zip: "",
    };

    let countryFromIBAN = "";
    if ((payload as any).data?.from?.bankDetails?.iban) {
      countryFromIBAN = this.extractCountryFromIBAN(
        (payload as any).data.from.bankDetails.iban
      );
    }
    if ((payload as any).data?.payer?.bankDetails?.iban) {
      countryFromIBAN = this.extractCountryFromIBAN(
        (payload as any).data.payer.bankDetails.iban
      );
    }

    if ((payload as any).data?.to?.bankDetails?.iban) {
      countryFromIBAN = this.extractCountryFromIBAN(
        (payload as any).data.to.bankDetails.iban
      );
    }

    if ((payload as any).data?.from?.bankDetails) {
      const bankDetails = (payload as any).data.from.bankDetails;
      if (bankDetails.bankAddress) {
        defaultAddress.line1 = bankDetails.bankAddress;
      }
      if (bankDetails.country) {
        defaultAddress.country = this.normalizeCountryToISO(
          bankDetails.country
        );
      }
    }

    if ((payload as any).data?.payer?.bankDetails) {
      const bankDetails = (payload as any).data.payer.bankDetails;
      if (bankDetails.bankAddress) {
        defaultAddress.line1 = bankDetails.bankAddress;
      }
      if (bankDetails.country) {
        defaultAddress.country = this.normalizeCountryToISO(
          bankDetails.country
        );
      }
    }

    if ((payload as any).data?.to?.bankDetails) {
      const bankDetails = (payload as any).data.to.bankDetails;
      if (bankDetails.bankAddress) {
        defaultAddress.line1 = bankDetails.bankAddress;
      }
      if (bankDetails.country) {
        defaultAddress.country = this.normalizeCountryToISO(
          bankDetails.country
        );
      }
    }

    if (countryFromIBAN && !defaultAddress.country) {
      defaultAddress.country = countryFromIBAN;
    }

    if (!customerData) {
      return defaultAddress;
    }

    if (
      customerData &&
      "additionalDetails" in customerData &&
      customerData.additionalDetails
    ) {
      const addr = customerData.additionalDetails;
      const result = {
        city: addr.addressCity || defaultAddress.city,
        country:
          this.normalizeCountryToISO(addr.addressCountry || "") ||
          defaultAddress.country,
        line1: addr.addressLine1 || addr.address || defaultAddress.line1,
        line2: addr.addressLine2 || "",
        state: addr.addressState || "",
        zip: addr.addressPostalCode || "",
      };

      return result;
    }

    if (customerData && "address" in customerData && customerData.address) {
      const addr = customerData.address;
      const result = {
        city: addr.city || defaultAddress.city,
        country:
          this.normalizeCountryToISO(addr.country || "") ||
          defaultAddress.country,
        line1: addr.line1 || defaultAddress.line1,
        line2: addr.line2 || "",
        state: addr.state || "",
        zip: addr.postalCode || "",
      };

      return result;
    }

    if (
      customerData &&
      "payAccount" in customerData &&
      customerData.payAccount?.country &&
      !defaultAddress.country
    ) {
      defaultAddress.country = this.normalizeCountryToISO(
        customerData.payAccount.country
      );
    }

    return defaultAddress;
  }

  private async extractCustomerInfo(payload: PayWebhookPayload) {
    let customerId = "";
    if ((payload as any).data?.direction === "PAYOUT") {
      customerId = (payload as any).data?.to?.id || "";
    } else {
      customerId = (payload as any).data?.from?.id || "";
    }

    const customerData = await this.getCustomerData(payload);

    let fallbackInfo = {
      firstName: "Unknown",
      lastName: "",
      customerId: customerId,
      email: `${customerId}@placeholder.com`,
    };

    const nameSource =
      (payload as any).data?.from?.name ||
      (payload as any).data?.to?.name ||
      "";
    if (nameSource) {
      const nameParts = nameSource.split(" ");
      fallbackInfo.firstName = nameParts[0] || "Unknown";
      fallbackInfo.lastName = nameParts.slice(1).join(" ") || "";
    }

    if ((payload as any).data?.payer?.name) {
      const nameParts = (payload as any).data.payer.name.split(" ");
      fallbackInfo.firstName = nameParts[0] || "Unknown";
      fallbackInfo.lastName = nameParts.slice(1).join(" ") || "";
    }

    if (!customerId) {
      return fallbackInfo;
    }

    if (customerData?.name) {
      const nameParts = customerData.name.split(" ");
      const firstName = nameParts[0] || fallbackInfo.firstName;
      const lastName = nameParts.slice(1).join(" ");
      return {
        firstName: firstName,
        lastName: lastName || "",
        customerId: customerId,
        email: customerData.email || `${customerId}@placeholder.com`,
      };
    }

    if (
      customerData &&
      "bankDetails" in customerData &&
      customerData.bankDetails?.accountHolderName
    ) {
      const nameParts = customerData.bankDetails.accountHolderName.split(" ");
      const firstName = nameParts[0] || fallbackInfo.firstName;
      const lastName = nameParts.slice(1).join(" ");
      return {
        firstName: firstName,
        lastName: lastName || "",
        customerId: customerId,
        email: customerData.email || `${customerId}@placeholder.com`,
      };
    }

    return fallbackInfo;
  }

  private async getCustomerData(payload: PayWebhookPayload): Promise<any> {
    let customerId = "";
    let customerType = "";

    if ((payload as any).data?.direction === "PAYOUT") {
      customerId = (payload as any).data?.to?.id || "";
      customerType = (payload as any).data?.to?.type || "";
    } else {
      customerId = (payload as any).data?.from?.id || "";
      customerType = (payload as any).data?.from?.type || "";
    }

    if (!customerId) {
      return null;
    }

    const cacheKey = `${customerId}_${customerType}`;

    if (this.customerDataCache.has(cacheKey)) {
      return this.customerDataCache.get(cacheKey);
    }

    let customerData = null;
    try {
      if (customerType === "PAYEE") {
        customerData = await this.payRepublicService.getPayeeById(customerId);
      } else if (customerType === "PAYER") {
        customerData = await this.payRepublicService.getPayerById(customerId);
      }

      if (customerData) {
        this.customerDataCache.set(cacheKey, customerData);
      }
    } catch (error) {
      this.customerDataCache.set(cacheKey, null);
    }

    return customerData;
  }

  private clearCache(): void {
    this.customerDataCache.clear();
  }

  private async mapToFraugsterFormat(
    payload: PayWebhookPayload
  ): Promise<FraugsterTransactionRequest> {
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

    const fraugsterData: FraugsterTransactionRequest = {
      trans_id: payload.data.id,
      trans_ts: new Date(payload.data.createdAt).toISOString(),
      trans_amt: amount,
      trans_currency: payload.data.currency,
      platform_id: "PayRepublic",
      seller_id: "PayRepublic",

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
      fraugsterData.ba_iban = bankIban;
    }

    if (bankBic) {
      fraugsterData.ba_bic = bankBic;
    }

    if (bankName) {
      fraugsterData.ba_name = bankName;
    }

    return fraugsterData;
  }

  public async processWebhook(payload: PayWebhookPayload): Promise<void> {
    try {
      this.clearCache();

      const fraugsterData = await this.mapToFraugsterFormat(payload);

      TransactionLogger.logDataMapping(payload, fraugsterData);

      const response = await fraugsterService.sendTransaction(fraugsterData);
      TransactionLogger.logFraugsterResponse(fraugsterData, response);

      if (!response.validation?.ok && response.validation?.errors) {
        TransactionLogger.logValidationErrors(
          payload.data.id,
          response.validation.errors
        );
      }

      if (response.fraugster_approved === 0) {
        TransactionLogger.logFraugsterResponse(fraugsterData, response);
      }
    } catch (error) {
      this.clearCache();
      TransactionLogger.logError(error as Error, {
        pay_transaction_id: payload.data?.id,
        event_type: payload.event,
        amount: payload.data?.amount,
        currency: payload.data?.currency,
        country: this.extractCountryFromPayload(payload),
      });
      throw new Error("Failed to process transaction in Fraugster");
    }
  }
}
