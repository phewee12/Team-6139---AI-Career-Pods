import { prisma } from "../lib/prisma.js";

const WEIGHT_CONFIG = {
    messagesCount: 0.15,
    goalsCompleted: 0.20,
    applicationsSubmitted: 0.15,
    checkinsCompleted: 0.15,
    reflectionsCompleted: 0.10,
    celebrationsCreated: 0.05,
    resumeReviewsGiven: 0.10,
    nudgesSent: 0.05,
    nudgesReplied: 0.05,
};

const SCORE_THRESHOLDS = {
    LOW: { min: 0, max: 33 },
    MEDIUM: { min: 34, max: 66 },
    HIGH: { min: 67, max: 100 },
};

function normalizeValue(value, maxExpected = 10) {
    return Math.min(100, (value / maxExpected) * 100);
}

function calculateWeightedScore(metrics) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(WEIGHT_CONFIG)) {
        const value = metrics[key] || 0;
        const normalizedScore = normalizeValue(value, getMaxExpectedValue(key));
        totalScore += normalizedScore * weight;
        totalWeight += weight;
    }

    return Math.round(totalScore / totalWeight);
}

function getMaxExpectedValue(metricKey) {
    const maxValues = {
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
    return maxValues[metricKey] || 10;
}

function getScoreLevel(score) {
    if (score <= SCORE_THRESHOLDS.LOW.max) return "LOW";
    if (score <= SCORE_THRESHOLDS.MEDIUM.max) return "MEDIUM";
    return "HIGH";
}

function getTrend(currentScore, previousScore) {
    if (!previousScore) return null;
    if (currentScore > previousScore) return "UP";
    if (currentScore < previousScore) return "DOWN";
    return "STABLE";
}

export async function updateEngagementMetrics(userId, podId, activityType, increment = 1) {
    const weekStartDate = getWeekStartDate(new Date());

    const existing = await prisma.engagementMetrics.findUnique({
        where: {
            userId_podId_weekStartDate: {
                userId,
                podId,
                weekStartDate,
            },
        },
    });

    const updateData = {
        lastActiveAt: new Date(),
        [activityType]: (existing?.[activityType] || 0) + increment,
    };

    const metrics = await prisma.engagementMetrics.upsert({
        where: {
            userId_podId_weekStartDate: {
                userId,
                podId,
                weekStartDate,
            },
        },
        update: updateData,
        create: {
            userId,
            podId,
            weekStartDate,
            [activityType]: increment,
            lastActiveAt: new Date(),
        },
    });

    await calculateAndStoreScore(userId, podId, weekStartDate);

    return metrics;
}

function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

async function calculateAndStoreScore(userId, podId, weekStartDate) {
    const metrics = await prisma.engagementMetrics.findUnique({
        where: {
            userId_podId_weekStartDate: {
                userId,
                podId,
                weekStartDate,
            },
        },
    });

    if (!metrics) return null;

    const score = calculateWeightedScore(metrics);
    const level = getScoreLevel(score);

    const prevWeekStart = new Date(weekStartDate);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const previousScore = await prisma.engagementScores.findUnique({
        where: {
            userId_podId_weekStartDate: {
                userId,
                podId,
                weekStartDate: prevWeekStart,
            },
        },
        select: { score: true },
    });

    const trend = getTrend(score, previousScore?.score);

    const scoreRecord = await prisma.engagementScores.upsert({
        where: {
            userId_podId_weekStartDate: {
                userId,
                podId,
                weekStartDate,
            },
        },
        update: {
            score,
            level,
            previousScore: previousScore?.score,
            trend,
            calculatedAt: new Date(),
        },
        create: {
            userId,
            podId,
            weekStartDate,
            score,
            level,
            previousScore: previousScore?.score,
            trend,
        },
    });

    return scoreRecord;
}

export async function getEngagementScore(userId, podId) {
    const weekStartDate = getWeekStartDate(new Date());

    const score = await prisma.engagementScores.findUnique({
        where: {
            userId_podId_weekStartDate: {
                userId,
                podId,
                weekStartDate,
            },
        },
    });

    if (!score) {
        await updateEngagementMetrics(userId, podId, 'lastActiveAt', 0);
        return getEngagementScore(userId, podId);
    }

    return score;
}

export async function getEngagementHistory(userId, podId, weeks = 4) {
    const scores = await prisma.engagementScores.findMany({
        where: {
            userId,
            podId,
        },
        orderBy: { weekStartDate: 'desc' },
        take: weeks,
    });

    return scores;
}
