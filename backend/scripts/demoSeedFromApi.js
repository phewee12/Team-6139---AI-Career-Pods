#!/usr/bin/env node

import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/lib/prisma.js";
import { buildSourceCounts, generateBiweeklySummary, hasSummarySourceContent } from "../src/services/biweeklySummaryService.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../.env") });
dotenv.config({ path: path.resolve(scriptDir, "../../.env"), override: false });

const DEFAULT_PASSWORD = process.env.DEMO_PASSWORD || "QwyseDemo123!";
const DEMO_SUFFIX = process.env.DEMO_SUFFIX || "qwyse.test";
const DRY_RUN = process.argv.includes("--dry-run")
const SKIP_RESUME = process.argv.includes("--skip-resume");
const SKIP_QUIET = process.argv.includes("--skip-quiet");

const DEMO_USERS = [
  {
    email: `alex.chen@${DEMO_SUFFIX}`,
    fullName: "Alex Chen",
    fieldOfStudy: "Computer Science",
    careerStage: "Senior preparing for full-time software roles",
    targetTimeline: "Applying this semester",
    story: {
      blocker: "overediting bullet points until the story gets too long",
      strength: "linking projects to measurable impact",
      goal: "ship two tailored applications and one recruiter follow-up",
      reflection: "a crisp application story matters more than trying to sound impressive",
      post: "a before-and-after bullet rewrite and asked the pod which version felt sharper",
      celebration: "tightened the resume headline and cut the fluff from the project summary",
      reviewStrength: "strong ownership language and clear evidence of impact",
      reviewImprovement: "lead with metrics sooner and trim the second bullet for clarity",
    },
  },
  {
    email: `maya.patel@${DEMO_SUFFIX}`,
    fullName: "Maya Patel",
    fieldOfStudy: "Computer Engineering",
    careerStage: "Internship seeker",
    targetTimeline: "Applying this fall",
    story: {
      blocker: "getting stuck between a draft and a polished application",
      strength: "moving quickly once a plan is clear",
      goal: "finish the project portfolio section and submit one application packet",
      reflection: "small weekly deadlines helped her move from planning to action",
      post: "a checkpoint on portfolio edits, asking for feedback on the strongest project summary",
      celebration: "turned a rough project note into a concise, recruiter-friendly summary",
      reviewStrength: "clear structure and good evidence of collaboration",
      reviewImprovement: "replace a few generic phrases with specific outcomes and tools",
    },
  },
  {
    email: `jordan.lee@${DEMO_SUFFIX}`,
    fullName: "Jordan Lee",
    fieldOfStudy: "Data Science",
    careerStage: "New grad exploring analytics roles",
    targetTimeline: "Interviewing now",
    story: {
      blocker: "trying to fit too many technical details into every update",
      strength: "turning analysis work into business language",
      goal: "practice one case interview story and one SQL project pitch",
      reflection: "the pod made it easier to trim analysis down to the parts that matter",
      post: "a data-story update about an analysis project and the business result it supported",
      celebration: "framed a dashboard project around decisions instead of just charts",
      reviewStrength: "good technical depth with a clear problem statement",
      reviewImprovement: "show more outcome language and simplify the opening summary",
    },
  },
  {
    email: `priya.shah@${DEMO_SUFFIX}`,
    fullName: "Priya Shah",
    fieldOfStudy: "Product Design",
    careerStage: "Product manager candidate",
    targetTimeline: "Targeting next 3 months",
    story: {
      blocker: "making the product narrative sound too abstract",
      strength: "connecting user pain points to concrete decisions",
      goal: "refine one product story and send a follow-up message to a recruiter",
      reflection: "each pod check-in helped convert broad ideas into a simpler narrative",
      post: "a product-story check-in about tradeoffs, user feedback, and why a decision changed",
      celebration: "turned a fuzzy project summary into a sharp product impact story",
      reviewStrength: "strong user empathy and an organized narrative flow",
      reviewImprovement: "add a metric or result to the product examples to make them more persuasive",
    },
  },
  {
    email: `luis.ramirez@${DEMO_SUFFIX}`,
    fullName: "Luis Ramirez",
    fieldOfStudy: "Human-Computer Interaction",
    careerStage: "UX portfolio builder",
    targetTimeline: "Ready for applications now",
    story: {
      blocker: "worrying that portfolio case studies are too wordy",
      strength: "spotting clarity issues quickly in other people’s work",
      goal: "trim one case study and publish a cleaner project narrative",
      reflection: "feedback on his portfolio helped him see what to keep and what to cut",
      post: "a design-note update on simplifying a case study and highlighting the outcome earlier",
      celebration: "removed redundant sections from a case study and made the result easier to scan",
      reviewStrength: "nice visual thinking and strong user-centered framing",
      reviewImprovement: "tighten the summary line and make the outcome read faster",
    },
  },
  {
    email: `aisha.khan@${DEMO_SUFFIX}`,
    fullName: "Aisha Khan",
    fieldOfStudy: "Information Systems",
    careerStage: "Career switcher into software engineering",
    targetTimeline: "Mid-year transition",
    story: {
      blocker: "explaining the career switch without underselling her current experience",
      strength: "translating non-traditional experience into useful signals",
      goal: "reframe one story for software interviews and send a warm outreach message",
      reflection: "the pod helped her connect the career switch story to real technical momentum",
      post: "an update about reworking a transition story and the projects that support it",
      celebration: "found a cleaner way to explain the career switch in one paragraph",
      reviewStrength: "strong transition narrative and evidence of deliberate growth",
      reviewImprovement: "add more technical specificity and one concrete result",
    },
  },
  {
    email: `noah.williams@${DEMO_SUFFIX}`,
    fullName: "Noah Williams",
    fieldOfStudy: "Statistics",
    careerStage: "Graduate school and internship explorer",
    targetTimeline: "Next admissions cycle",
    story: {
      blocker: "balancing grad school essays with internship applications",
      strength: "weaving research and coursework into a coherent profile",
      goal: "finish one statement draft and one internship application",
      reflection: "a simple weekly plan made the two-track search feel less chaotic",
      post: "a planning update about splitting the week between essays and internship prep",
      celebration: "matched one research project to a stronger grad-school narrative",
      reviewStrength: "very clear academic foundation and thoughtful motivation",
      reviewImprovement: "compress the opening paragraph and make the target role clearer earlier",
    },
  },
  {
    email: `zoe.kim@${DEMO_SUFFIX}`,
    fullName: "Zoe Kim",
    fieldOfStudy: "Information Technology",
    careerStage: "Entry-level job seeker",
    targetTimeline: "Applying weekly",
    story: {
      blocker: "keeping energy up when the job search feels repetitive",
      strength: "staying consistent with weekly applications and follow-ups",
      goal: "submit two applications and practice one interview story",
      reflection: "steady repetition works better when each week has one clear win",
      post: "a progress note about sending applications and preparing a short interview intro",
      celebration: "kept the weekly application rhythm going without missing a beat",
      reviewStrength: "solid consistency and a good sense of direction",
      reviewImprovement: "show more specifics about the tools and outcomes from each project",
    },
  },
];

