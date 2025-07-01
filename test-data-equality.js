const axios = require("axios");
const crypto = require("crypto");

const SERVER_URL = process.env.TEST_URL || "http://localhost:3000";
const WEBHOOK_SECRET =
  process.env.PAY_WEBHOOK_SECRET || "test_secret_for_local_dev";

console.log("🧪 Testing Data Equality: PYR_ vs PYE_ transactions");
console.log(`🎯 Testing endpoint: ${SERVER_URL}`);

const createSignature = (payload) => {
  const bodyString = JSON.stringify(payload);
  const created = Math.floor(Date.now() / 1000);
  const digest = crypto.createHash("sha1").update(bodyString).digest("hex");
  const signatureInput = `fr1=("digest");created=${created}`;
  const signatureParams = signatureInput.replace("fr1=", "");
  const signatureBase = `"digest": "${digest}"\n@signature-params: ${signatureParams}`;
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(signatureBase)
    .digest("hex");

  return {
    "Content-Type": "application/json",
    digest: digest,
    "signature-input": signatureInput,
    signature: `fr1=:${signature}:`,
  };
};

const testPayin = async () => {
  console.log("\n🔵 Testing PAYIN (PYR_) - Отправитель с богатыми данными");

  const payload = {
    id: "evt_payin_test_" + Date.now(),
    event: "PAYMENT.STATUS_UPDATED",
    data: {
      id: "pmt_payin_test_" + Date.now(),
      from: {
        id: "pyr_test_rich_data_123",
        type: "PAYER",
        name: "Nikita Buzov",
        bankDetails: {
          country: "Lithuania",
          bankAddress: "Rua Sousa Pinto 1, Bloco B, 5 Frent E Direito",
          iban: "LT 4632 5000 6916 6901 65",
          bic: "REVOLT21XXX",
          bankName: "Banking Circle S.A.",
          accountHolderName: "Nikita Buzov Account",
        },
      },
      to: {
        id: "fac_opkx8g1je2vm7lz4m3",
        type: "PAY_ACCOUNT",
      },
      direction: "PAYIN",
      reference: "test payin transaction",
      amount: "150.00",
      currency: "EUR",
      paymentScheme: "SCT",
      status: "COMPLETED",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fromId: "pyr_test_rich_data_123",
      toId: "fac_opkx8g1je2vm7lz4m3",
    },
    createdAt: Date.now(),
  };

  try {
    const response = await axios.post(`${SERVER_URL}/webhook`, payload, {
      headers: createSignature(payload),
      timeout: 15000,
      validateStatus: (status) => status >= 200 && status < 500,
    });

    console.log("✅ PAYIN Response:", response.status);
    console.log("📋 Expected data to be extracted:");
    console.log("   - customer_id: pyr_test_rich_data_123");
    console.log("   - customer_name: Nikita Buzov");
    console.log("   - customer_country: Lithuania (from bankDetails.country)");
    console.log(
      "   - customer_address: Rua Sousa Pinto 1, Bloco B, 5 Frent E Direito"
    );
    console.log("   - iban: LT 4632 5000 6916 6901 65");
    console.log("   - payment_method: sepa_transfer");

    return response.status === 200;
  } catch (error) {
    console.error("❌ PAYIN test failed:", error.message);
    return false;
  }
};

