const express = require("express");
const { randomUUID } = require("crypto");

const db = require("../db");

const router = express.Router();

router.post("/debit", (req, res) => {
  const { payment_id, amount } = req.body;

  if (!payment_id || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({
      error: "payment_id and a positive amount are required"
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

  const existingDebit = db
    .prepare(`
      SELECT *
      FROM bank_transactions
      WHERE payment_id = ?
        AND status = 'DEBITED'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(payment_id);

  if (existingDebit) {
    return res.status(409).json({
      error: "Bank debit already recorded for this payment",
      transaction: existingDebit
    });
  }

  if (amount !== payment.amount) {
    return res.status(400).json({
      error: "Bank debit amount must match payment amount"
    });
  }

  const transactionReference = `UTR_${randomUUID()}`;
  const now = new Date().toISOString();

  const result = db
    .prepare(`
      INSERT INTO bank_transactions (
        payment_id,
        amount,
        transaction_reference,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      payment_id,
      amount,
      transactionReference,
      "DEBITED",
      now
    );

  const bankTransaction = db
    .prepare(`
      SELECT *
      FROM bank_transactions
      WHERE id = ?
    `)
    .get(result.lastInsertRowid);

  res.status(201).json({
    message: "Bank debit simulated",
    transaction: bankTransaction
  });
});

module.exports = router;