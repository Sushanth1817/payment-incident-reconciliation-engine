const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/stats", (req, res) => {
  const totalPayments = db
    .prepare("SELECT COUNT(*) AS count FROM payments")
    .get().count;

  const successfulPayments = db
    .prepare("SELECT COUNT(*) AS count FROM payments WHERE status = 'SUCCESS'")
    .get().count;

  const failedPayments = db
    .prepare("SELECT COUNT(*) AS count FROM payments WHERE status = 'FAILED'")
    .get().count;

  const unknownPayments = db
    .prepare("SELECT COUNT(*) AS count FROM payments WHERE status = 'UNKNOWN'")
    .get().count;

  const resolvedIncidents = db
    .prepare("SELECT COUNT(*) AS count FROM incidents")
    .get().count;

  const totalTransactionValue = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments")
    .get().total;

  res.json({
    total_payments: totalPayments,
    successful_payments: successfulPayments,
    failed_payments: failedPayments,
    unknown_payments: unknownPayments,
    resolved_incidents: resolvedIncidents,
    total_transaction_value: totalTransactionValue
  });
});

module.exports = router;