const axios = require("axios");
const crypto = require("crypto");

// Тест с реальными данными из production логов
const testRealPayload = async () => {
  try {
    const SERVER_URL = process.env.TEST_URL || "http://localhost:3000";

    console.log(`🔍 Testing REAL production payload: ${SERVER_URL}`);

    // Реальный payload из логов (транзакция 3025 EUR)
    const payload = {
      id: "evt_test_real_" + Date.now(),
      event: "PAYMENT.STATUS_UPDATED",
      data: {
        id: "pmt_test_real_" + Date.now(),
        from: {
          id: "pyr_v8jkx67nxybg0dbgla", // ← Реальный ID отправителя!
          type: "PAYER",
          name: "Nikita Buzov", // ← Добавляю имя клиента!
          bankDetails: {
            country: "Lithuania", // ← Добавляю страну!
            bankAddress: "Rua Sousa Pinto 1, Bloco B, 5 Frent E Direito", // ← Адрес!
            iban: "LT 4632 5000 6916 6901 65", // ← IBAN!
            bic: "REVOLT21XXX", // ← BIC!
            bankName: "Banking Circle S.A. - German Branch",
          },
        },
        to: {
          id: "fac_opkx8g1je2vm7lz4m3",
          type: "PAY_ACCOUNT",
        },
        direction: "PAYIN",
        reference: "test shareholder funding",
        effectiveReference: "test shareholder funding",
        amount: "100.00", // Тестовая сумма
        currency: "EUR",
        paymentScheme: "SCT",
        status: "COMPLETED",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fromId: "pyr_v8jkx67nxybg0dbgla", // ← Ключевое поле!
        toId: "fac_opkx8g1je2vm7lz4m3",
      },
      createdAt: Date.now(),
    };

    console.log("🎯 Key test data:");
    console.log("- fromId (sender):", payload.data.fromId);
    console.log("- toId (receiver):", payload.data.toId);
    console.log("- Expected customer_id in Fraugster:", payload.data.fromId);

    const bodyString = JSON.stringify(payload);
    const webhookSecret =
      process.env.PAY_WEBHOOK_SECRET || "test_secret_for_local_dev";
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
    console.log("- customer_id should be: pyr_v8jkx67nxybg0dbgla (NOT empty)");
    console.log("- API call should be: GET /payers/pyr_v8jkx67nxybg0dbgla");
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

const testWebhook = async () => {
  try {
    // URL можно переключать через environment variable
    const SERVER_URL = process.env.TEST_URL || "http://localhost:3000";

    console.log(`🎯 Testing webhook endpoint: ${SERVER_URL}`);

    const payload = {
      id: "evt_" + Date.now(),
      event: "PAYMENT.CREATED",
      data: {
        id: "pmt_" + Date.now(),
        amount: 10000,
        currency: "EUR",
        status: "processing",
        createdAt: Date.now(),
        reference: "TEST-REF-001",
        payee: {
          id: "payee_123",
          name: "Jane Smith",
        },
        owner: {
          id: "owner_123",
        },
      },
      createdAt: Date.now(),
    };

    const bodyString = JSON.stringify(payload);
    const webhookSecret =
      process.env.PAY_WEBHOOK_SECRET || "test_secret_for_local_dev";
    const created = Math.floor(Date.now() / 1000);

    const digest = crypto.createHash("sha1").update(bodyString).digest("hex");
    const signatureInput = `fr1=("digest");created=${created}`;
    const signatureParams = signatureInput.replace("fr1=", "");
    const signatureBase = `"digest": "${digest}"\n@signature-params: ${signatureParams}`;
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signatureBase)
      .digest("hex");

    console.log("Generated signature details:", {
      digest,
      signatureInput,
      signatureParams,
      signatureBase,
      signature,
    });

    const response = await axios.post(`${SERVER_URL}/webhook`, payload, {
      headers: {
        "Content-Type": "application/json",
        digest: digest,
        "signature-input": signatureInput,
        signature: `fr1=:${signature}:`,
      },
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    });

    console.log("✅ Response:", response.data);
    console.log(`✅ Status: ${response.status}`);
  } catch (error) {
    console.error("❌ Full error:", error.message);
    if (error.response) {
      console.error("❌ Error response:", {
        status: error.response.status,
        data: error.response.data,
      });
    }
  }
};

// Тест с другими клиентами
const testDifferentCustomers = async () => {
  console.log("🧪 Testing with DIFFERENT customers...");

  // Тест 1: Maria Garcia из Испании
  await testCustomer({
    name: "Maria Garcia",
    id: "pyr_maria_test_123",
    country: "Spain",
    iban: "ES91 2100 0418 4502 0005 1332",
    address: "Calle Mayor 15, Madrid",
  });

  // Тест 2: John Smith из UK
  await testCustomer({
    name: "John Smith",
    id: "pyr_john_test_456",
    country: "United Kingdom",
    iban: "GB29 NWBK 6016 1331 9268 19",
    address: "10 Downing Street, London",
  });

  // Тест 3: Hans Mueller из Германии
  await testCustomer({
    name: "Hans Mueller",
    id: "pyr_hans_test_789",
    country: "Germany",
    iban: "DE89 3704 0044 0532 0130 00",
    address: "Hauptstraße 1, Berlin",
  });
};

const testCustomer = async (customer) => {
  try {
    const SERVER_URL = process.env.TEST_URL || "http://localhost:3000";

    console.log(
      `\n🎯 Testing customer: ${customer.name} from ${customer.country}`
    );

    const payload = {
      id: "evt_test_" + Date.now(),
      event: "PAYMENT.STATUS_UPDATED",
      data: {
        id: "pmt_test_" + Date.now(),
        from: {
          id: customer.id,
          type: "PAYER",
          name: customer.name,
          bankDetails: {
            country: customer.country,
            bankAddress: customer.address,
            iban: customer.iban,
            bic: "TESTBIC123",
            bankName: "Test Bank",
          },
        },
        to: {
          id: "fac_test_account",
          type: "PAY_ACCOUNT",
        },
        direction: "PAYIN",
        reference: "test payment",
        amount: "150.00",
        currency: "EUR",
        paymentScheme: "SCT",
        status: "COMPLETED",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fromId: customer.id,
        toId: "fac_test_account",
      },
      createdAt: Date.now(),
    };

    const bodyString = JSON.stringify(payload);
    const webhookSecret =
      process.env.PAY_WEBHOOK_SECRET || "test_secret_for_local_dev";
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
      timeout: 15000,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    });

    console.log(`✅ ${customer.name}: Status ${response.status}`);
    console.log(
      `   Expected data: Name="${customer.name}", Country="${customer.country}"`
    );
  } catch (error) {
    console.error(`❌ ${customer.name} test failed:`, error.message);
  }
};

// Выбор теста
if (process.argv[2] === "real") {
  console.log("🚀 Testing with REAL production payload structure...");
  testRealPayload();
} else if (process.argv[2] === "customers") {
  console.log("🚀 Testing with DIFFERENT customers...");
  testDifferentCustomers();
} else {
  console.log("🚀 Starting basic webhook test...");
  console.log("💡 Tip: Use TEST_URL=http://localhost:3000 for local testing");
  console.log("💡 Tip: Use 'node test-webhook.js real' for real payload test");
  console.log(
    "💡 Tip: Use 'node test-webhook.js customers' for different customers test"
  );
  testWebhook();
}
