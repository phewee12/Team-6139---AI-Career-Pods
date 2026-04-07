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

export async function generateStructuredFeedbackSuggestions(resumeContext, targetRole) {
  const prompt = `You are an expert career coach reviewing a resume for a "${targetRole || "tech"}" role.

Resume context provided by the candidate: ${resumeContext}

Generate structured, actionable feedback in this exact JSON format (return ONLY the JSON, no markdown, no extra text):
{
  "clarityTips": ["specific tip about clarity or strengths", "another clarity strength tip", "third strength tip"],
  "impactTips": ["specific tip about impact/results improvement", "another impact tip"],
  "formattingTips": ["specific formatting improvement tip", "another formatting tip"],
  "keywordSuggestions": ["keyword1", "keyword2", "keyword3"],
  "summaryDraft": "A compelling 2-sentence professional summary for this candidate targeting the ${targetRole || "role"} position."
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(clean);
}

export function scanForAtsKeywords(resumeContext, targetRole) {
  const category = detectRoleCategory(targetRole);
  const keywords = ATS_KEYWORDS[category];
  const contextLower = resumeContext.toLowerCase();

  const found = keywords.filter((kw) => contextLower.includes(kw.toLowerCase()));
  const missing = keywords.filter((kw) => !contextLower.includes(kw.toLowerCase()));
  const atsScore = Math.round((found.length / keywords.length) * 100);

  return { found, missing, atsScore };
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