import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// ATS keywords by role type
const ATS_KEYWORDS = {
  engineering: ["TypeScript", "React", "Node.js", "REST API", "CI/CD", "Agile", "unit testing", "system design", "Git", "Docker"],
  product: ["roadmap", "KPIs", "stakeholder", "user research", "A/B testing", "OKRs", "sprint", "backlog", "metrics", "prioritization"],
  data: ["SQL", "Python", "machine learning", "data pipeline", "ETL", "Tableau", "statistics", "BigQuery", "pandas", "visualization"],
  design: ["Figma", "user research", "wireframes", "prototyping", "usability testing", "design systems", "accessibility", "UX"],
  default: ["leadership", "collaboration", "communication", "results-driven", "cross-functional", "metrics", "stakeholder management"],
};

function detectRoleCategory(targetRole) {
  if (!targetRole) return "default";
  const r = targetRole.toLowerCase();
  if (r.includes("engineer") || r.includes("developer") || r.includes("software")) return "engineering";
  if (r.includes("product") || r.includes("pm")) return "product";
  if (r.includes("data") || r.includes("analyst") || r.includes("scientist")) return "data";
  if (r.includes("design") || r.includes("ux") || r.includes("ui")) return "design";
  return "default";
}

function extractJsonObject(text) {
  const trimmed = (text || "").trim();
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No JSON object found in LLM response.");
    }
    return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
  }
}

function toStringArray(value) {
  if (typeof value === "string") {
    return value
      .split(/\n|\|/)
      .map((item) => item.trim().replace(/^[-*]\s*/, ""))
      .filter(Boolean);
  }

  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export async function generateStructuredFeedbackSuggestions(resumeContext, targetRole) {
  const context = typeof resumeContext === "string" ? resumeContext.trim() : "";
  const prompt = `You are an expert resume reviewer for a ${targetRole || "tech"} role.

Analyze ONLY the resume content below and return ONLY valid JSON with this exact shape:
{
  "atsScore": 0,
  "strengths": ["...", "...", "..."],
  "weaknesses": ["...", "...", "..."],
  "summary": "..."
}

Rules:
- atsScore must be an integer from 0 to 100.
- strengths must describe actual strong points present in the provided resume content (not generic advice).
- weaknesses must describe concrete improvements needed in the provided resume content.
- summary must be 2-4 sentences and balanced.
- If the content is too limited, still return JSON. Use conservative scoring and make strengths/weaknesses explicitly based on what is available.
- Do not include markdown, code fences, or extra keys.

Resume content:
${context || "No resume context provided."}`;

  const result = await model.generateContent(prompt);
  const parsed = extractJsonObject(result.response.text());

  return normalizeSuggestions(parsed);
}

function normalizeSuggestions(parsed) {
  const rawScore = Number(parsed?.atsScore);
  const atsScore = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : 0;
  const strengths = toStringArray(parsed?.strengths);
  const weaknesses = toStringArray(parsed?.weaknesses);
  const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";

  // Backward-compatible payload for existing frontend chips + panels.
  return {
    atsScore,
    strengths,
    weaknesses,
    summary,
    clarityTips: strengths,
    impactTips: weaknesses,
    summaryDraft: summary,
    formattingTips: [],
    keywordSuggestions: [],
  };
}

function buildStructuredResumePrompt(resumeContext, targetRole) {
  const context = typeof resumeContext === "string" ? resumeContext.trim() : "";
  return `You are an expert resume reviewer for a ${targetRole || "tech"} role.

Analyze ONLY the provided resume content (and optional context) and return ONLY valid JSON with this exact shape:
{
  "atsScore": 0,
  "strengths": ["...", "...", "..."],
  "weaknesses": ["...", "...", "..."],
  "summary": "..."
}

Rules:
- atsScore must be an integer from 0 to 100.
- strengths must describe actual strong points present in the resume content.
- weaknesses must describe concrete improvements needed in the resume content.
- summary must be 2-4 sentences and balanced.
- Avoid generic advice that is not grounded in the provided content.
- Do not include markdown, code fences, or extra keys.

Additional context from requester:
${context || "No additional context provided."}`;
}

export async function generateStructuredFeedbackSuggestionsFromPdf({ resumePdfBase64, resumeContext, targetRole }) {
  const prompt = buildStructuredResumePrompt(resumeContext, targetRole);

  // Prefer direct PDF analysis so ATS/strengths/weaknesses are grounded in the resume itself.
  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: resumePdfBase64,
          mimeType: "application/pdf",
        },
      },
      { text: prompt },
    ]);

    const parsed = extractJsonObject(result.response.text());
    return normalizeSuggestions(parsed);
  } catch (error) {
    console.warn("Falling back to context-only resume AI analysis:", error?.message || error);
    // Fallback to context-only analysis if PDF processing is unavailable for any reason.
    return generateStructuredFeedbackSuggestions(resumeContext, targetRole);
  }
}

export function scanForAtsKeywords(resumeContext, targetRole) {
  const category = detectRoleCategory(targetRole);
  const keywords = ATS_KEYWORDS[category];
  const normalizedContext = typeof resumeContext === "string" ? resumeContext.trim() : "";

  if (normalizedContext.length < 20) {
    return {
      found: [],
      missing: keywords,
      atsScore: null,
      insufficientContext: true,
    };
  }

  const contextLower = normalizedContext.toLowerCase();

  const found = keywords.filter((kw) => contextLower.includes(kw.toLowerCase()));
  const missing = keywords.filter((kw) => !contextLower.includes(kw.toLowerCase()));
  const atsScore = Math.round((found.length / keywords.length) * 100);

  return { found, missing, atsScore, insufficientContext: false };
}

export async function generateFeedbackSummary(strengths, improvements, overallScore, targetRole) {
  const prompt = `You are a career coach. A reviewer has given the following feedback on a resume${targetRole ? ` for a ${targetRole} role` : ""}:

Strengths noted: ${strengths || "None provided"}
Improvements needed: ${improvements || "None provided"}
Overall score: ${overallScore}/5

Write a single concise paragraph (3-4 sentences) summarizing this feedback in a constructive, encouraging tone suitable to share directly with the resume owner. Be specific and actionable. Return only the paragraph, no extra text.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}