const express = require("express");

const db = require("../db");

const router = express.Router();

router.post("/:paymentId", (req, res) => {
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
        AND status = 'DEBITED'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(paymentId);

  if (!bankTransaction) {
    return res.status(200).json({
      message: "No matching bank debit found",
      reconciled: false,
      payment
    });
  }

  const amountMatches = bankTransaction.amount === payment.amount;

  if (payment.status !== "UNKNOWN" || !amountMatches) {
    return res.status(200).json({
      message: "Payment could not be automatically reconciled",
      reconciled: false,
      evidence: {
        payment_status: payment.status,
        payment_amount: payment.amount,
        bank_status: bankTransaction.status,
        bank_amount: bankTransaction.amount,
        amount_matches: amountMatches
      }
    });
  }

  const now = new Date().toISOString();

  const evidence = JSON.stringify({
    payment_status: payment.status,
    payment_amount: payment.amount,
    bank_transaction_id: bankTransaction.id,
    bank_status: bankTransaction.status,
    bank_amount: bankTransaction.amount,
    transaction_reference: bankTransaction.transaction_reference,
    amount_matches: amountMatches
  });

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE payments
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      "SUCCESS",
      now,
      paymentId
    );

    db.prepare(`
      INSERT INTO incidents (
        payment_id,
        type,
        previous_status,
        resolved_status,
        evidence,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      paymentId,
      "DEBIT_WITHOUT_CONFIRMED_SUCCESS",
      "UNKNOWN",
      "SUCCESS",
      evidence,
      now
    );
  });

  transaction();

  const updatedPayment = db
    .prepare("SELECT * FROM payments WHERE id = ?")
    .get(paymentId);

  res.json({
    message: "Payment reconciled successfully",
    reconciled: true,
    previous_status: "UNKNOWN",
    resolved_status: "SUCCESS",
    payment: updatedPayment,
    evidence: JSON.parse(evidence)
  });
});

module.exports = router;