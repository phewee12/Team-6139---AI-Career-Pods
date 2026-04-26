import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_NAME = "gemini-2.5-flash-lite";

let model = null;

function getModel() {
  if (model) {
    return model;
  }

  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: MODEL_NAME });
  return model;
}

function truncateText(input, maxLength) {
  const text = (input || "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function formatItems(title, items, formatter, emptyMessage) {
  if (!items || items.length === 0) {
    return `${title}:\n- ${emptyMessage}`;
  }

  const lines = items.map((item, index) => `- ${index + 1}. ${formatter(item)}`);
  return `${title}:\n${lines.join("\n")}`;
}

function buildPrompt({ podName, windowStartAt, windowEndAt, artifacts }) {
  const header = [
    `You are an assistant that writes concise biweekly progress summaries for career pods.`,
    `Pod name: ${podName}`,
    `Period start (UTC): ${windowStartAt.toISOString()}`,
    `Period end (UTC): ${windowEndAt.toISOString()}`,
    `Return plain text only with 3 sections:`,
    `1) Momentum Snapshot (3-5 sentences)`,
    `2) Wins (bullet list, max 5)`,
    `3) Focus Next (bullet list, max 4)`,
    `Ground every statement in the provided artifacts only. Avoid inventing details.`,
  ].join("\n");

  const sections = [
    formatItems(
      "Check-ins",
      artifacts.checkIns,
      (item) => `${item.userName}: accomplishments=${truncateText(item.notes || "(none)", 180)}; goals=${truncateText(item.goals || "(none)", 160)}`,
      "No check-ins in this window.",
    ),
    formatItems(
      "Reflections",
      artifacts.reflections,
      (item) => `${item.userName}: ${truncateText(item.content, 240)}`,
      "No reflections in this window.",
    ),
    formatItems(
      "Celebrations",
      artifacts.celebrations,
      (item) => `${item.userName}: ${truncateText(item.title, 80)}${item.description ? ` - ${truncateText(item.description, 180)}` : ""}`,
      "No celebrations in this window.",
    ),
    formatItems(
      "Posts",
      artifacts.posts,
      (item) => `${item.userName}: ${truncateText(item.content, 220)}`,
      "No posts in this window.",
    ),
  ];

  return `${header}\n\n${sections.join("\n\n")}`;
}

function buildFallbackSummary({ podName, windowStartAt, windowEndAt, artifacts }) {
  const counts = [
    `${artifacts.checkIns.length} check-ins`,
    `${artifacts.reflections.length} reflections`,
    `${artifacts.celebrations.length} celebrations`,
    `${artifacts.posts.length} posts`,
  ];

  const topCelebration = artifacts.celebrations[0];
  const focusGoals = artifacts.checkIns
    .map((item) => item.goals)
    .filter(Boolean)
    .slice(0, 3);

  const lines = [
    `Momentum Snapshot`,
    `${podName} logged ${counts.join(", ")} between ${windowStartAt.toISOString().slice(0, 10)} and ${windowEndAt.toISOString().slice(0, 10)}. Activity indicates ongoing peer accountability and consistent updates from members who participated.`,
    "",
    "Wins",
    "- Members sustained activity across check-ins, reflections, and group discussion posts.",
  ];

  if (topCelebration) {
    lines.push(`- ${topCelebration.userName} celebrated: ${truncateText(topCelebration.title, 120)}.`);
  }

  lines.push("", "Focus Next");

  if (focusGoals.length > 0) {
    focusGoals.forEach((goal) => {
      lines.push(`- ${truncateText(goal, 140)}`);
    });
  } else {
    lines.push("- Convert current reflections into 2-3 concrete goals for the next window.");
  }

  return lines.join("\n");
}

export function buildSourceCounts(artifacts) {
  return {
    checkIns: artifacts.checkIns.length,
    reflections: artifacts.reflections.length,
    celebrations: artifacts.celebrations.length,
    posts: artifacts.posts.length,
  };
}

export function hasSummarySourceContent(artifacts) {
  return (
    artifacts.checkIns.length > 0 ||
    artifacts.reflections.length > 0 ||
    artifacts.celebrations.length > 0 ||
    artifacts.posts.length > 0
  );
}

export async function generateBiweeklySummary({ podName, windowStartAt, windowEndAt, artifacts }) {
  const aiModel = getModel();
  if (!aiModel) {
    return buildFallbackSummary({ podName, windowStartAt, windowEndAt, artifacts });
  }

  const prompt = buildPrompt({ podName, windowStartAt, windowEndAt, artifacts });

  try {
    const result = await aiModel.generateContent(prompt);
    const text = result.response.text().trim();
    if (!text) {
      return buildFallbackSummary({ podName, windowStartAt, windowEndAt, artifacts });
    }
    return text;
  } catch (error) {
    console.warn("Failed to generate biweekly summary with Gemini:", error?.message || error);
    return buildFallbackSummary({ podName, windowStartAt, windowEndAt, artifacts });
  }
}
