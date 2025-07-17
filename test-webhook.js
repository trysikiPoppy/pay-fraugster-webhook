const axios = require("axios");
const crypto = require("crypto");

const SERVER_URL = "http://localhost:3000";

const testRealPayload = async () => {
  try {
    const payload = {
      id: "wh_test_123",
      event: "PAYMENT.UPDATED",
      data: {
        id: "tx_test_456",
        amount: 1000,
        currency: "EUR",
        status: "completed",
        createdAt: new Date().toISOString(),
        reference: "REF123",
        fromId: "cust_sender_123",
        toId: "cust_receiver_456",
        from: {
          id: "cust_sender_123",
          name: "John Doe",
          bankDetails: {
            iban: "DE89370400440532013000",
            bic: "COBADEFFXXX",
            accountHolderName: "John Doe",
            country: "DE",
          },
        },
        to: {
          id: "cust_receiver_456",
          name: "Jane Smith",
          bankDetails: {
            iban: "FR1420041010050500013M02606",
            bic: "BNPAFRPPXXX",
            accountHolderName: "Jane Smith",
            country: "FR",
          },
        },
      },
      timestamp: new Date().toISOString(),
    };

    console.log("🧪 Testing real payment payload");
    console.log("📊 Payload:", JSON.stringify(payload, null, 2));
    console.log("- Expected customer_id in fraud system:", payload.data.fromId);

    const bodyString = JSON.stringify(payload);
    const webhookSecret =
      process.env.PAYMENT_WEBHOOK_SECRET || "test_secret_for_local_dev";
    const created = Math.floor(Date.now() / 1000);

    const digest = crypto.createHash("sha1").update(bodyString).digest("hex");
    const signatureInput = `fr1=("digest");created=${created}`;
    const signatureParams = signatureInput.replace("fr1=", "");
    const signatureBase = `"digest": "${digest}"\n@signature-params: ${signatureParams}`;
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signatureBase)
      .digest("hex");

    const response = await axios.post(`${SERVER_URL}/webhook`, payload, {
      headers: {
        "Content-Type": "application/json",
        digest: digest,
        "signature-input": signatureInput,
        signature: `fr1=:${signature}:`,
      },
      timeout: 30000,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    });

    console.log("✅ Response:", response.data);
    console.log(`✅ Status: ${response.status}`);

    console.log("\n🎯 What to check in logs:");
    console.log("- customer_id should be: cust_sender_123 (NOT empty)");
    console.log("- API call should be: GET /customers/cust_sender_123");
    console.log("- Data mapping should show sender data extraction");
  } catch (error) {
    console.error("❌ Real payload test failed:", error.message);
    if (error.response) {
      console.error("❌ Error response:", {
        status: error.response.status,
        data: error.response.data,
      });
    }
  }
};

const testHealthEndpoint = async () => {
  try {
    console.log("🏥 Testing health endpoint");
    const response = await axios.get(`${SERVER_URL}/health`);
    console.log("✅ Health check passed:", response.data);
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
  }
};

const main = async () => {
  console.log("🚀 Starting Payment-Fraud webhook tests...\n");

  await testHealthEndpoint();
  console.log("\n" + "=".repeat(50) + "\n");
  await testRealPayload();

  console.log("\n🎉 Tests completed!");
};

main().catch(console.error);