const POD_SPECS = [
  {
    slug: "qwyse-launch-pod",
    name: "Qwyse Launch Pod",
    description: "A high-energy pod for internship and new-grad job search momentum.",
    focusArea: "Internship Search",
    visibility: "PUBLIC",
    ownerIndex: 0,
    memberIndexes: [0, 1, 2, 3, 4],
    celebrationIndexes: [0, 1],
    themes: [
      {
        label: "reset and planning",
        focus: "cleaning up the backlog and tightening the application tracker",
        summaryNoun: "clarity",
        checkInAction: "clear out the noise and identify the top priorities",
        goalAction: "finish the next polished application batch",
        reflectionIdea: "the pod made the search feel less scattered and more deliberate",
        postAngle: "what they trimmed, what they kept, and what goes out next",
        celebrationVerb: "tightened",
      },
      {
        label: "application sprint",
        focus: "sending tailored applications and asking for faster feedback",
        summaryNoun: "momentum",
        checkInAction: "send stronger applications without overthinking every line",
        goalAction: "ship one clean application and one recruiter follow-up",
        reflectionIdea: "small weekly deadlines helped the group move from planning into action",
        postAngle: "what got submitted and what needs one more pass",
        celebrationVerb: "sharpened",
      },
      {
        label: "interview follow-through",
        focus: "prepping stories, reviewing feedback, and tracking recruiter replies",
        summaryNoun: "follow-through",
        checkInAction: "practice a cleaner interview story and respond to open threads",
        goalAction: "prepare one strong interview answer and one thoughtful follow-up",
        reflectionIdea: "the pod kept the team honest about what still needs attention",
        postAngle: "what they learned from interview practice and recruiter updates",
        celebrationVerb: "refined",
      },
    ],
  },
  {
    slug: "qwyse-pivot-pod",
    name: "Qwyse Pivot Pod",
    description: "A supportive group for career switchers building structure and confidence.",
    focusArea: "Career Switch",
    visibility: "PUBLIC",
    ownerIndex: 0,
    memberIndexes: [0, 4, 5, 6, 7],
    celebrationIndexes: [0],
    themes: [
      {
        label: "story translation",
        focus: "reframing non-traditional experience into a stronger story",
        summaryNoun: "translation",
        checkInAction: "translate past experience into software-friendly language",
        goalAction: "turn one career-switch story into a sharper interview answer",
        reflectionIdea: "the group kept the switch story grounded and believable",
        postAngle: "how the switch narrative is changing with each edit",
        celebrationVerb: "reframed",
      },
      {
        label: "networking and outreach",
        focus: "building a warmer outreach habit and cleaner follow-up rhythm",
        summaryNoun: "connection",
        checkInAction: "send outreach messages with more confidence and less hesitation",
        goalAction: "complete one outreach message and one networking follow-up",
        reflectionIdea: "the pod helped the group stop overthinking and start reaching out",
        postAngle: "what outreach worked and what still feels awkward",
        celebrationVerb: "connected",
      },
      {
        label: "confidence building",
        focus: "turning scattered progress into a calmer weekly rhythm",
        summaryNoun: "confidence",
        checkInAction: "keep the transition story steady and easier to repeat",
        goalAction: "practice a confident story and one concrete follow-up",
        reflectionIdea: "steady repetition made the switch story feel more natural",
        postAngle: "what helped them feel more prepared this week",
        celebrationVerb: "strengthened",
      },
    ],
  },
  {
    slug: "qwyse-resume-lab",
    name: "Qwyse Resume Lab",
    description: "A focused pod for resume reviews, applications, and interview prep.",
    focusArea: "Resume Review",
    visibility: "PUBLIC",
    ownerIndex: 0,
    memberIndexes: [0, 1, 3, 5, 7],
    celebrationIndexes: [0, 2],
    themes: [
      {
        label: "bullet cleanup",
        focus: "trimming resume bullets so the impact lands faster",
        summaryNoun: "clarity",
        checkInAction: "remove weak bullets and sharpen the strongest examples",
        goalAction: "edit one bullet set and save a cleaner version",
        reflectionIdea: "the pod made it easier to spot what to cut",
        postAngle: "what changed in the resume draft and why",
        celebrationVerb: "cleaned up",
      },
      {
        label: "ATS alignment",
        focus: "matching the language of the role without sounding robotic",
        summaryNoun: "alignment",
        checkInAction: "match keywords to the target role and keep the story human",
        goalAction: "align one resume section to the target role and send it",
        reflectionIdea: "keyword choices mattered when the story stayed authentic",
        postAngle: "what keywords were added and what stayed human",
        celebrationVerb: "aligned",
      },
      {
        label: "feedback and revision",
        focus: "using peer feedback to make the resume sharper and shorter",
        summaryNoun: "revision",
        checkInAction: "turn feedback into a cleaner revision without adding fluff",
        goalAction: "publish one improved draft and ask for one more review",
        reflectionIdea: "the group made revision feel concrete rather than vague",
        postAngle: "what feedback got applied and what still needs work",
        celebrationVerb: "revised",
      },
    ],
  },
];

