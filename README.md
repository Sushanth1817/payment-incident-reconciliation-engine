# AI-Powered Payment Incident & Reconciliation Engine

An intelligent payment reconciliation system that detects and resolves ambiguous payment transactions by correlating payment gateway events with bank transaction evidence.

The system combines a **deterministic reconciliation engine** for financial state changes with a **Gemini-powered AI Incident Analyst** for explaining incidents, identifying likely causes, summarizing evidence, and recommending actions.

---

## Problem

Digital payments involve multiple systems:

- Customer
- Merchant
- Payment Gateway
- Bank

Sometimes these systems disagree.

For example:

```text
Customer → Payment initiated
Gateway  → Timeout / UNKNOWN
Bank     → Customer DEBITED
Merchant → Unsure whether payment succeeded
```

The customer has lost money, but the merchant does not have a confirmed success response.

This can happen because of:

- Network failures
- Gateway timeouts
- Delayed webhooks
- Missing gateway events
- Temporary service failures

These situations often require manual investigation by finance or payment operations teams.

---

## Solution

The Payment Incident & Reconciliation Engine collects evidence from multiple payment sources and determines the correct payment state.

Example:

```text
Payment Gateway
      |
      | UNKNOWN
      v
Payment Engine
      |
      | correlates evidence
      v
Bank Transaction
      |
      | DEBITED
      v
Reconciliation Engine
      |
      | MATCH FOUND
      v
Payment → SUCCESS
Incident → RESOLVED
```

The complete resolution is recorded for auditing.

---

## AI Incident Analyst

The project also includes an AI-powered incident analyst using the **Google Gemini API**.

The AI analyzes:

- Current payment state
- Payment amount and currency
- Gateway events
- Bank transaction evidence
- Transaction reference information

It returns:

```text
Likely Cause
Confidence Score
Evidence Summary
Recommended Action
```

Example:

```text
Likely Cause:
The payment gateway timed out while the bank transaction
was successfully processed.

Confidence:
90%

Evidence:
Gateway reported UNKNOWN while the bank confirmed DEBITED.

Recommended Action:
Verify the transaction using the bank reference and inspect
gateway webhook delivery.
```

### AI Safety Design

The AI **does not change financial state**.

It is advisory only.

```text
Payment Evidence
      |
      +-------------------------+
      |                         |
      v                         v
Deterministic Engine       Gemini AI Analyst
      |                         |
      v                         v
State Resolution           Explanation
SUCCESS / FAILED           Confidence
UNKNOWN / REFUND           Recommendation
```

Only deterministic business rules are allowed to modify payment status.

This prevents an AI hallucination from directly changing financial records.

---

## Payment State Machine

The system controls payment transitions through a state machine.

```text
CREATED
   |
   v
PENDING
  / | \
 /  |  \
v   v   v
SUCCESS FAILED UNKNOWN
  |             |
  v             v
REFUND        SUCCESS
```

Examples of allowed transitions:

```text
CREATED → PENDING
PENDING → SUCCESS
PENDING → FAILED
PENDING → UNKNOWN
UNKNOWN → SUCCESS
SUCCESS → REFUND
```

Invalid transitions are rejected.

For example:

```text
FAILED → SUCCESS
PENDING → REFUND
```

---

## Main Reconciliation Scenario

The primary demo scenario is:

### 1. Create Payment

```text
CREATED
```

### 2. Begin Processing

```text
CREATED → PENDING
```

### 3. Simulate Gateway Timeout

The payment gateway cannot determine the final result.

```text
PENDING → UNKNOWN
```

### 4. Simulate Bank Debit

The bank confirms:

```text
DEBITED
```

### 5. Reconcile

The engine compares:

```text
Gateway Status = UNKNOWN
Bank Status    = DEBITED
Payment Amount = Bank Amount
```

The evidence matches.

Therefore:

```text
UNKNOWN → SUCCESS
```

### 6. Record Incident

An incident is stored with:

- Previous status
- Resolved status
- Bank evidence
- Transaction reference
- Resolution timestamp

### 7. AI Analysis

Gemini analyzes the incident and produces:

- Likely cause
- Confidence
- Evidence explanation
- Recommended action

---

## Features

### Payment Management

- Create payments
- Idempotent payment creation
- Payment state validation
- Payment details
- Payment history

### Gateway Event Processing

- Simulated gateway webhooks
- Duplicate event protection
- Gateway timeout simulation
- Payment event storage

### Bank Transaction Processing

- Bank debit simulation
- Amount validation
- Duplicate debit protection
- Unique transaction references

### Reconciliation Engine

