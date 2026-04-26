import { useEffect, useMemo, useState } from "react";
import {
  generateBiweeklySummary,
  getBiweeklySummary,
  getBiweeklySummaryPeriods,
} from "../api/client";

function formatWindowLabel(windowStartAt, windowEndAt) {
  const start = new Date(windowStartAt);
  const end = new Date(windowEndAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Unknown period";
  }

  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} - ${endLabel}`;
}

function formatGeneratedAt(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BiweeklySummaryPanel({ podId }) {
  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [selectedWindowStart, setSelectedWindowStart] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPeriods() {
    setPeriodsLoading(true);
    setError("");

    try {
      const result = await getBiweeklySummaryPeriods(podId);
      const nextPeriods = result.periods || [];
      setPeriods(nextPeriods);

      if (nextPeriods.length === 0) {
        setSelectedWindowStart(null);
        setSummary(null);
        return;
      }

      setSelectedWindowStart((current) => {
        if (current && nextPeriods.some((period) => period.windowStartAt === current)) {
          return current;
        }
        return nextPeriods[0].windowStartAt;
      });
    } catch (loadError) {
      setError(loadError.message || "Could not load summary periods.");
      setPeriods([]);
      setSelectedWindowStart(null);
      setSummary(null);
    } finally {
      setPeriodsLoading(false);
    }
  }

  async function loadSummary(windowStartAt) {
    if (!windowStartAt) {
      setSummary(null);
      return;
    }

    setSummaryLoading(true);
    setError("");

    try {
      const result = await getBiweeklySummary(podId, windowStartAt);
      setSummary(result.summary || null);
    } catch (loadError) {
      if (loadError.status === 404) {
        setSummary(null);
      } else {
        setError(loadError.message || "Could not load summary.");
      }
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    loadPeriods();
  }, [podId]);

  useEffect(() => {
    loadSummary(selectedWindowStart);
  }, [podId, selectedWindowStart]);

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.windowStartAt === selectedWindowStart) || null,
    [periods, selectedWindowStart],
  );

  async function handleGenerate() {
    if (!selectedPeriod) {
      return;
    }

    setGenerateLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await generateBiweeklySummary(podId, selectedPeriod.windowStartAt);
      setSummary(result.summary || null);
      await loadPeriods();
      setMessage(result.generated ? "Summary generated." : "Summary already available for this period.");
    } catch (generateError) {
      setError(generateError.message || "Could not generate summary.");
    } finally {
      setGenerateLoading(false);
    }
  }

  return (
    <article className="detail-card biweekly-summary-card">
      <header className="feature-page-header">
        <h2>Bi-Weekly AI Summary</h2>
        <p className="helper-copy">
          Review period summaries generated from check-ins, reflections, celebrations, and posts.
        </p>
      </header>

      {message && <p className="success-toast">{message}</p>}
      {error && <p className="error-banner">{error}</p>}

      {periodsLoading ? (
        <p className="helper-copy">Loading summary periods...</p>
      ) : periods.length === 0 ? (
        <p className="helper-copy">No completed content windows yet. Add posts or rituals to unlock your first summary period.</p>
      ) : (
        <>
          <div className="summary-period-list" role="tablist" aria-label="Biweekly periods">
            {periods.map((period) => {
              const isSelected = selectedWindowStart === period.windowStartAt;
              const label = formatWindowLabel(period.windowStartAt, period.windowEndAt);

              return (
                <button
                  key={period.windowStartAt}
                  type="button"
                  className={isSelected ? "summary-period-pill active" : "summary-period-pill"}
                  onClick={() => setSelectedWindowStart(period.windowStartAt)}
                >
                  <span>{label}</span>
                  <small>
                    {period.hasSummary ? "Summary ready" : period.isExpired ? "Expired" : "Open window"}
                  </small>
                </button>
              );
            })}
          </div>

          {selectedPeriod && (
            <div className="summary-period-meta">
              <p className="helper-copy">
                Sources: {selectedPeriod.sourceCounts?.checkIns || 0} check-ins, {selectedPeriod.sourceCounts?.reflections || 0} reflections, {selectedPeriod.sourceCounts?.celebrations || 0} celebrations, {selectedPeriod.sourceCounts?.posts || 0} posts
              </p>
              <button
                type="button"
                className="secondary-action"
                onClick={handleGenerate}
                disabled={
                  generateLoading ||
                  selectedPeriod.isExpired ||
                  !selectedPeriod.canGenerate
                }
              >
                {generateLoading
                  ? "Generating..."
                  : selectedPeriod.hasSummary
                    ? "Regenerate Summary"
                    : "Generate Summary"}
              </button>
            </div>
          )}

          <section className="summary-output-card">
            {summaryLoading ? (
              <p className="helper-copy">Loading summary...</p>
            ) : summary ? (
              <>
                <p className="helper-copy summary-generated-at">
                  Generated {formatGeneratedAt(summary.createdAt)}
                </p>
                <pre className="summary-output-text">{summary.summaryText}</pre>
              </>
            ) : (
              <p className="helper-copy">No summary has been generated for this period yet.</p>
            )}
          </section>
        </>
      )}
    </article>
  );
}
