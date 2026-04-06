import { prisma } from "../lib/prisma.js";

const POSITIVE_KEYWORDS = [
    "great", "good", "excellent", "amazing", "happy", "excited", "proud",
    "accomplished", "success", "win", "achieved", "progress", "improved"
];

const NEGATIVE_KEYWORDS = [
    "bad", "terrible", "awful", "sad", "frustrated", "stressed", "overwhelmed",
    "failed", "struggle", "difficult", "hard", "challenging", "behind"
];

export async function analyzeSentiment(text) {
    const lowerText = text.toLowerCase();
    let positiveScore = 0;
    let negativeScore = 0;
    const keywords = [];

    POSITIVE_KEYWORDS.forEach(keyword => {
        if (lowerText.includes(keyword)) {
            positiveScore++;
            keywords.push(keyword);
        }
    });

    NEGATIVE_KEYWORDS.forEach(keyword => {
        if (lowerText.includes(keyword)) {
            negativeScore++;
            keywords.push(keyword);
        }
    });

    const totalScore = positiveScore - negativeScore;
    const maxPossible = Math.max(positiveScore, negativeScore) || 1;
    const normalizedScore = totalScore / maxPossible;

    let sentiment = "NEUTRAL";
    if (normalizedScore > 0.3) sentiment = "POSITIVE";
    if (normalizedScore < -0.3) sentiment = "NEGATIVE";

    return {
        sentiment,
        score: normalizedScore,
        keywords: [...new Set(keywords)],
    };
}

export async function saveSentimentAnalysis(reflectionId, content) {
    const analysis = await analyzeSentiment(content);

    return prisma.reflectionSentiment.upsert({
        where: { reflectionId },
        update: analysis,
        create: {
            reflectionId,
            ...analysis,
        },
    });
}