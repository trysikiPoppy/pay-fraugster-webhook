import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const testPayload = {
  id: "test-webhook-id",
  type: "payment.created",
  data: {
    id: "test-payment-id",
    amount: 1000,
    currency: "EUR",
    status: "completed",
    created_at: "2024-02-14T12:00:00Z",
    reference: "TEST-REF-001",
    sender: {
      id: "sender-id",
      name: "John Doe",
      account_number: "DE89370400440532013000",
      bank_code: "DEUTDEFF",
    },
    recipient: {
      id: "recipient-id",
      name: "Jane Smith",
      account_number: "GB29NWBK60161331926819",
      bank_code: "NWBKGB2L",
    },
  },
};

const webhookSecret = process.env.PAY_WEBHOOK_SECRET;
if (!webhookSecret) {
  console.error("PAY_WEBHOOK_SECRET not found in .env");
  process.exit(1);
}

const signature = crypto
  .createHmac("sha256", webhookSecret)
  .update(JSON.stringify(testPayload))
  .digest("hex");

console.log("Generated signature:", signature);
console.log("\nUse this signature in the x-fr-signature header for testing");
console.log("\nTest payload to use:");
console.log(JSON.stringify(testPayload, null, 2));
