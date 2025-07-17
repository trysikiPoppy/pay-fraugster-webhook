export interface FraudTransaction {
  transaction_id: string;
  timestamp: string;
  amount: number;
  currency: string;
  status: string;
  sender: {
    id: string;
    name: string;
    bank_details?: {
      account_number: string;
      bank_code: string;
    };
  };
  recipient: {
    id: string;
    name: string;
    bank_details?: {
      account_number: string;
      bank_code: string;
    };
  };
  metadata?: Record<string, unknown>;
}

interface FraudAuthResponse {
  sessionToken: string;
}

interface FraudTransactionItem {
  item_id: number;
  unique_item_id: string;
  item_desc: string;
  additional_description?: string;
  item_amt: number;
  discount?: number;
  tax_rate?: number;
  quantity: number;
}

interface FraudTransactionRequest {
  platform_id?: string;
  trans_id: string;
  seller_id: string;
  order_id?: string;
  items?: FraudTransactionItem[];
  trans_amt: number;
  trans_currency?: string;
  trans_ts: string;
  pmt_method?: string;
  cc_num_hash?: string;
  cc_bin?: string;
  cc_last_4_dig?: string;
  bin_brand?: string;
  cc_exp_dt?: string;
  bill_ad_city?: string;
  bill_ad_ctry?: string;
  bill_ad_line1?: string;
  bill_ad_line2?: string;
  bill_ad_state?: string;
  bill_ad_zip?: string;
  bill_ad_first_name?: string;
  bill_ad_last_name?: string;
  bill_ad_name?: string;
  bill_name_title?: string;
  cust_email: string;
  cust_last_name: string;
  cust_first_name: string;
  cust_name_title?: string;
  cust_id?: string;
  cust_dob?: string;
  cust_company?: string;
  phone?: string;
  phone_mobile?: string;
  ship_ad_last_name?: string;
  ship_ad_first_name?: string;
  ship_name_title?: string;
  ship_ad_city?: string;
  ship_ad_ctry?: string;
  ship_ad_line1?: string;
  ship_ad_line2?: string;
  ship_ad_state?: string;
  ship_ad_zip?: string;
  ip?: string;
  sub_seller?: string;

  ba_iban?: string;
  ba_bic?: string;
  ba_name?: string;
}

interface FraudSignal {
  category: string;
  id: string;
  related_to: string[];
  type: string;
}

interface FraudTransactionResponse {
  fraud_approved: 0 | 1 | 2 | 3;
  fraud_trans_id: string;
  is_liable: boolean;
  liability_reason?: string;
  score: number;
  validation: {
    ok: boolean;
    errors?: Array<{
      datapoint: string;
      msg: string;
    }>;
  };
  evidence?: {
    signals: FraudSignal[];
  };
  fraud_device_id?: string;
  error_msg?: string;
}

export type {
  FraudAuthResponse,
  FraudTransactionRequest,
  FraudTransactionResponse,
  FraudTransactionItem,
  FraudSignal,
};
