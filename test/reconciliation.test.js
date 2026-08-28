const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

process.env.DB_PATH = "data/test_payment_engine.db";

const db = require("../src/db");
const app = require("../src/app");

const schema = fs.readFileSync(
  "./src/schema.sql",
  "utf8"
);

db.exec(schema);

function clearTestDatabase() {
  db.exec(`
    DELETE FROM incidents;
    DELETE FROM bank_transactions;
    DELETE FROM payment_events;
    DELETE FROM payments;
  `);
}

async function startTestServer() {
  const server = app.listen(0);

  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  const address = server.address();

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function createUnknownPayment(baseUrl, keySuffix) {
  const createResponse = await fetch(
    `${baseUrl}/payments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: 2000,
        currency: "INR",
        customer: "Integration Test",
        idempotency_key: `integration_test_${keySuffix}`
      })
    }
  );

  assert.equal(createResponse.status, 201);

  const createData = await createResponse.json();

  const paymentId = createData.payment.id;

  const pendingResponse = await fetch(
    `${baseUrl}/payments/${paymentId}/status`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "PENDING"
      })
    }
  );

  assert.equal(pendingResponse.status, 200);

  const unknownResponse = await fetch(
    `${baseUrl}/webhooks/payment`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payment_id: paymentId,
        event_id: `integration_event_${keySuffix}`,
        event_type: "payment.timeout",
        status: "UNKNOWN"
      })
    }
  );

  assert.equal(unknownResponse.status, 200);

  return paymentId;
}

test("real API reconciles UNKNOWN payment with bank debit to SUCCESS", async () => {
  clearTestDatabase();

  const { server, baseUrl } =
    await startTestServer();

  try {
    const paymentId =
      await createUnknownPayment(
        baseUrl,
        "success_001"
      );

    const debitResponse = await fetch(
      `${baseUrl}/bank/debit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          payment_id: paymentId,
          amount: 2000
        })
      }
    );

    assert.equal(debitResponse.status, 201);

    const reconcileResponse = await fetch(
      `${baseUrl}/reconcile/${paymentId}`,
      {
        method: "POST"
      }
    );

    assert.equal(reconcileResponse.status, 200);

    const reconcileData =
      await reconcileResponse.json();

    assert.equal(
      reconcileData.reconciled,
      true
    );

    assert.equal(
      reconcileData.payment.status,
      "SUCCESS"
    );

    const paymentResponse = await fetch(
      `${baseUrl}/payments/${paymentId}`
    );

    const paymentData =
      await paymentResponse.json();

    assert.equal(
      paymentData.payment.status,
      "SUCCESS"
    );

    const incidentsResponse =
      await fetch(`${baseUrl}/incidents`);

    const incidentsData =
      await incidentsResponse.json();

    assert.equal(
      incidentsData.count,
      1
    );

    assert.equal(
      incidentsData.incidents[0].previous_status,
      "UNKNOWN"
    );

    assert.equal(
      incidentsData.incidents[0].resolved_status,
      "SUCCESS"
    );
  } finally {
    server.close();
  }
});

test("real API does not reconcile UNKNOWN payment without bank debit", async () => {
  clearTestDatabase();

  const { server, baseUrl } =
    await startTestServer();

  try {
    const paymentId =
      await createUnknownPayment(
        baseUrl,
        "no_debit_001"
      );

    const reconcileResponse = await fetch(
      `${baseUrl}/reconcile/${paymentId}`,
      {
        method: "POST"
      }
    );

    assert.equal(reconcileResponse.status, 200);

    const reconcileData =
      await reconcileResponse.json();

    assert.equal(
      reconcileData.reconciled,
      false
    );

    const paymentResponse = await fetch(
      `${baseUrl}/payments/${paymentId}`
    );

    const paymentData =
      await paymentResponse.json();

    assert.equal(
      paymentData.payment.status,
      "UNKNOWN"
    );

    const incidentsResponse =
      await fetch(`${baseUrl}/incidents`);

    const incidentsData =
      await incidentsResponse.json();

    assert.equal(
      incidentsData.count,
      0
    );
  } finally {
    server.close();
  }
});

test("real API rejects duplicate bank debit for the same payment", async () => {
  clearTestDatabase();

  const { server, baseUrl } =
    await startTestServer();

  try {
    const paymentId =
      await createUnknownPayment(
        baseUrl,
        "duplicate_debit_001"
      );

    const firstDebitResponse = await fetch(
      `${baseUrl}/bank/debit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          payment_id: paymentId,
          amount: 2000
        })
      }
    );

    assert.equal(
      firstDebitResponse.status,
      201
    );

    const secondDebitResponse = await fetch(
      `${baseUrl}/bank/debit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          payment_id: paymentId,
          amount: 2000
        })
      }
    );

    assert.equal(
      secondDebitResponse.status,
      409
    );

    const secondDebitData =
      await secondDebitResponse.json();

    assert.equal(
      secondDebitData.error,
      "Bank debit already recorded for this payment"
    );

    const debitCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM bank_transactions
      WHERE payment_id = ?
        AND status = 'DEBITED'
    `).get(paymentId);

    assert.equal(
      debitCount.count,
      1
    );
  } finally {
    server.close();
  }
});