const express = require("express");
const router = express.Router();

const db = require("../db");
const { isValidTransition } = require("../utils/paymentState");

router.post("/payment", (req, res) => {
  const {
    event_id,
    payment_id,
    event_type,
    status
  } = req.body;

  if (!event_id || !payment_id || !event_type || !status) {
    return res.status(400).json({
      error: "event_id, payment_id, event_type and status are required"
    });
  }

  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(payment_id);

  if (!payment) {
    return res.status(404).json({
      error: "Payment not found"
    });
  }

  const existingEvent = db
    .prepare("SELECT * FROM payment_events WHERE event_id = ?")
    .get(event_id);

  if (existingEvent) {
    return res.json({
      message: "Duplicate webhook",
      event: existingEvent
    });
  }

  if (!isValidTransition(payment.status, status)) {
    return res.status(400).json({
      error: `Invalid transition from ${payment.status} to ${status}`
    });
  }

  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO payment_events
      (payment_id, event_id, source, event_type, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      payment_id,
      event_id,
      "GATEWAY",
      event_type,
      status,
      now
    );

    db.prepare(`
      UPDATE payments
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      status,
      now,
      payment_id
    );
  });

  transaction();

  const updatedPayment = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(payment_id);

  res.json({
    message: "Webhook processed",
    payment: updatedPayment
  });
});

module.exports = router;