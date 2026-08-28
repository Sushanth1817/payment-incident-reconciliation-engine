const validTransitions = {
  CREATED: ["PENDING"],
  PENDING: ["SUCCESS", "FAILED", "UNKNOWN"],
  UNKNOWN: ["SUCCESS"],
  SUCCESS: ["REFUND"],
  FAILED: [],
  REFUND: []
};

function isValidTransition(currentStatus, newStatus) {
  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

module.exports = {
  validTransitions,
  isValidTransition
};