- Gateway and bank evidence correlation
- Automatic UNKNOWN → SUCCESS resolution
- Incident creation
- Evidence storage

### AI Incident Analysis

- Google Gemini integration
- Likely-cause analysis
- Confidence scoring
- Evidence summarization
- Recommended next action
- Graceful fallback when AI is unavailable

### Dashboard

- Total payments
- Successful payments
- Failed payments
- Unknown payments
- Resolved incidents
- Total transaction value
- Real-time backend health indicator
- Automatic dashboard refresh

### Payment Timeline

The UI displays an audit timeline containing:

```text
Payment Created
      ↓
Status Updated
      ↓
Gateway Event
      ↓
Bank Transaction
      ↓
Incident Resolved
```

---

## Tech Stack

### Backend

- Node.js
- Express.js
- SQLite
- better-sqlite3
- REST APIs

### Frontend

- React
- Vite
- CSS

### AI

- Google Gemini API

### Testing

- Node.js built-in test runner
- API integration tests

---

## Project Architecture

```text
                 React Dashboard
                       |
                       | REST API
                       v
                 Express Backend
                       |
          +------------+-------------+
          |            |             |
          v            v             v
      Payments      Gateway        Bank
       Service       Events     Transactions
          |            |             |
          +------------+-------------+
                       |
                       v
              Reconciliation Engine
                       |
              +--------+--------+
              |                 |
              v                 v
        Payment State        Incidents
              |
              v
           SQLite

Payment + Gateway + Bank Evidence
              |
              v
      Gemini AI Incident Analyst
              |
              v
    Cause / Confidence / Evidence
       / Recommended Action
```

---

## API Endpoints

### Health

```http
GET /health
```

### Payments

```http
POST /payments
GET /payments
GET /payments/:id
GET /payments/:id/timeline
POST /payments/:id/status
```

### Gateway Webhooks

```http
POST /webhooks/payment
```

### Bank

```http
POST /bank/debit
```

### Reconciliation

```http
POST /reconcile/:paymentId
```

### Incidents

```http
GET /incidents
```

### Dashboard

```http
GET /dashboard/stats
```

### AI Incident Analyst

```http
POST /ai/analyze/:paymentId
```

---

## Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/Sushanth1817/payment-incident-reconciliation-engine.git
```

```bash
cd payment-incident-reconciliation-engine
```

### 2. Install backend dependencies

```bash
npm install
```

### 3. Configure environment variables

Create:

```text
.env
```

Add:

```env
PORT=5050
GEMINI_API_KEY=your_gemini_api_key
```

Never commit the `.env` file.

### 4. Start Backend

```bash
npm start
```

Backend:

```text
http://localhost:5050
```

Health check:

```text
GET http://localhost:5050/health
```

### 5. Install Frontend

```bash
cd frontend
npm install
```

Create:

```text
frontend/.env
```

Add:

```env
VITE_API_URL=http://localhost:5050
```

### 6. Start Frontend

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## Running Tests

From the project root:

```bash
npm test
```

Current automated test coverage includes:

- CREATED → PENDING
- PENDING → SUCCESS
- PENDING → UNKNOWN
- UNKNOWN → SUCCESS
- Invalid FAILED → SUCCESS
- Invalid PENDING → REFUND
- UNKNOWN + bank debit reconciliation
- UNKNOWN without bank debit
- Duplicate bank debit rejection

Current result:

```text
9 tests
9 passed
0 failed
```

---

## Security

Secrets are stored using environment variables.

The following files are excluded from Git:

```text
.env
frontend/.env
node_modules/
frontend/node_modules/
data/*.db
frontend/dist/
```

API keys must never be committed to the repository.

---

## Why This Matters

Payment reconciliation is important for:

- Payment gateways
- Banks
- FinTech platforms
- E-commerce systems
- Finance operations teams

Incorrect payment states can result in:

- Customer complaints
- Duplicate payments
- Incorrect refunds
- Manual investigation
- Financial reconciliation errors

This system demonstrates how payment evidence can be automatically correlated while AI assists finance teams in understanding incidents.

---

## Future Improvements

Potential production extensions include:

- PostgreSQL
- Redis
- Background reconciliation workers
- Razorpay test-mode integration
- Real bank/gateway adapters
- Open incident lifecycle management
- Authentication and role-based access
- AI anomaly detection
- Incident prioritization
- Metrics and observability
- Docker deployment

---

## Hackathon Track

**AI Finance Controller**

The project demonstrates an AI-assisted finance operations system where deterministic financial controls handle payment resolution while AI assists with investigation and decision support.

---

## Author

**Sushanth Padamata**

Computer Science & Engineering