const WINDOW_COUNT = 3;
const WINDOW_SPACING_DAYS = 14;

const METRIC_WEIGHTS = {
  messagesCount: 0.15,
  goalsCompleted: 0.2,
  applicationsSubmitted: 0.15,
  checkinsCompleted: 0.15,
  reflectionsCompleted: 0.1,
  celebrationsCreated: 0.05,
  resumeReviewsGiven: 0.1,
  nudgesSent: 0.05,
  nudgesReplied: 0.05,
};

const MAX_EXPECTED_VALUES = {
  messagesCount: 20,
  goalsCompleted: 5,
  applicationsSubmitted: 10,
  checkinsCompleted: 1,
  reflectionsCompleted: 1,
  celebrationsCreated: 5,
  resumeReviewsGiven: 3,
  nudgesSent: 5,
  nudgesReplied: 5,
};

function parseArgs(argv) {
  const options = new Set(argv.slice(2));
  return {
    dryRun: options.has("--dry-run"),
    skipResume: options.has("--skip-resume"),
    skipQuiet: options.has("--skip-quiet"),
  };
}

function assertAllowedDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for demo seeding.");
  }

  const url = new URL(databaseUrl);
  const host = url.hostname.toLowerCase();
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";

  if (!isLocalHost) {
    console.log(`Using remote DATABASE_URL (${databaseUrl}). Proceeding with demo seeding.`);
  }
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "group";
}

