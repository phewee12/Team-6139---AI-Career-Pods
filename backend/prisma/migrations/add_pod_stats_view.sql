CREATE MATERIALIZED VIEW pod_stats AS
SELECT
    p.id AS pod_id,
    DATE_TRUNC('week', ci.created_at) AS week_start,
    COUNT(DISTINCT ci.user_id) AS active_members,
    COUNT(ci.id) AS total_checkins,
    AVG(CASE
            WHEN ci.status = 'COMPLETED' THEN 1
            ELSE 0
        END) * 100 AS completion_rate,
    SUM(CASE WHEN ci.progress_status = 'on-track' THEN 1 ELSE 0 END) AS on_track_count,
    SUM(CASE WHEN ci.progress_status = 'stuck' THEN 1 ELSE 0 END) AS stuck_count,
    SUM(CASE WHEN ci.progress_status = 'need-help' THEN 1 ELSE 0 END) AS need_help_count,
    COUNT(r.id) AS total_reflections,
    AVG(rs.score) AS avg_sentiment_score,
    COUNT(c.id) AS total_celebrations
FROM "Pod" p
         LEFT JOIN "PodCheckIn" ci ON ci."podId" = p.id
         LEFT JOIN "PodReflection" r ON r."podId" = p.id AND DATE_TRUNC('week', r."createdAt") = DATE_TRUNC('week', ci."createdAt")
         LEFT JOIN "ReflectionSentiment" rs ON rs."reflectionId" = r.id
         LEFT JOIN "PodCelebration" c ON c."podId" = p.id AND DATE_TRUNC('week', c."createdAt") = DATE_TRUNC('week', ci."createdAt")
GROUP BY p.id, DATE_TRUNC('week', ci.created_at);

CREATE INDEX idx_pod_stats_pod_week ON pod_stats(pod_id, week_start);

CREATE OR REPLACE FUNCTION refresh_pod_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY pod_stats;
RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_pod_stats_on_checkin
    AFTER INSERT OR UPDATE OR DELETE ON "PodCheckIn"
    EXECUTE FUNCTION refresh_pod_stats();

CREATE TRIGGER refresh_pod_stats_on_reflection
    AFTER INSERT OR UPDATE OR DELETE ON "PodReflection"
    EXECUTE FUNCTION refresh_pod_stats();

CREATE TRIGGER refresh_pod_stats_on_celebration
    AFTER INSERT OR UPDATE OR DELETE ON "PodCelebration"
    EXECUTE FUNCTION refresh_pod_stats();