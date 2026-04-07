import { prisma } from "../lib/prisma.js";
import { notifyPhaseChange } from "./notificationService.js";

function getNextPhase(currentPhase) {
    switch (currentPhase) {
        case "MONDAY_SET":
            return "WEDNESDAY_CHECK";
        case "WEDNESDAY_CHECK":
            return "FRIDAY_REFLECT";
        case "FRIDAY_REFLECT":
        default:
            return "MONDAY_SET";
    }
}

export async function getCurrentPhase(podId) {
    let phase = await prisma.podPhase.findUnique({
        where: { podId },
    });

    if (!phase) {
        return initializePodPhase(podId);
    }

    return phase;
}

export async function initializePodPhase(podId, timezone = "UTC") {
    const now = new Date();
    // Calculate next phase (2 days from now for MONDAY_SET)
    const nextPhaseAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    return prisma.podPhase.upsert({
        where: { podId },
        update: {
            currentPhase: "MONDAY_SET",
            phaseStartedAt: now,
            nextPhaseAt: nextPhaseAt,
        },
        create: {
            podId,
            currentPhase: "MONDAY_SET",
            phaseStartedAt: now,
            nextPhaseAt: nextPhaseAt,
            timezone,
        },
    });
}

export async function transitionToNextPhase(podId) {
    const current = await getCurrentPhase(podId);
    const nextPhase = getNextPhase(current.currentPhase);
    const now = new Date();
    const nextPhaseAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const updated = await prisma.podPhase.update({
        where: { podId },
        data: {
            currentPhase: nextPhase,
            phaseStartedAt: now,
            nextPhaseAt,
        },
    });

    await notifyPhaseChange(podId, nextPhase);

    return updated;
}

export async function getPromptForPhase(podId, userId, phase) {
    const prompts = {
        MONDAY_SET: {
            title: "Set Your Weekly Goals",
            questions: ["What are your top 3 goals for this week?", "What resources or support do you need?"],
            placeholder: "This week, I will accomplish...",
        },
        WEDNESDAY_CHECK: {
            title: "Mid-Week Check-In",
            questions: ["How are you progressing toward your goals?", "Any blockers or challenges?"],
            placeholder: "I'm making progress on...",
        },
        FRIDAY_REFLECT: {
            title: "Week Reflection",
            questions: ["What did you accomplish this week?", "What challenges did you face?"],
            placeholder: "This week, I learned that...",
        },
    };

    return prompts[phase] || prompts.MONDAY_SET;
}