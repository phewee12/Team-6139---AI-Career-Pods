import { useCallback, useEffect, useState } from "react";
import {
  getPodAccountability,
  getPodMembers,
  respondToPodNudge,
  sendPodNudge,
  setPodQuietMode,
} from "../api/client";
import {
  appendLocalSentNudge,
  buildDemoEligibility,
  loadLocalAccountability,
  recordLocalNudgeResponse,
  setLocalQuietMode,
} from "../lib/accountabilityStorage";
import { NUDGE_QUICK_REPLIES } from "../constants/accountability";

function monthBucket(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function scorecardFromHistory(history) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${now.getMonth()}`;
  const sent = history?.sent || [];
  const received = history?.received || [];
  return {
    nudgesSentThisMonth: sent.filter((h) => monthBucket(h.sentAt) === ym).length,
    nudgesReceivedThisMonth: received.filter((h) => monthBucket(h.sentAt) === ym).length,
  };
}

function normalizeServerPayload(payload, members, currentUserId) {
  const eligibility =
    payload?.eligibility && Object.keys(payload.eligibility).length > 0
      ? payload.eligibility
      : buildDemoEligibility(members, currentUserId);
  const history = payload?.history || { sent: [], received: [] };
  const scorecard =
    payload?.scorecard?.nudgesSentThisMonth != null
      ? payload.scorecard
      : scorecardFromHistory(history);
  return {
    eligibility,
    scorecard,
    quietMode: payload?.quietMode || { enabled: false, until: null, announcedToPod: true },
    history,
  };
}

export function usePodAccountability(podId, currentUser) {
  const currentUserId = currentUser?.id;
  const [members, setMembers] = useState([]);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!podId || !currentUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const membersResult = await getPodMembers(podId);
      const list = membersResult.members || [];
      setMembers(list);

      try {
        const payload = await getPodAccountability(podId);
        setState(normalizeServerPayload(payload, list, currentUserId));
      } catch (err) {
        if (err.status === 404 || err.status === 501) {
          const local = loadLocalAccountability(podId);
          const history = local.history || { sent: [], received: [] };
          setState({
            eligibility: buildDemoEligibility(list, currentUserId),
            scorecard: scorecardFromHistory(history),
            quietMode: local.quietMode || { enabled: false, until: null, announcedToPod: true },
            history,
          });
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(err.message || "Could not load accountability.");
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [podId, currentUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendNudge = useCallback(
    async ({ toUserId, toName, message, templateId }) => {
      const preview = message.slice(0, 120);
      try {
        await sendPodNudge(podId, {
          toUserId,
          message,
          templateId: templateId || undefined,
        });
      } catch (err) {
        if (err.status === 404 || err.status === 501) {
          appendLocalSentNudge(podId, {
            toUserId,
            toName,
            preview,
            templateId,
          });
        } else {
          throw err;
        }
      }
      await refresh();
    },
    [podId, refresh],
  );

  const respondToNudge = useCallback(
    async (nudgeId, quickReplyId) => {
      const reply = NUDGE_QUICK_REPLIES.find((r) => r.id === quickReplyId);
      const label = reply?.label || quickReplyId;
      try {
        await respondToPodNudge(podId, nudgeId, { quickReplyId });
      } catch (err) {
        if (err.status === 404 || err.status === 501) {
          recordLocalNudgeResponse(podId, nudgeId, quickReplyId, label);
        } else {
          throw err;
        }
      }
      await refresh();
    },
    [podId, refresh],
  );

  const updateQuietMode = useCallback(
    async (next) => {
      try {
        await setPodQuietMode(podId, next);
      } catch (err) {
        if (err.status === 404 || err.status === 501) {
          setLocalQuietMode(podId, next);
        } else {
          throw err;
        }
      }
      await refresh();
    },
    [podId, refresh],
  );

  return {
    members,
    state,
    loading,
    error,
    refresh,
    sendNudge,
    respondToNudge,
    updateQuietMode,
  };
}
