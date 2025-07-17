export interface PaymentWebhookPayload {
  id: string;
  event: string;
  data: PaymentTransactionData;
  timestamp: string;
}

export interface PaymentTransactionData {
  id: string;
  amount: number | string;
  currency: string;
  status: string;
  createdAt: string;
  reference?: string;
  fromId?: string;
  toId?: string;
  payerId?: string;
  payeeId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentOAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface PaymentOAuthError {
  error: string;
  error_description: string;
}

export interface PaymentApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaymentCustomerInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  bankDetails?: {
    iban?: string;
    bic?: string;
    accountHolderName?: string;
  };
}

export interface PaymentTransactionInfo {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  from?: PaymentCustomerInfo;
  to?: PaymentCustomerInfo;
  payer?: PaymentCustomerInfo;
  payee?: PaymentCustomerInfo;
  metadata?: Record<string, unknown>;
}

export interface PaymentApiResponse<T = unknown> {
  data?: T;
  error?: PaymentApiError;
  status: number;
  statusText: string;
}

export interface PaymentBankDetails {
  iban: string;
  bic?: string;
  accountHolderName?: string;
}

export interface PaymentParty {
  id: string;
  name: string;
  bankDetails?: PaymentBankDetails;
}

export interface PaymentRawTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  from?: PaymentParty;
  to?: PaymentParty;
  payer?: PaymentParty;
  payee?: PaymentParty;
  reference?: string;
  metadata?: Record<string, unknown>;
}

export type PaymentCustomerType = "from" | "to" | "payer" | "payee";
export type PaymentTransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";
