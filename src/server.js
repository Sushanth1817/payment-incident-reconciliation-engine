require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./db");

const paymentsRouter = require("./routes/payments");
const webhookRoutes = require("./routes/webhooks");
const bankRoutes = require("./routes/bank");
const reconcileRoutes = require("./routes/reconcile");
const incidentRoutes = require("./routes/incidents");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

app.use("/payments", paymentsRouter);
app.use("/webhooks", webhookRoutes);
app.use("/bank", bankRoutes);
app.use("/reconcile", reconcileRoutes);
app.use("/incidents", incidentRoutes);
app.use("/dashboard", dashboardRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "payment-incident-engine"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});