/** Max length for custom nudge messages (kindness-first, low pressure). */
export const NUDGE_CUSTOM_MAX_LENGTH = 280;

/** Pre-written gentle templates; {name} is replaced with the recipient's first name. */
export const NUDGE_TEMPLATES = [
  {
    id: "goals_week",
    label: "Goals check-in",
    body: "Hey {name}, haven't seen your goals this week—everything okay?",
  },
  {
    id: "checkin_miss",
    label: "Missed check-in",
    body: "We missed you at check-in! Hope you're doing alright.",
  },
  {
    id: "interview_spot",
    label: "Interview practice",
    body: "Just checking in—want us to save a spot in interview practice?",
  },
];

/** Quick reply options when responding to a nudge. */
export const NUDGE_QUICK_REPLIES = [
  { id: "busy_okay", label: "Doing okay, just busy!" },
  { id: "need_support", label: "Could use some support" },
  { id: "catch_up", label: "I'll catch up this weekend" },
  { id: "lets_chat", label: "Can we chat?" },
];

export function firstName(fullName, email) {
  if (fullName?.trim()) {
    return fullName.trim().split(/\s+/)[0];
  }
  if (email?.includes("@")) {
    return email.split("@")[0];
  }
  return "there";
}

export function applyTemplate(templateBody, recipientName, recipientEmail) {
  const name = firstName(recipientName, recipientEmail);
  return templateBody.replace(/\{name\}/g, name);
}

/** Shown when quiet mode is on — pod sees this, not DM content. */
export function quietModeAnnouncement(name) {
  const n = name?.trim() || "A podmate";
  return `${n} is taking a mental health break this week — they'll be back!`;
}
