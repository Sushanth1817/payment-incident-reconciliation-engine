const express = require("express");

const db = require("../db");
const {
  analyzeIncident
} = require("../services/aiIncidentAnalyst");

const router = express.Router();

router.post("/analyze/:paymentId", async (req, res) => {
  const { paymentId } = req.params;

  const payment = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(paymentId);

  if (!payment) {
    return res.status(404).json({
      error: "Payment not found"
    });
  }

  const bankTransaction = db
    .prepare(`
      SELECT *
      FROM bank_transactions
      WHERE payment_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(paymentId);

  const gatewayEvents = db
    .prepare(`
      SELECT *
      FROM payment_events
      WHERE payment_id = ?
        AND source != 'SYSTEM'
      ORDER BY created_at ASC
    `)
    .all(paymentId);

  const analysis = await analyzeIncident({
    payment,
    bankTransaction,
    gatewayEvents
  });

  res.json({
    payment_id: paymentId,
    payment_status: payment.status,
    analysis
  });
});

module.exports = router;