export interface PayWebhookPayload {
  id: string;
  event: string;
  data: {
    id: string;
    amount: string | number;
    currency: string;
    status: string;
    createdAt: number;
    updatedAt?: number;
    reference?: string;
    metadata?: Record<string, any>;
    owner?: {
      type: string;
      id: string;
    };
    payee?: {
      id: string;
      name: string;
      bankDetails?: {
        accountNumber?: string;
        routingCode?: {
          value: string;
          type: string;
        };
        country?: string;
        bankName?: string;
        accountHolderName?: string;
        iban?: string;
        bic?: string;
        bankAddress?: string;
      };
    };
    payer?: {
      id: string;
      name?: string;
      bankDetails?: {
        accountNumber?: string;
        routingCode?: {
          value: string;
          type: string;
        };
        country?: string;
        bankName?: string;
        accountHolderName?: string;
        iban?: string;
        bic?: string;
        bankAddress?: string;
      };
    };
    balance?: {
      actual: string;
      available: string;
      reserved: string;
    };
    bankDetails?: {
      accountNumber?: string;
      routingCode?: {
        value: string;
        type: string;
      };
      country?: string;
      bankName?: string;
      accountHolderName?: string;
      iban?: string;
      bic?: string;
      bankAddress?: string;
    };
  };
  previousValues?: Record<string, any>;
  createdAt: number;
}

export interface PaymentData {
  id: string;
  amount: string | number;
  currency: string;
  status: string;
  createdAt: number;
}