function shiftDays(date, days) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function getBiWeeklyStartDate(date) {
  const d = new Date(date);
  const daysSinceEpoch = Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
  const biWeeklyOffset = daysSinceEpoch % WINDOW_SPACING_DAYS;
  d.setDate(d.getDate() - biWeeklyOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getBiWeeklyWindowEndDate(windowStartDate) {
  const end = new Date(windowStartDate);
  end.setDate(end.getDate() + WINDOW_SPACING_DAYS - 1);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatDateShort(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function getWindowStarts() {
  const current = getBiWeeklyStartDate(new Date());
  return [shiftDays(current, -28), shiftDays(current, -14), current];
}

function bucketKey(podId, userId, windowStartAt) {
  return `${podId}:${userId}:${windowStartAt.toISOString()}`;
}

function ensureStatsBucket(statsMap, podId, userId, windowStartAt) {
  const key = bucketKey(podId, userId, windowStartAt);
  if (!statsMap.has(key)) {
    statsMap.set(key, {
      podId,
      userId,
      windowStartAt,
      messagesCount: 0,
      goalsCompleted: 0,
      applicationsSubmitted: 0,
      checkinsCompleted: 0,
      reflectionsCompleted: 0,
      celebrationsCreated: 0,
      resumeReviewsGiven: 0,
      nudgesSent: 0,
      nudgesReplied: 0,
      nudgesReceived: 0,
      nudgeResponsesReceived: 0,
      lastActiveAt: new Date(windowStartAt),
    });
  }

  return statsMap.get(key);
}

function addStats(statsMap, podId, userId, windowStartAt, patch) {
  const bucket = ensureStatsBucket(statsMap, podId, userId, windowStartAt);
  Object.assign(bucket, patch);
  bucket.lastActiveAt = patch.lastActiveAt || bucket.lastActiveAt;
  return bucket;
}

function incrementStats(statsMap, podId, userId, windowStartAt, field, amount = 1) {
  const bucket = ensureStatsBucket(statsMap, podId, userId, windowStartAt);
  bucket[field] += amount;
  bucket.lastActiveAt = new Date(windowStartAt);
  return bucket;
}

function normalizeScore(value, maxExpected = 10) {
  return Math.min(100, (value / maxExpected) * 100);
}

function calculateWeightedScore(metrics) {
  let totalScore = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(METRIC_WEIGHTS)) {
    const value = metrics[key] || 0;
    const normalizedScore = normalizeScore(value, MAX_EXPECTED_VALUES[key] || 10);
    totalScore += normalizedScore * weight;
    totalWeight += weight;
  }

  return Math.round(totalScore / totalWeight);
}

function getScoreLevel(score) {
  if (score <= 33) {
    return "LOW";
  }

  if (score <= 66) {
    return "MEDIUM";
  }

  return "HIGH";
}

function getTrend(currentScore, previousScore) {
  if (previousScore == null) {
    return null;
  }

  if (currentScore > previousScore) {
    return "UP";
  }

  if (currentScore < previousScore) {
    return "DOWN";
  }

  return "STABLE";
}

function getPersonTone(person) {
  return person.story;
}

function buildCheckInNotes(person, podSpec, theme, windowIndex) {
  const tone = getPersonTone(person);
  return [
    `${person.fullName} used the ${theme.label} window to ${theme.checkInAction}.`,
    `${tone.blocker.charAt(0).toUpperCase()}${tone.blocker.slice(1)} is still present, but the pod made the next step feel concrete.`,
    `The goal for this window was to ${tone.goal}.`,
  ].join(" ");
}

function buildGoalsText(person, podSpec, theme) {
  const tone = getPersonTone(person);
  return [
    `For ${podSpec.name}, ${person.fullName} wants to ${theme.goalAction}.`,
    `Their focus is ${tone.strength} while staying honest about what still feels slow.`,
  ].join(" ");
}

function buildReflectionText(person, podSpec, theme) {
  const tone = getPersonTone(person);
  return [
    `${person.fullName} reflected that ${theme.reflectionIdea}.`,
    `This week confirmed that ${tone.reflection} and the pod helped keep the plan moving.`,
  ].join(" ");
}

function buildPostText(person, podSpec, theme, windowIndex) {
  const tone = getPersonTone(person);
  return `${person.fullName} posted during ${theme.label} in ${podSpec.name}: ${tone.post}. The thread focused on ${theme.postAngle}.`;
}

function buildCelebrationTitle(person, podSpec, theme, windowIndex, celebrationIndex) {
  return `${person.fullName} ${theme.celebrationVerb} milestone ${windowIndex + 1}-${celebrationIndex + 1}`;
}

function buildCelebrationDescription(person, podSpec, theme) {
  const tone = getPersonTone(person);
  return `${person.fullName} turned feedback into a clearer update in ${podSpec.name}. The concrete win was ${tone.celebration}, which made the summary easier to share.`;
}

function buildResumeStrengths(person, podSpec) {
  return `${person.story.reviewStrength}. The structure is strong and the career direction is easy to follow in ${podSpec.name}.`;
}

function buildResumeImprovements(person, podSpec) {
  return `${person.story.reviewImprovement}. A slightly tighter first paragraph would make the overall story land faster.`;
}

function buildResumeContext(person, podSpec) {
  return `This review is for the ${podSpec.name} demo. The requester is ${person.fullName} and wants concise, practical feedback that is easy to turn into the next draft.`;
}

function makeResumeTitle(person, podSpec) {
  return `${person.fullName} resume review - ${podSpec.name}`;
}

function makeIntroMessage(person, podSpec) {
  return `Hi, I'm ${person.fullName}. I’m using ${podSpec.name} to stay accountable, move faster on applications, and make the story easier to explain.`;
}

function makeNudgeMessage(sender, recipient, podSpec, theme, index) {
  return `${sender.fullName} to ${recipient.fullName}: ${theme.label} is the right time to compare drafts, tighten the wording, and make sure the next update in ${podSpec.name} is crisp.`;
}

function makeQuietModeUntil(windowStartAt) {
  return shiftDays(windowStartAt, 3).toISOString();
}

function createEmptyArtifactBucket() {
  return {
    checkIns: [],
    reflections: [],
    celebrations: [],
    posts: [],
  };
}

function ensureArtifactBucket(map, podId, windowStartAt) {
  const key = `${podId}:${windowStartAt.toISOString()}`;
  if (!map.has(key)) {
    map.set(key, createEmptyArtifactBucket());
  }
  return map.get(key);
}

function buildDryRunSummary() {
  console.log("Demo data seeder dry run");
  console.log(`Database URL: ${process.env.DATABASE_URL || "(missing)"}`);
  console.log(`Users: ${DEMO_USERS.length}`);
  console.log(`Pods: ${POD_SPECS.length}`);
  console.log(`Windows to seed: ${WINDOW_COUNT}`);
  console.log("This run would:");
  console.log("- upsert demo users and profiles");
  console.log("- upsert demo pods, memberships, and phases");
  console.log("- seed older biweekly windows with check-ins, reflections, celebrations, and posts");
  console.log("- seed nudges, quiet mode, resume reviews, and engagement data");
  console.log("- generate summary rows for each seeded window");
}

async function resetDatabase() {
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany();
    await tx.accountabilityMetric.deleteMany();
    await tx.engagementScores.deleteMany();
    await tx.engagementMetrics.deleteMany();
    await tx.quietMode.deleteMany();
    await tx.nudge.deleteMany();
    await tx.podResumeReviewFeedback.deleteMany();
    await tx.podResumeFile.deleteMany();
    await tx.podResumeReviewRequest.deleteMany();
    await tx.reflectionSentiment.deleteMany();
    await tx.podBiweeklySummary.deleteMany();
    await tx.podCelebration.deleteMany();
    await tx.podPost.deleteMany();
    await tx.podReflection.deleteMany();
    await tx.podCheckIn.deleteMany();
    await tx.podMembership.deleteMany();
    await tx.podPhase.deleteMany();
    await tx.pod.deleteMany();
    await tx.user.deleteMany();
  });
}

async function upsertDemoUsers() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const users = [];
  for (const seed of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: seed.email.toLowerCase() },
      update: {
        fullName: seed.fullName,
        passwordHash,
        authProvider: "LOCAL",
        fieldOfStudy: seed.fieldOfStudy,
        careerStage: seed.careerStage,
        targetTimeline: seed.targetTimeline,
      },
      create: {
        email: seed.email.toLowerCase(),
        fullName: seed.fullName,
        passwordHash,
        authProvider: "LOCAL",
        fieldOfStudy: seed.fieldOfStudy,
        careerStage: seed.careerStage,
        targetTimeline: seed.targetTimeline,
      },
    });

    users.push({ ...user, seed });
  }

  return users;
}

