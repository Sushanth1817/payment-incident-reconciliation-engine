import { useEffect, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

function App() {
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [creatingPayment, setCreatingPayment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [simulatingTimeout, setSimulatingTimeout] = useState(false);
  const [simulatingDebit, setSimulatingDebit] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const [systemOnline, setSystemOnline] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    customer: "",
    amount: "",
    currency: "INR",
    idempotency_key: ""
  });

  const hasBankDebit = timeline.some(
    (item) =>
      item.type === "BANK_TRANSACTION" &&
      item.status === "DEBITED"
  );

  async function checkSystemHealth() {
    try {
      const response = await fetch(`${API_URL}/health`);

      if (!response.ok) {
        setSystemOnline(false);
        return;
      }

      const data = await response.json();

      setSystemOnline(data.status === "ok");
    } catch {
      setSystemOnline(false);
    }
  }

  async function loadDashboard(showError = false) {
    try {
      const [
        statsResponse,
        paymentsResponse,
        incidentsResponse
      ] = await Promise.all([
        fetch(`${API_URL}/dashboard/stats`),
        fetch(`${API_URL}/payments`),
        fetch(`${API_URL}/incidents`)
      ]);

      if (
        !statsResponse.ok ||
        !paymentsResponse.ok ||
        !incidentsResponse.ok
      ) {
        throw new Error("Failed to fetch dashboard data");
      }

      const statsData = await statsResponse.json();
      const paymentsData = await paymentsResponse.json();
      const incidentsData = await incidentsResponse.json();

      setStats(statsData);
      setPayments(paymentsData.payments);
      setIncidents(incidentsData.incidents);

      if (showError) {
        setError("");
      }
    } catch (err) {
      if (showError) {
        setError(err.message);
      }
    }
  }

  useEffect(() => {
    loadDashboard(true);
    checkSystemHealth();

    const healthInterval = setInterval(() => {
      checkSystemHealth();
    }, 5000);

    const dashboardInterval = setInterval(() => {
      loadDashboard(false);
    }, 5000);

    return () => {
      clearInterval(healthInterval);
      clearInterval(dashboardInterval);
    };
  }, []);

  function getStatusClass(status) {
    return `status status-${status.toLowerCase()}`;
  }

  function handleInputChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value
    }));
  }

  async function createPayment(event) {
    event.preventDefault();

    if (
      !formData.customer.trim() ||
      !formData.amount ||
      !formData.currency.trim() ||
      !formData.idempotency_key.trim()
    ) {
      alert("Please fill all fields");
      return;
    }

    const amount = Number(formData.amount);

    if (!Number.isInteger(amount) || amount <= 0) {
      alert("Amount must be a positive whole number");
      return;
    }

    setCreatingPayment(true);

    try {
      const response = await fetch(`${API_URL}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customer: formData.customer.trim(),
          amount,
          currency: formData.currency.trim().toUpperCase(),
          idempotency_key: formData.idempotency_key.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment");
      }

      setFormData({
        customer: "",
        amount: "",
        currency: "INR",
        idempotency_key: ""
      });

      await loadDashboard();

      if (data.payment) {
        setSelectedPayment(data.payment);
        await loadTimeline(data.payment.id);
      }

      alert(data.message || "Payment created successfully");
    } catch (err) {
      alert(err.message);
    } finally {
      setCreatingPayment(false);
    }
  }

  async function loadTimeline(paymentId) {
    setTimeline([]);
    setTimelineLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/payments/${paymentId}/timeline`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch payment timeline");
      }

      const data = await response.json();

      setTimeline(data.timeline);
    } catch (err) {
      setError(err.message);
    } finally {
      setTimelineLoading(false);
    }
  }

  async function selectPayment(payment) {
    setSelectedPayment(payment);
    await loadTimeline(payment.id);
  }

  function closePayment() {
    setSelectedPayment(null);
    setTimeline([]);
  }

  async function markPending() {
    if (!selectedPayment) {
      return;
    }

    setUpdatingStatus(true);

    try {
      const response = await fetch(
        `${API_URL}/payments/${selectedPayment.id}/status`,
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update payment");
      }

      setSelectedPayment(data.payment);

      await loadDashboard();
      await loadTimeline(data.payment.id);

      alert("Payment moved to PENDING");
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function simulateGatewayTimeout() {
    if (!selectedPayment) {
      return;
    }

    setSimulatingTimeout(true);

    try {
      const eventId = `evt_timeout_${Date.now()}`;

      const response = await fetch(
        `${API_URL}/webhooks/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            event_id: eventId,
            payment_id: selectedPayment.id,
            event_type: "payment.timeout",
            status: "UNKNOWN"
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to simulate gateway timeout"
        );
      }

      setSelectedPayment(data.payment);

      await loadDashboard();
      await loadTimeline(data.payment.id);

      alert("Gateway timeout simulated. Payment is now UNKNOWN.");
    } catch (err) {
      alert(err.message);
    } finally {
      setSimulatingTimeout(false);
    }
  }

  async function simulateBankDebit() {
    if (!selectedPayment || hasBankDebit) {
      return;
    }

    setSimulatingDebit(true);

    try {
      const response = await fetch(
        `${API_URL}/bank/debit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            payment_id: selectedPayment.id,
            amount: selectedPayment.amount
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to simulate bank debit"
        );
      }

      await loadTimeline(selectedPayment.id);

      alert(
        `Bank debit simulated successfully.\nReference: ${data.transaction.transaction_reference}`
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setSimulatingDebit(false);
    }
  }

  async function reconcilePayment() {
    if (!selectedPayment || !hasBankDebit) {
      return;
    }

    setReconciling(true);

    try {
      const response = await fetch(
        `${API_URL}/reconcile/${selectedPayment.id}`,
        {
          method: "POST"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Reconciliation failed");
      }

      if (!data.reconciled) {
        alert(data.message);
        return;
      }

      setSelectedPayment(data.payment);

      await loadDashboard();
      await loadTimeline(data.payment.id);

      alert("Payment reconciled successfully");
    } catch (err) {
      alert(err.message);
    } finally {
      setReconciling(false);
    }
  }

  function getTimelineTitle(item) {
    if (item.type === "PAYMENT_CREATED") {
      return "Payment Created";
    }

    if (item.type === "STATUS_UPDATE") {
      return "Status Updated";
    }

    if (item.type === "GATEWAY_EVENT") {
      return "Gateway Event";
    }

    if (item.type === "BANK_TRANSACTION") {
      return "Bank Transaction";
    }

    if (item.type === "INCIDENT_RESOLVED") {
      return "Incident Resolved";
    }

    return item.type;
  }

  function getTimelineDescription(item) {
    if (item.type === "PAYMENT_CREATED") {
      return "Payment entered the system.";
    }

    if (item.type === "STATUS_UPDATE") {
      return `Manual status update → ${item.status}`;
    }

    if (item.type === "GATEWAY_EVENT") {
      return `${item.event_type} → ${item.status}`;
    }

    if (item.type === "BANK_TRANSACTION") {
      return `${item.transaction_reference} • INR ${item.amount} • ${item.status}`;
    }

    if (item.type === "INCIDENT_RESOLVED") {
      return `${item.previous_status} → ${item.resolved_status}`;
    }

    return "";
  }

  if (error) {
    return <div className="message">{error}</div>;
  }

  if (!stats) {
    return <div className="message">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <div className="header">
        <div>
          <h1>Payment Incident & Reconciliation Engine</h1>
          <p>Real-time payment monitoring and incident resolution</p>
        </div>

        <div
          className={`system-status ${
            systemOnline ? "system-online" : "system-offline"
          }`}
        >
          <span className="status-dot"></span>
          {systemOnline ? "System Online" : "System Offline"}
        </div>
      </div>

      <div className="create-payment-section">
        <h2>Create Payment</h2>

        <form className="create-payment-form" onSubmit={createPayment}>
          <div className="form-group">
            <label>Customer</label>
            <input
              type="text"
              name="customer"
              value={formData.customer}
              onChange={handleInputChange}
              placeholder="Enter customer name"
            />
          </div>

          <div className="form-group">
            <label>Amount</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              placeholder="Enter amount"
              min="1"
            />
          </div>

          <div className="form-group">
            <label>Currency</label>
            <input
              type="text"
              name="currency"
              value={formData.currency}
              onChange={handleInputChange}
              placeholder="INR"
            />
          </div>

          <div className="form-group">
            <label>Idempotency Key</label>
            <input
              type="text"
              name="idempotency_key"
              value={formData.idempotency_key}
              onChange={handleInputChange}
              placeholder="example_payment_001"
            />
          </div>

          <div className="form-button-container">
            <button
              className="create-payment-button"
              type="submit"
              disabled={creatingPayment}
            >
              {creatingPayment ? "Creating..." : "Create Payment"}
            </button>
          </div>
        </form>
      </div>

      <h2>Overview</h2>

      <div className="stats-grid">
        <div className="card">
          <p>Total Payments</p>
          <h3>{stats.total_payments}</h3>
        </div>

        <div className="card">
          <p>Successful</p>
          <h3>{stats.successful_payments}</h3>
        </div>

        <div className="card">
          <p>Failed</p>
          <h3>{stats.failed_payments}</h3>
        </div>

        <div className="card">
          <p>Unknown</p>
          <h3>{stats.unknown_payments}</h3>
        </div>

        <div className="card">
          <p>Resolved Incidents</p>
          <h3>{stats.resolved_incidents}</h3>
        </div>

        <div className="card">
          <p>Transaction Value</p>
          <h3>₹{stats.total_transaction_value}</h3>
        </div>
      </div>

      <div className="payments-section">
        <h2>Recent Payments</h2>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>

            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="payment-row"
                  onClick={() => selectPayment(payment)}
                >
                  <td className="order-id">{payment.order_id}</td>
                  <td>{payment.customer}</td>

                  <td>
                    {payment.currency} {payment.amount}
                  </td>

                  <td>
                    <span className={getStatusClass(payment.status)}>
                      {payment.status}
                    </span>
                  </td>

                  <td>
                    {new Date(payment.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="incidents-section">
        <h2>Resolved Incidents</h2>

        {incidents.length === 0 ? (
          <div className="empty-card">No incidents found.</div>
        ) : (
          <div className="incident-list">
            {incidents.map((incident) => (
              <div className="incident-card" key={incident.id}>
                <div>
                  <p className="incident-label">Incident Type</p>
                  <strong>{incident.type}</strong>
                </div>

                <div>
                  <p className="incident-label">Payment ID</p>
                  <strong className="incident-payment-id">
                    {incident.payment_id}
                  </strong>
                </div>

                <div>
                  <p className="incident-label">Resolution</p>

                  <div className="incident-resolution">
                    <span
                      className={getStatusClass(
                        incident.previous_status
                      )}
                    >
                      {incident.previous_status}
                    </span>

                    <span>→</span>

                    <span
                      className={getStatusClass(
                        incident.resolved_status
                      )}
                    >
                      {incident.resolved_status}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="incident-label">Evidence</p>

                  <strong>
                    Bank {incident.evidence.bank_status} • INR{" "}
                    {incident.evidence.bank_amount}
                  </strong>
                </div>

                <div>
                  <p className="incident-label">Resolved At</p>

                  <strong>
                    {new Date(
                      incident.created_at
                    ).toLocaleString()}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPayment && (
        <div className="payment-details">
          <div className="details-header">
            <h2>Payment Details</h2>
            <button onClick={closePayment}>Close</button>
          </div>

          <div className="details-grid">
            <div>
              <p>Payment ID</p>
              <strong>{selectedPayment.id}</strong>
            </div>

            <div>
              <p>Order ID</p>
              <strong>{selectedPayment.order_id}</strong>
            </div>

            <div>
              <p>Customer</p>
              <strong>{selectedPayment.customer}</strong>
            </div>

            <div>
              <p>Amount</p>
              <strong>
                {selectedPayment.currency}{" "}
                {selectedPayment.amount}
              </strong>
            </div>

            <div>
              <p>Status</p>
              <span
                className={getStatusClass(selectedPayment.status)}
              >
                {selectedPayment.status}
              </span>
            </div>

            <div>
              <p>Created At</p>
              <strong>
                {new Date(
                  selectedPayment.created_at
                ).toLocaleString()}
              </strong>
            </div>

            <div>
              <p>Updated At</p>
              <strong>
                {new Date(
                  selectedPayment.updated_at
                ).toLocaleString()}
              </strong>
            </div>
          </div>

          {selectedPayment.status === "CREATED" && (
            <div className="reconcile-section">
              <button
                className="create-payment-button"
                onClick={markPending}
                disabled={updatingStatus}
              >
                {updatingStatus
                  ? "Updating..."
                  : "Mark Pending"}
              </button>
            </div>
          )}

          {selectedPayment.status === "PENDING" && (
            <div className="reconcile-section">
              <button
                className="create-payment-button"
                onClick={simulateGatewayTimeout}
                disabled={simulatingTimeout}
              >
                {simulatingTimeout
                  ? "Simulating..."
                  : "Simulate Gateway Timeout"}
              </button>
            </div>
          )}

          {selectedPayment.status === "UNKNOWN" && (
            <div className="payment-actions">
              <button
                className="bank-debit-button"
                onClick={simulateBankDebit}
                disabled={simulatingDebit || hasBankDebit}
              >
                {simulatingDebit
                  ? "Simulating Debit..."
                  : hasBankDebit
                  ? "Bank Debit Recorded"
                  : "Simulate Bank Debit"}
              </button>

              <button
                className="reconcile-button"
                onClick={reconcilePayment}
                disabled={reconciling || !hasBankDebit}
              >
                {reconciling
                  ? "Reconciling..."
                  : hasBankDebit
                  ? "Reconcile Payment"
                  : "Waiting for Bank Debit"}
              </button>
            </div>
          )}

          <div className="timeline-section">
            <h2>Payment Timeline</h2>

            {timelineLoading && <p>Loading timeline...</p>}

            {!timelineLoading && timeline.length === 0 && (
              <p>No timeline events found.</p>
            )}

            {!timelineLoading && timeline.length > 0 && (
              <div className="timeline">
                {timeline.map((item, index) => (
                  <div
                    className="timeline-item"
                    key={`${item.type}-${item.created_at}-${index}`}
                  >
                    <div className="timeline-marker">
                      <span></span>
                    </div>

                    <div className="timeline-content">
                      <div className="timeline-top">
                        <strong>{getTimelineTitle(item)}</strong>

                        {item.status && (
                          <span
                            className={getStatusClass(item.status)}
                          >
                            {item.status}
                          </span>
                        )}

                        {item.resolved_status && (
                          <span
                            className={getStatusClass(
                              item.resolved_status
                            )}
                          >
                            {item.resolved_status}
                          </span>
                        )}
                      </div>

                      <p>{getTimelineDescription(item)}</p>

                      <small>
                        {new Date(
                          item.created_at
                        ).toLocaleString()}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;