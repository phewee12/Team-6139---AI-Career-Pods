import { useState } from "react";
import { usePodAccountability } from "../hooks/usePodAccountability";
import AccountabilityScorecard from "./AccountabilityScorecard";
import NudgeComposer from "./NudgeComposer";
import NudgeHistoryPanel from "./NudgeHistoryPanel";
import PodMembersList from "./PodMembersList";
import QuietModeControl from "./QuietModeControl";

export default function MembersFeatureSection({ podId, user, currentMembershipRole }) {
  const {
    state,
    loading,
    error,
    sendNudge,
    respondToNudge,
    updateQuietMode,
  } = usePodAccountability(podId, user);
  const [nudgeRecipient, setNudgeRecipient] = useState(null);
  const [sending, setSending] = useState(false);
  const [respondBusy, setRespondBusy] = useState(false);

  async function handleSendNudge(payload) {
    if (!nudgeRecipient) return;
    setSending(true);
    try {
      await sendNudge({
        toUserId: nudgeRecipient.id,
        toName: nudgeRecipient.fullName || nudgeRecipient.email,
        message: payload.message,
        templateId: payload.templateId,
      });
    } finally {
      setSending(false);
    }
  }

  async function handleRespond(nudgeId, quickReplyId) {
    setRespondBusy(true);
    try {
      await respondToNudge(nudgeId, quickReplyId);
    } finally {
      setRespondBusy(false);
    }
  }

  return (
    <div className="members-feature-section">
      {error && <p className="error-banner">{error}</p>}

      <div className="members-accountability-grid">
        <AccountabilityScorecard scorecard={state?.scorecard} loading={loading} />
        <QuietModeControl user={user} quietMode={state?.quietMode} onSave={updateQuietMode} loading={loading} />
      </div>

      <PodMembersList
        podId={podId}
        currentUser={user}
        currentMembershipRole={currentMembershipRole}
        eligibility={state?.eligibility}
        accountabilityLoading={loading}
        onRequestNudge={(member) => setNudgeRecipient(member)}
      />

      <NudgeHistoryPanel
        history={state?.history}
        loading={loading}
        onRespond={handleRespond}
        respondBusy={respondBusy}
      />

      <NudgeComposer
        open={Boolean(nudgeRecipient)}
        recipient={nudgeRecipient}
        onClose={() => setNudgeRecipient(null)}
        onSend={handleSendNudge}
        busy={sending}
      />
    </div>
  );
}