async function upsertDemoPod(spec, ownerUserId) {
  const pod = await prisma.pod.upsert({
    where: { slug: spec.slug },
    update: {
      name: spec.name,
      description: spec.description,
      focusArea: spec.focusArea,
      visibility: spec.visibility,
      isDefault: false,
      createdById: ownerUserId,
    },
    create: {
      slug: spec.slug,
      name: spec.name,
      description: spec.description,
      focusArea: spec.focusArea,
      visibility: spec.visibility,
      isDefault: false,
      createdById: ownerUserId,
    },
  });

  await prisma.podMembership.upsert({
    where: {
      podId_userId: {
        podId: pod.id,
        userId: ownerUserId,
      },
    },
    update: {
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: ownerUserId,
      onboardedAt: new Date(),
      introMessage: "I’m the pod owner and using this group to keep the demo moving.",
    },
    create: {
      podId: pod.id,
      userId: ownerUserId,
      role: "OWNER",
      status: "ACTIVE",
      requestedAt: new Date(),
      joinedAt: new Date(),
      reviewedAt: new Date(),
      reviewedById: ownerUserId,
      onboardedAt: new Date(),
      introMessage: "I’m the pod owner and using this group to keep the demo moving.",
    },
  });

  await prisma.podPhase.upsert({
    where: { podId: pod.id },
    update: {
      currentPhase: "MONDAY_SET",
      phaseStartedAt: new Date(),
      nextPhaseAt: shiftDays(new Date(), 2),
      timezone: "UTC",
    },
    create: {
      podId: pod.id,
      currentPhase: "MONDAY_SET",
      phaseStartedAt: new Date(),
      nextPhaseAt: shiftDays(new Date(), 2),
      timezone: "UTC",
    },
  });

  return pod;
}

async function upsertMembership(podId, user, role = "MEMBER", windowStartAt = new Date()) {
  await prisma.podMembership.upsert({
    where: {
      podId_userId: {
        podId,
        userId: user.id,
      },
    },
    update: {
      role,
      status: "ACTIVE",
      joinedAt: windowStartAt,
      reviewedAt: windowStartAt,
      reviewedById: user.id,
      onboardedAt: windowStartAt,
      introMessage: makeIntroMessage(user.seed, { name: "Qwyse demo pod" }),
    },
    create: {
      podId,
      userId: user.id,
      role,
      status: "ACTIVE",
      requestedAt: windowStartAt,
      joinedAt: windowStartAt,
      reviewedAt: windowStartAt,
      reviewedById: user.id,
      onboardedAt: windowStartAt,
      introMessage: makeIntroMessage(user.seed, { name: "Qwyse demo pod" }),
    },
  });
}

async function upsertCheckIn(podId, user, windowStartAt, theme, statsMap) {
  const notes = buildCheckInNotes(user.seed, { name: "pod" }, theme, 0);
  const goals = buildGoalsText(user.seed, { name: theme.label }, theme);

  await prisma.podCheckIn.upsert({
    where: {
      podId_userId_weekStartDate: {
        podId,
        userId: user.id,
        weekStartDate: windowStartAt,
      },
    },
    update: {
      notes,
      goals,
      status: "COMPLETED",
    },
    create: {
      podId,
      userId: user.id,
      weekStartDate: windowStartAt,
      notes,
      goals,
      status: "COMPLETED",
    },
  });

  const bucket = incrementStats(statsMap, podId, user.id, windowStartAt, "checkinsCompleted", 1);
  bucket.goalsCompleted += windowStartAt.getTime() ? 1 : 0;

  return {
    userName: user.fullName || user.email,
    notes,
    goals,
  };
}

async function upsertReflection(podId, user, windowStartAt, theme, statsMap) {
  const content = buildReflectionText(user.seed, { name: theme.label }, theme);

  await prisma.podReflection.deleteMany({
    where: {
      podId,
      userId: user.id,
      weekStartDate: windowStartAt,
    },
  });

  await prisma.podReflection.create({
    data: {
      podId,
      userId: user.id,
      weekStartDate: windowStartAt,
      content,
    },
  });

  incrementStats(statsMap, podId, user.id, windowStartAt, "reflectionsCompleted", 1);

  return {
    userName: user.fullName || user.email,
    content,
  };
}

