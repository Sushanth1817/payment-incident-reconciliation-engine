const express = require("express");
const { randomUUID } = require("crypto");
const db = require("../db");
const { isValidTransition } = require("../utils/paymentState");

const router = express.Router();

router.post("/", (req, res) => {
  const { amount, currency, customer, idempotency_key } = req.body;

  if (
    typeof amount !== "number" ||
    amount <= 0 ||
    !Number.isInteger(amount)
  ) {
    return res.status(400).json({
      error: "amount must be a positive integer"
    });
  }

  if (
    typeof currency !== "string" ||
    currency.trim() === ""
  ) {
    return res.status(400).json({
      error: "currency is required"
    });
  }

  if (
    typeof customer !== "string" ||
    customer.trim() === ""
  ) {
    return res.status(400).json({
      error: "customer is required"
    });
  }

  if (
    typeof idempotency_key !== "string" ||
    idempotency_key.trim() === ""
  ) {
    return res.status(400).json({
      error: "idempotency_key is required"
    });
  }

  const existingPayment = db
    .prepare("SELECT * FROM payments WHERE idempotency_key = ?")
    .get(idempotency_key);

  if (existingPayment) {
    return res.status(200).json({
      message: "Duplicate request",
      payment: existingPayment
    });
  }

  const paymentId = `pay_${randomUUID()}`;
  const orderId = `order_${randomUUID()}`;
  const now = new Date().toISOString();

  const insertPayment = db.prepare(`
    INSERT INTO payments (
      id,
      order_id,
      amount,
      currency,
      customer,
      status,
      idempotency_key,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPayment.run(
    paymentId,
    orderId,
    amount,
    currency,
    customer,
    "CREATED",
    idempotency_key,
    now,
    now
  );

  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(paymentId);

  res.status(201).json({
    message: "Payment created",
    payment
  });
});

router.post("/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(id);

  if (!payment) {
    return res.status(404).json({
      error: "Payment not found"
    });
  }

  if (!status) {
    return res.status(400).json({
      error: "status is required"
    });
  }

  if (!isValidTransition(payment.status, status)) {
    return res.status(400).json({
      error: `Invalid transition from ${payment.status} to ${status}`
    });
  }

  const now = new Date().toISOString();
  const eventId = `evt_manual_${randomUUID()}`;

  const updatePaymentStatus = db.transaction(() => {
    db.prepare(`
      UPDATE payments
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(status, now, id);

    db.prepare(`
      INSERT INTO payment_events (
        payment_id,
        event_id,
        source,
        event_type,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      eventId,
      "SYSTEM",
      "status.updated",
      status,
      now
    );
  });

  updatePaymentStatus();

  const updatedPayment = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(id);

  res.json({
    message: "Payment status updated",
    payment: updatedPayment
  });
});

router.get("/", (req, res) => {
  const payments = db
    .prepare(`
      SELECT *
      FROM payments
      ORDER BY created_at DESC
    `)
    .all();

  res.json({
    count: payments.length,
    payments
  });
});

router.get("/:id", (req, res) => {
  const { id } = req.params;

  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(id);

  if (!payment) {
    return res.status(404).json({
      error: "Payment not found"
    });
  }

  res.json({
    payment
  });
});

router.get("/:id/timeline", (req, res) => {
  const { id } = req.params;

  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(id);

  if (!payment) {
    return res.status(404).json({
      error: "Payment not found"
    });
  }

  const events = db
    .prepare(`
      SELECT *
      FROM payment_events
      WHERE payment_id = ?
      ORDER BY created_at ASC
    `)
    .all(id);

  const bankTransactions = db
    .prepare(`
      SELECT *
      FROM bank_transactions
      WHERE payment_id = ?
      ORDER BY created_at ASC
    `)
    .all(id);

  const incidents = db
    .prepare(`
      SELECT *
      FROM incidents
      WHERE payment_id = ?
      ORDER BY created_at ASC
    `)
    .all(id);

  const timeline = [
    {
      type: "PAYMENT_CREATED",
      status: "CREATED",
      created_at: payment.created_at
    },

    ...events.map((event) => ({
      type:
        event.source === "SYSTEM"
          ? "STATUS_UPDATE"
          : "GATEWAY_EVENT",

      source: event.source,
      event_type: event.event_type,
      status: event.status,
      created_at: event.created_at
    })),

    ...bankTransactions.map((transaction) => ({
      type: "BANK_TRANSACTION",
      transaction_reference: transaction.transaction_reference,
      amount: transaction.amount,
      status: transaction.status,
      created_at: transaction.created_at
    })),

    ...incidents.map((incident) => ({
      type: "INCIDENT_RESOLVED",
      incident_type: incident.type,
      previous_status: incident.previous_status,
      resolved_status: incident.resolved_status,
      created_at: incident.created_at
    }))
  ];

  timeline.sort(
    (a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
  );

  res.json({
    payment_id: id,
    final_status: payment.status,
    timeline
  });
});

module.exports = router;