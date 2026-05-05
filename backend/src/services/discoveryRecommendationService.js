import { CITY_COORDINATES, MAX_LOCATION_DISTANCE_KM } from "../constants/cityCoordinates.js";

const SIZE_BUCKET_ORDER = ["NEW", "SMALL", "MID", "LARGE"];

const DEFAULT_WEIGHTS = {
  major: 0.25,
  stage: 0.15,
  timeline: 0.15,
  location: 0.15,
  groupSize: 0.15,
  activity: 0.15,
};

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

function getGroupSizeBucket(memberCount) {
  if (memberCount === 0) return "NEW";
  if (memberCount < 25) return "SMALL";
  if (memberCount < 100) return "MID";
  return "LARGE";
}

function scoreTextMatch(leftValue, rightValue) {
  const left = normalizeText(leftValue);
  const right = normalizeText(rightValue);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.includes(right) || right.includes(left)) {
    return 0.8;
  }

  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const overlapCount = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const maxTokenCount = Math.max(leftTokens.size, rightTokens.size);

  if (maxTokenCount > 0) {
    const overlapRatio = overlapCount / maxTokenCount;
    if (overlapRatio >= 0.5) return 0.6;
    if (overlapRatio > 0) return 0.3;
  }

  return 0;
}

function getCityCoordinates(cityName) {
  if (!cityName || cityName === "Other / Not Listed") {
    return null;
  }

  return CITY_COORDINATES[cityName] || null;
}

function haversineDistanceKm(left, right) {
  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;

  const latDelta = toRadians(right.lat - left.lat);
  const lngDelta = toRadians(right.lng - left.lng);
  const startLat = toRadians(left.lat);
  const endLat = toRadians(right.lat);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.sin(lngDelta / 2) ** 2 * Math.cos(startLat) * Math.cos(endLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function scoreLocationMatch(userCity, podCity) {
  const userCoordinates = getCityCoordinates(userCity);
  const podCoordinates = getCityCoordinates(podCity);

  if (!userCoordinates || !podCoordinates) {
    return { score: 0, distanceKm: null };
  }

  const distanceKm = haversineDistanceKm(userCoordinates, podCoordinates);
  const score = Math.max(0, 1 - distanceKm / MAX_LOCATION_DISTANCE_KM);

  return {
    score: Number(score.toFixed(4)),
    distanceKm: Number(distanceKm.toFixed(1)),
  };
}

function scoreGroupSizeMatch(preferredGroupSize, memberCount) {
  const preference = normalizeText(preferredGroupSize).toUpperCase();

  if (!preference || preference === "ANY") {
    return 0;
  }

  const preferredIndex = SIZE_BUCKET_ORDER.indexOf(preference);
  const actualBucket = getGroupSizeBucket(memberCount);
  const actualIndex = SIZE_BUCKET_ORDER.indexOf(actualBucket);

  if (preferredIndex === -1 || actualIndex === -1) {
    return 0;
  }

  const distance = Math.abs(preferredIndex - actualIndex);

  if (distance === 0) return 1;
  if (distance === 1) return 0.7;
  if (distance === 2) return 0.4;
  return 0.2;
}

function scoreAlignmentByMembers(userValue, members, fieldName) {
  const normalizedUserValue = normalizeText(userValue);

  if (!normalizedUserValue || !Array.isArray(members) || members.length === 0) {
    return 0;
  }

  const totalScore = members.reduce((sum, member) => {
    return sum + scoreTextMatch(member?.user?.[fieldName], normalizedUserValue);
  }, 0);

  return totalScore / members.length;
}

function getLatestTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function scoreActivity(pod) {
  const latestPostAt = getLatestTimestamp(pod.posts?.[0]?.createdAt);
  const latestCheckInAt = getLatestTimestamp(pod.podCheckIns?.[0]?.createdAt);
  const latestActivityAt = [latestPostAt, latestCheckInAt]
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  if (!latestActivityAt) {
    return 0;
  }

  const daysSinceActivity = (Date.now() - latestActivityAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceActivity <= 3) return 1;
  if (daysSinceActivity <= 7) return 0.85;
  if (daysSinceActivity <= 14) return 0.65;
  if (daysSinceActivity <= 30) return 0.35;
  return 0.15;
}

function buildReasons({ majorScore, stageScore, timelineScore, locationScore, locationDistanceKm, sizeScore, activityScore }) {
  const reasons = [];

  if (majorScore >= 0.7) reasons.push("Matches your field of study");
  if (stageScore >= 0.5) reasons.push("Members align with your career stage");
  if (timelineScore >= 0.5) reasons.push("Members align with your target timeline");
  if (locationScore >= 0.9) reasons.push("Same city or metro area");
  else if (locationScore >= 0.7) reasons.push(locationDistanceKm != null ? `${Math.round(locationDistanceKm)} km away` : "Nearby city or metro area");
  else if (locationScore >= 0.4) reasons.push("Within a reasonable travel distance");
  if (sizeScore >= 0.7) reasons.push("Matches your preferred group size");
  if (activityScore >= 0.7) reasons.push("Recently active community");

  return reasons.slice(0, 3);
}

export function rankPodsForUser(pods, currentUser) {
  return [...pods]
    .map((pod) => {
      const memberCount = typeof pod._count?.memberships === "number" ? pod._count.memberships : 0;
      const stageScore = scoreAlignmentByMembers(currentUser?.careerStage, pod.memberships, "careerStage");
      const timelineScore = scoreAlignmentByMembers(currentUser?.targetTimeline, pod.memberships, "targetTimeline");
      const majorScore = scoreTextMatch(currentUser?.fieldOfStudy, pod.fieldOfStudy);
      const locationMatch = scoreLocationMatch(currentUser?.locationCity, pod.locationCity);
      const locationScore = locationMatch.score;
      const groupSizeScore = scoreGroupSizeMatch(currentUser?.preferredGroupSize, memberCount);
      const activityScore = scoreActivity(pod);

      const recommendationScore =
        majorScore * DEFAULT_WEIGHTS.major +
        stageScore * DEFAULT_WEIGHTS.stage +
        timelineScore * DEFAULT_WEIGHTS.timeline +
        locationScore * DEFAULT_WEIGHTS.location +
        groupSizeScore * DEFAULT_WEIGHTS.groupSize +
        activityScore * DEFAULT_WEIGHTS.activity;

      return {
        ...pod,
        recommendationScore: Number(recommendationScore.toFixed(4)),
        locationDistanceKm: locationMatch.distanceKm,
        recommendationReasons: buildReasons({
          majorScore,
          stageScore,
          timelineScore,
          locationScore,
          locationDistanceKm: locationMatch.distanceKm,
          sizeScore: groupSizeScore,
          activityScore,
        }),
      };
    })
    .sort((left, right) => {
      if (right.recommendationScore !== left.recommendationScore) {
        return right.recommendationScore - left.recommendationScore;
      }

      if (right.isDefault !== left.isDefault) {
        return Number(right.isDefault) - Number(left.isDefault);
      }

      return left.name.localeCompare(right.name);
    });
}