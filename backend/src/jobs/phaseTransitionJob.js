import { prisma } from "../lib/prisma.js";
import { transitionToNextPhase } from "../services/phaseService.js";

export async function processPhaseTransitions() {
    console.log("Processing phase transitions...");

    const podsNeedingTransition = await prisma.podPhase.findMany({
        where: {
            nextPhaseAt: {
                lte: new Date(),
            },
        },
    });

    for (const pod of podsNeedingTransition) {
        try {
            await transitionToNextPhase(pod.podId);
            console.log(`Transitioned pod ${pod.podId} to next phase`);
        } catch (error) {
            console.error(`Failed to transition pod ${pod.podId}:`, error);
        }
    }
}

setInterval(processPhaseTransitions, 60 * 60 * 1000);