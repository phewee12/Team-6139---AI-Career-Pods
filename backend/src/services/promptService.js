import { prisma } from "../lib/prisma.js";

export async function getPromptForPhase(podId, userId, phase) {
    const prompts = {
        MONDAY_SET: {
            title: "Set Your Weekly Goals",
            questions: [
                "What are your top 3 goals for this week?",
                "What resources or support do you need?",
                "How will you measure success?",
            ],
            placeholder: "This week, I will accomplish...",
        },
        WEDNESDAY_CHECK: {
            title: "Mid-Week Check-In",
            questions: [
                "How are you progressing toward your goals?",
                "Are there any blockers or challenges?",
                "Do you need help from your pod?",
            ],
            placeholder: "I'm making progress on...",
        },
        FRIDAY_REFLECT: {
            title: "Week Reflection",
            questions: [
                "What did you accomplish this week?",
                "What challenges did you face?",
                "What will you do differently next week?",
            ],
            placeholder: "This week, I learned that...",
        },
    };

    const phasePrompt = prompts[phase];
    if (!phasePrompt) return null;

    const weekStartDate = getWeekStartDate(new Date());
    let existingResponse = null;

    if (phase === "MONDAY_SET") {
        existingResponse = await prisma.podCheckIn.findFirst({
            where: {
                podId,
                userId,
                weekStartDate,
            },
        });
    } else if (phase === "FRIDAY_REFLECT") {
        existingResponse = await prisma.podReflection.findFirst({
            where: {
                podId,
                userId,
                weekStartDate,
            },
        });
    }

    return {
        ...phasePrompt,
        hasResponded: !!existingResponse,
        existingResponse: existingResponse || null,
    };
}

function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}