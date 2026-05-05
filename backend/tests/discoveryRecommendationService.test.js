import { describe, expect, it } from "vitest";
import { rankPodsForUser } from "../src/services/discoveryRecommendationService.js";

describe("discoveryRecommendationService", () => {
  it("ranks the closer city above the farther city", () => {
    const currentUser = {
      fieldOfStudy: "Computer Science",
      careerStage: "Junior",
      targetTimeline: "6 months",
      locationCity: "Austin, TX",
      preferredGroupSize: "ANY",
    };

    const austinPod = {
      id: "austin-pod",
      name: "Austin Pod",
      slug: "austin-pod",
      fieldOfStudy: "Computer Science",
      locationCity: "Austin, TX",
      isDefault: false,
      memberships: [],
      posts: [],
      podCheckIns: [],
      _count: { memberships: 8 },
    };

    const seattlePod = {
      id: "seattle-pod",
      name: "Seattle Pod",
      slug: "seattle-pod",
      fieldOfStudy: "Computer Science",
      locationCity: "Seattle, WA",
      isDefault: false,
      memberships: [],
      posts: [],
      podCheckIns: [],
      _count: { memberships: 8 },
    };

    const ranked = rankPodsForUser([seattlePod, austinPod], currentUser);

    expect(ranked[0].id).toBe("austin-pod");
    expect(ranked[0].locationDistanceKm).toBe(0);
    expect(ranked[0].recommendationScore).toBeGreaterThan(ranked[1].recommendationScore);
    expect(ranked[1].locationDistanceKm).toBeGreaterThan(0);
  });

  it("returns no distance bonus when the city is not in the coordinate catalog", () => {
    const currentUser = {
      fieldOfStudy: "Computer Science",
      careerStage: "Junior",
      targetTimeline: "6 months",
      locationCity: "Other / Not Listed",
      preferredGroupSize: "ANY",
    };

    const pod = {
      id: "pod",
      name: "Pod",
      slug: "pod",
      fieldOfStudy: "Computer Science",
      locationCity: "Austin, TX",
      isDefault: false,
      memberships: [],
      posts: [],
      podCheckIns: [],
      _count: { memberships: 5 },
    };

    const [rankedPod] = rankPodsForUser([pod], currentUser);

    expect(rankedPod.locationDistanceKm).toBeNull();
    expect(rankedPod.recommendationReasons).not.toContain(expect.stringContaining("km away"));
  });
});