async function upsertCelebration(podId, user, windowStartAt, theme, celebrationIndex, statsMap) {
  const title = buildCelebrationTitle(user.seed, { name: theme.label }, theme, 0, celebrationIndex);
  const description = buildCelebrationDescription(user.seed, { name: theme.label }, theme);
  const createdAt = shiftDays(windowStartAt, 2 + celebrationIndex);

  const existing = await prisma.podCelebration.findFirst({
    where: {
      podId,
      userId: user.id,
      weekStartDate: windowStartAt,
      title,
    },
  });

  if (!existing) {
    await prisma.podCelebration.create({
      data: {
        podId,
        userId: user.id,
        weekStartDate: windowStartAt,
        title,
        description,
        createdAt,
      },
    });
  }

  incrementStats(statsMap, podId, user.id, windowStartAt, "celebrationsCreated", 1);

  return {
    userName: user.fullName || user.email,
    title,
    description,
  };
}

async function upsertPost(podId, user, windowStartAt, theme, statsMap) {
  const content = buildPostText(user.seed, { name: theme.label }, theme, 0);
  const createdAt = shiftDays(windowStartAt, 1);

  const existing = await prisma.podPost.findFirst({
    where: {
      podId,
      authorId: user.id,
      content,
    },
  });

  if (!existing) {
    await prisma.podPost.create({
      data: {
        podId,
        authorId: user.id,
        content,
        createdAt,
      },
    });
  }

  incrementStats(statsMap, podId, user.id, windowStartAt, "messagesCount", 1);

  return {
    userName: user.fullName || user.email,
    content,
  };
}

async function upsertNudge(sender, recipient, podId, windowStartAt, theme, statsMap) {
  const sentAt = shiftDays(windowStartAt, 4);
  const message = makeNudgeMessage(sender.seed, recipient.seed, { name: podId }, theme, 0);

  const existing = await prisma.nudge.findFirst({
    where: {
      podId,
      fromUserId: sender.id,
      toUserId: recipient.id,
      message,
      sentAt,
    },
  });

  let nudge = existing;

  if (!nudge) {
    nudge = await prisma.nudge.create({
      data: {
        podId,
        fromUserId: sender.id,
        toUserId: recipient.id,
        nudgeType: "CUSTOM",
        message,
        templateId: "demo-follow-up",
        sentAt,
        sentHourUtc: sentAt.getUTCHours(),
        sentDowUtc: sentAt.getUTCDay(),
      },
    });
  }

  incrementStats(statsMap, podId, sender.id, windowStartAt, "nudgesSent", 1);
  incrementStats(statsMap, podId, recipient.id, windowStartAt, "nudgesReceived", 1);

  return { nudge, message };
}

async function upsertNudgeResponse(sender, recipient, podId, windowStartAt, nudge, quickReplyId, statsMap) {
  const responseMap = {
    busy_okay: "BUSY_OKAY",
    need_support: "NEED_SUPPORT",
    catch_up: "CATCH_UP",
    lets_chat: "LETS_CHAT",
  };

  const responseEnum = responseMap[quickReplyId];
  const now = shiftDays(windowStartAt, 5);

  const updated = await prisma.nudge.update({
    where: { id: nudge.id },
    data: {
      response: responseEnum,
      respondedAt: now,
      readAt: nudge.readAt || now,
    },
  });

  incrementStats(statsMap, podId, recipient.id, windowStartAt, "nudgesReplied", 1);
  incrementStats(statsMap, podId, sender.id, windowStartAt, "nudgeResponsesReceived", 1);

  return updated;
}

async function upsertQuietMode(user, podId, windowStartAt) {
  const until = makeQuietModeUntil(windowStartAt);

  return prisma.quietMode.upsert({
    where: {
      userId_podId: {
        userId: user.id,
        podId,
      },
    },
    update: {
      startDate: shiftDays(windowStartAt, 1),
      endDate: new Date(until),
      autoNotify: true,
    },
    create: {
      userId: user.id,
      podId,
      startDate: shiftDays(windowStartAt, 1),
      endDate: new Date(until),
      autoNotify: true,
    },
  });
}

async function upsertResumeReview(requester, reviewer, podId, podSpec, windowStartAt, statsMap) {
  const title = makeResumeTitle(requester.seed, podSpec);
  const createdAt = shiftDays(windowStartAt, 6);

  let reviewRequest = await prisma.podResumeReviewRequest.findFirst({
    where: {
      podId,
      requesterId: requester.id,
      title,
    },
    include: {
      feedback: true,
    },
  });

  if (!reviewRequest) {
    reviewRequest = await prisma.podResumeReviewRequest.create({
      data: {
        id: randomUUID(),
        podId,
        requesterId: requester.id,
        title,
        targetRole: requester.seed.careerStage,
        context: buildResumeContext(requester.seed, podSpec),
        createdAt,
      },
      include: {
        feedback: true,
      },
    });
  }

  const feedback = await prisma.podResumeReviewFeedback.upsert({
    where: {
      requestId_reviewerId: {
        requestId: reviewRequest.id,
        reviewerId: reviewer.id,
      },
    },
    update: {
      overallScore: 4,
      impactAndResultsScore: 4,
      roleFitScore: 4,
      atsClarityScore: 5,
      strengths: buildResumeStrengths(reviewer.seed, podSpec),
      improvements: buildResumeImprovements(reviewer.seed, podSpec),
      lineLevelSuggestions: `Use the ${podSpec.name} feedback to keep the opening tighter and the metrics easier to scan.`,
      finalComments: `The draft is strong enough for the demo, and a few sharper edits would make it easier to read at a glance.`,
      recommendation: "YES_WITH_EDITS",
    },
    create: {
      requestId: reviewRequest.id,
      reviewerId: reviewer.id,
      overallScore: 4,
      impactAndResultsScore: 4,
      roleFitScore: 4,
      atsClarityScore: 5,
      strengths: buildResumeStrengths(reviewer.seed, podSpec),
      improvements: buildResumeImprovements(reviewer.seed, podSpec),
      lineLevelSuggestions: `Use the ${podSpec.name} feedback to keep the opening tighter and the metrics easier to scan.`,
      finalComments: `The draft is strong enough for the demo, and a few sharper edits would make it easier to read at a glance.`,
      recommendation: "YES_WITH_EDITS",
    },
  });

  incrementStats(statsMap, podId, reviewer.id, windowStartAt, "resumeReviewsGiven", 1);

  return { reviewRequest, feedback };
}

