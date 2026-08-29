async function analyzeIncident({
  payment,
  bankTransaction,
  gatewayEvents
}) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      ai_used: false,
      likely_cause: "AI analysis unavailable",
      confidence: 0,
      evidence_summary:
        "GEMINI_API_KEY is not configured.",
      recommended_action:
        "Review the payment timeline manually."
    };
  }

  const incidentData = {
    payment: {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status
    },
    bank_transaction: bankTransaction
      ? {
          amount: bankTransaction.amount,
          status: bankTransaction.status,
          transaction_reference:
            bankTransaction.transaction_reference
        }
      : null,
    gateway_events: gatewayEvents.map((event) => ({
      event_type: event.event_type,
      status: event.status,
      source: event.source,
      created_at: event.created_at
    }))
  };

  const prompt = `
You are an AI payment incident analyst for a finance operations team.

Analyze the payment incident below.

Return ONLY valid JSON in this exact structure:

{
  "likely_cause": "short explanation",
  "confidence": 0,
  "evidence_summary": "short explanation of the evidence",
  "recommended_action": "short recommended next action"
}

Rules:
- confidence must be an integer from 0 to 100.
- Do not change payment status.
- Do not invent evidence.
- Base the analysis only on the supplied data.
- Keep the response concise.

Incident data:
${JSON.stringify(incidentData, null, 2)}
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();

      console.error(
        "Gemini API error:",
        response.status,
        errorData
      );

      return {
        ai_used: false,
        likely_cause: "AI analysis failed",
        confidence: 0,
        evidence_summary:
          "The Gemini API returned an error.",
        recommended_action:
          "Review the payment timeline manually."
      };
    }

    const data = await response.json();

    const outputText =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!outputText) {
      throw new Error(
        "No text response returned by Gemini"
      );
    }

    const cleanedText = outputText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const analysis = JSON.parse(cleanedText);

    return {
      ai_used: true,
      likely_cause:
        analysis.likely_cause ||
        "Unable to determine",
      confidence:
        Number.isInteger(analysis.confidence)
          ? analysis.confidence
          : 0,
      evidence_summary:
        analysis.evidence_summary ||
        "No evidence summary provided",
      recommended_action:
        analysis.recommended_action ||
        "Manual review recommended"
    };
  } catch (error) {
    console.error(
      "Gemini incident analysis failed:",
      error.message
    );

    return {
      ai_used: false,
      likely_cause: "AI analysis failed",
      confidence: 0,
      evidence_summary:
        "The AI analysis could not be completed.",
      recommended_action:
        "Review the payment timeline manually."
    };
  }
}

module.exports = {
  analyzeIncident
};