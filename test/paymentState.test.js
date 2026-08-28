const test = require("node:test");
const assert = require("node:assert");

const {
  isValidTransition
} = require("../src/utils/paymentState");

test("CREATED can move to PENDING", () => {
  assert.strictEqual(
    isValidTransition("CREATED", "PENDING"),
    true
  );
});

test("PENDING can move to SUCCESS", () => {
  assert.strictEqual(
    isValidTransition("PENDING", "SUCCESS"),
    true
  );
});

test("PENDING can move to UNKNOWN", () => {
  assert.strictEqual(
    isValidTransition("PENDING", "UNKNOWN"),
    true
  );
});

test("UNKNOWN can move to SUCCESS", () => {
  assert.strictEqual(
    isValidTransition("UNKNOWN", "SUCCESS"),
    true
  );
});

test("FAILED cannot move to SUCCESS", () => {
  assert.strictEqual(
    isValidTransition("FAILED", "SUCCESS"),
    false
  );
});

test("PENDING cannot move directly to REFUND", () => {
  assert.strictEqual(
    isValidTransition("PENDING", "REFUND"),
    false
  );
});