function calculateAverage(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function upsertEngagementAndAccountability(statsMap) {
  const buckets = Array.from(statsMap.values()).sort((a, b) => a.windowStartAt.getTime() - b.windowStartAt.getTime());
  const scoreByBucketKey = new Map();

  for (const bucket of buckets) {
    const score = calculateWeightedScore(bucket);
    const level = getScoreLevel(score);
    const previousStart = shiftDays(bucket.windowStartAt, -7);
    const previousKey = bucketKey(bucket.podId, bucket.userId, previousStart);
    const previousScore = scoreByBucketKey.get(previousKey) || null;
    const trend = getTrend(score, previousScore);

    await prisma.engagementMetrics.upsert({
      where: {
        userId_podId_weekStartDate: {
          userId: bucket.userId,
          podId: bucket.podId,
          weekStartDate: bucket.windowStartAt,
        },
      },
      update: {
        messagesCount: bucket.messagesCount,
        goalsCompleted: bucket.goalsCompleted,
        applicationsSubmitted: bucket.applicationsSubmitted,
        checkinsCompleted: bucket.checkinsCompleted,
        reflectionsCompleted: bucket.reflectionsCompleted,
        celebrationsCreated: bucket.celebrationsCreated,
        resumeReviewsGiven: bucket.resumeReviewsGiven,
        nudgesSent: bucket.nudgesSent,
        nudgesReplied: bucket.nudgesReplied,
        lastActiveAt: bucket.lastActiveAt,
      },
      create: {
        userId: bucket.userId,
        podId: bucket.podId,
        weekStartDate: bucket.windowStartAt,
        messagesCount: bucket.messagesCount,
        goalsCompleted: bucket.goalsCompleted,
        applicationsSubmitted: bucket.applicationsSubmitted,
        checkinsCompleted: bucket.checkinsCompleted,
        reflectionsCompleted: bucket.reflectionsCompleted,
        celebrationsCreated: bucket.celebrationsCreated,
        resumeReviewsGiven: bucket.resumeReviewsGiven,
        nudgesSent: bucket.nudgesSent,
        nudgesReplied: bucket.nudgesReplied,
        lastActiveAt: bucket.lastActiveAt,
      },
    });

    await prisma.engagementScores.upsert({
      where: {
        userId_podId_weekStartDate: {
          userId: bucket.userId,
          podId: bucket.podId,
          weekStartDate: bucket.windowStartAt,
        },
      },
      update: {
        score,
        level,
        previousScore,
        trend,
        calculatedAt: bucket.windowStartAt,
      },
      create: {
        userId: bucket.userId,
        podId: bucket.podId,
        weekStartDate: bucket.windowStartAt,
        score,
        level,
        previousScore,
        trend,
        calculatedAt: bucket.windowStartAt,
      },
    });

    await prisma.accountabilityMetric.upsert({
      where: {
        userId_podId_weekStartDate: {
          userId: bucket.userId,
          podId: bucket.podId,
          weekStartDate: bucket.windowStartAt,
        },
      },
      update: {
        nudgesSent: bucket.nudgesSent,
        nudgesReceived: bucket.nudgesReceived,
        responseRate: bucket.nudgesReceived > 0 ? bucket.nudgeResponsesReceived / bucket.nudgesReceived : null,
      },
      create: {
        userId: bucket.userId,
        podId: bucket.podId,
        weekStartDate: bucket.windowStartAt,
        nudgesSent: bucket.nudgesSent,
        nudgesReceived: bucket.nudgesReceived,
        responseRate: bucket.nudgesReceived > 0 ? bucket.nudgeResponsesReceived / bucket.nudgesReceived : null,
      },
    });

    scoreByBucketKey.set(bucketKey(bucket.podId, bucket.userId, bucket.windowStartAt), score);
  }
}

async function upsertSummaryForBucket(podSpec, pod, windowStartAt, bucket, ownerUser) {
  if (!hasSummarySourceContent(bucket)) {
    return null;
  }

  const windowEndAt = getBiWeeklyWindowEndDate(windowStartAt);
  const summaryText = await generateBiweeklySummary({
    podName: podSpec.name,
    windowStartAt,
    windowEndAt,
    artifacts: bucket,
  });

  return prisma.podBiweeklySummary.upsert({
    where: {
      podId_windowStartAt: {
        podId: pod.id,
        windowStartAt,
      },
    },
    update: {
      windowEndAt,
      summaryText,
      sourceCounts: buildSourceCounts(bucket),
      generatedById: ownerUser.id,
    },
    create: {
      podId: pod.id,
      windowStartAt,
      windowEndAt,
      summaryText,
      sourceCounts: buildSourceCounts(bucket),
      generatedById: ownerUser.id,
    },
  });
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.dryRun) {
    buildDryRunSummary();
    return;
  }

  assertAllowedDatabase();

  await resetDatabase();

  const windowStarts = getWindowStarts();
  const statsMap = new Map();
  const artifactMap = new Map();

  try {
    const users = [];
    for (const seed of DEMO_USERS) {
      const user = await upsertDemoUsersOne(seed);
      users.push({ ...user, seed });
    }

    const pods = [];
    for (const spec of POD_SPECS) {
      const ownerUser = users[spec.ownerIndex];
      const pod = await upsertDemoPod(spec, ownerUser.id);
      pods.push({ spec, pod, ownerUser });
    }

    for (const { spec, pod, ownerUser } of pods) {
      const members = spec.memberIndexes.map((index) => users[index]);

      for (const member of members) {
        const role = member.id === ownerUser.id ? "OWNER" : "MEMBER";
        await upsertMembership(pod.id, member, role, shiftDays(windowStarts[0], -3));
      }

      for (const [windowIndex, windowStartAt] of windowStarts.entries()) {
        const theme = spec.themes[windowIndex];
        const bucket = ensureArtifactBucket(artifactMap, pod.id, windowStartAt);

        for (const member of members) {
          const checkIn = await upsertCheckIn(pod.id, member, windowStartAt, theme, statsMap);
          const reflection = await upsertReflection(pod.id, member, windowStartAt, theme, statsMap);
          const post = await upsertPost(pod.id, member, windowStartAt, theme, statsMap);

          bucket.checkIns.push(checkIn);
          bucket.reflections.push(reflection);
          bucket.posts.push(post);

          addStats(statsMap, pod.id, member.id, windowStartAt, {
            applicationsSubmitted: windowIndex + 1,
            goalsCompleted: windowIndex === 2 ? 1 : windowIndex === 1 ? 1 : 0,
            lastActiveAt: shiftDays(windowStartAt, 6),
          });
        }

        for (const celebrationIndex of spec.celebrationIndexes) {
          const celebrant = members[celebrationIndex % members.length];
          const celebration = await upsertCelebration(pod.id, celebrant, windowStartAt, theme, celebrationIndex, statsMap);
          bucket.celebrations.push(celebration);
        }
      }

      const currentWindowStart = windowStarts[windowStarts.length - 1];
      const currentTheme = spec.themes[windowStarts.length - 1];
      const firstMember = members[0];
      const secondMember = members[1];
      const thirdMember = members[2] || members[1];

      const nudgeOne = await upsertNudge(firstMember, secondMember, pod.id, currentWindowStart, currentTheme, statsMap);
      await upsertNudgeResponse(secondMember, firstMember, pod.id, currentWindowStart, nudgeOne.nudge, "busy_okay", statsMap);

      const nudgeTwo = await upsertNudge(thirdMember, firstMember, pod.id, currentWindowStart, currentTheme, statsMap);
      await upsertNudgeResponse(firstMember, thirdMember, pod.id, currentWindowStart, nudgeTwo.nudge, "catch_up", statsMap);

      if (!SKIP_QUIET && spec.slug === "qwyse-pivot-pod") {
        await upsertQuietMode(members[members.length - 1], pod.id, currentWindowStart);
      }

      if (!SKIP_RESUME) {
        const requester = members[0];
        const reviewer = members[1];
        await upsertResumeReview(requester, reviewer, pod.id, spec, currentWindowStart, statsMap);
      }
    }

    await upsertEngagementAndAccountability(statsMap);

    for (const { spec, pod, ownerUser } of pods) {
      for (const windowStartAt of windowStarts) {
        const bucket = ensureArtifactBucket(artifactMap, pod.id, windowStartAt);
        await upsertSummaryForBucket(spec, pod, windowStartAt, bucket, ownerUser);
      }
    }

    console.log("Demo seeding complete.");
    console.log(JSON.stringify({
      users: users.length,
      pods: pods.length,
      windows: windowStarts.map((value) => formatDateShort(value)),
      summaries: Array.from(artifactMap.values()).filter((bucket) => hasSummarySourceContent(bucket)).length,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function upsertDemoUsersOne(seed) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  return prisma.user.upsert({
    where: { email: seed.email.toLowerCase() },
    update: {
      fullName: seed.fullName,
      passwordHash,
      authProvider: "LOCAL",
      fieldOfStudy: seed.fieldOfStudy,
      careerStage: seed.careerStage,
      targetTimeline: seed.targetTimeline,
    },
    create: {
      email: seed.email.toLowerCase(),
      fullName: seed.fullName,
      passwordHash,
      authProvider: "LOCAL",
      fieldOfStudy: seed.fieldOfStudy,
      careerStage: seed.careerStage,
      targetTimeline: seed.targetTimeline,
    },
  });
}

main().catch((error) => {
  console.error("Demo seeding failed:");
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