const testPayout = async () => {
  console.log("\n🔴 Testing PAYOUT (PYE_) - Получатель с богатыми данными");

  const payload = {
    id: "evt_payout_test_" + Date.now(),
    event: "PAYMENT.STATUS_UPDATED",
    data: {
      id: "pmt_payout_test_" + Date.now(),
      from: {
        id: "fac_opkx8g1je2vm7lz4m3",
        type: "PAY_ACCOUNT",
      },
      to: {
        id: "pye_test_rich_data_456",
        type: "PAYEE",
        name: "Maria Garcia",
        bankDetails: {
          country: "Spain",
          bankAddress: "Calle Mayor 15, Madrid",
          iban: "ES91 2100 0418 4502 0005 1332",
          bic: "CAIXESBBXXX",
          bankName: "La Caixa Bank",
          accountHolderName: "Maria Garcia Account",
        },
      },
      direction: "PAYOUT",
      reference: "test payout transaction",
      amount: "150.00",
      currency: "EUR",
      paymentScheme: "SCT",
      status: "COMPLETED",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fromId: "fac_opkx8g1je2vm7lz4m3",
      toId: "pye_test_rich_data_456",
    },
    createdAt: Date.now(),
  };

  try {
    const response = await axios.post(`${SERVER_URL}/webhook`, payload, {
      headers: createSignature(payload),
      timeout: 15000,
      validateStatus: (status) => status >= 200 && status < 500,
    });

    console.log("✅ PAYOUT Response:", response.status);
    console.log("📋 Expected data to be extracted:");
    console.log("   - customer_id: pye_test_rich_data_456");
    console.log("   - customer_name: Maria Garcia");
    console.log("   - customer_country: Spain (from bankDetails.country)");
    console.log("   - customer_address: Calle Mayor 15, Madrid");
    console.log("   - iban: ES91 2100 0418 4502 0005 1332");
    console.log("   - payment_method: sepa_transfer");

    return response.status === 200;
  } catch (error) {
    console.error("❌ PAYOUT test failed:", error.message);
    return false;
  }
};

const testDataEquality = async () => {
  console.log("\n🔍 Testing Data Equality between PAYIN and PAYOUT");
  console.log("Goal: Both should have equal amount of data in Fraugster");

  const payinSuccess = await testPayin();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const payoutSuccess = await testPayout();

  console.log("\n📊 TEST RESULTS:");
  console.log(`🔵 PAYIN (PYR_): ${payinSuccess ? "✅ SUCCESS" : "❌ FAILED"}`);
  console.log(
    `🔴 PAYOUT (PYE_): ${payoutSuccess ? "✅ SUCCESS" : "❌ FAILED"}`
  );

  if (payinSuccess && payoutSuccess) {
    console.log("\n🎉 BOTH TESTS PASSED!");
    console.log(
      "✅ Check your logs to verify that both transactions have equal data richness"
    );
    console.log(
      "✅ Both should show: customer_id, name, country, address, IBAN, etc."
    );
  } else {
    console.log("\n⚠️  SOME TESTS FAILED!");
    console.log("Check server logs for detailed error information");
  }
};

const testMinimal = async () => {
  console.log("\n🔧 Testing Minimal Data (Edge Cases)");

  const minimalPayload = {
    id: "evt_minimal_" + Date.now(),
    event: "PAYMENT.STATUS_UPDATED",
    data: {
      id: "pmt_minimal_" + Date.now(),
      from: {
        id: "pyr_minimal_123",
        type: "PAYER",
      },
      to: {
        id: "fac_minimal_456",
        type: "PAY_ACCOUNT",
      },
      direction: "PAYIN",
      amount: "10.00",
      currency: "EUR",
      status: "COMPLETED",
      createdAt: Date.now(),
      fromId: "pyr_minimal_123",
      toId: "fac_minimal_456",
    },
    createdAt: Date.now(),
  };

  try {
    const response = await axios.post(`${SERVER_URL}/webhook`, minimalPayload, {
      headers: createSignature(minimalPayload),
      timeout: 15000,
      validateStatus: (status) => status >= 200 && status < 500,
    });

    console.log("✅ Minimal test:", response.status);
    console.log(
      "📋 Should use fallback data (placeholder email, minimal info)"
    );
    return response.status === 200;
  } catch (error) {
    console.error("❌ Minimal test failed:", error.message);
    return false;
  }
};

if (process.argv[2] === "minimal") {
  testMinimal();
} else if (process.argv[2] === "payin") {
  testPayin();
} else if (process.argv[2] === "payout") {
  testPayout();
} else {
  testDataEquality();
}
