const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const incidents = db
    .prepare(`
      SELECT *
      FROM incidents
      ORDER BY created_at DESC
    `)
    .all();

  const parsedIncidents = incidents.map((incident) => ({
    ...incident,
    evidence: JSON.parse(incident.evidence)
  }));

  res.json({
    count: parsedIncidents.length,
    incidents: parsedIncidents
  });
});

module.exports = router;