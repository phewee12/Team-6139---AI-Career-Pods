export default function AccountabilityScorecard({ scorecard, loading }) {
  if (loading) {
    return (
      <article className="detail-card accountability-scorecard">
        <p className="helper-copy">Loading your accountability snapshot…</p>
      </article>
    );
  }

  const received = scorecard?.nudgesReceivedThisMonth ?? 0;
  const sent = scorecard?.nudgesSentThisMonth ?? 0;

  return (
    <article className="detail-card accountability-scorecard" aria-label="Your private accountability scorecard">
      <h2 className="scorecard-heading">Your month so far</h2>
      <p className="helper-copy scorecard-privacy">Only you can see this summary.</p>
      <ul className="scorecard-list">
        <li>
          <span className="scorecard-stat">{received}</span>
          <span className="scorecard-copy">
            {received === 0
              ? "No nudges received yet this month — your pod is here when you need them."
              : received === 1
                ? "nudge you've received — your pod cares about you!"
                : "nudges you've received — your pod cares about you!"}
          </span>
        </li>
        <li>
          <span className="scorecard-stat">{sent}</span>
          <span className="scorecard-copy">
            {sent === 0
              ? "You have not sent nudges yet — a quick check-in can brighten someone's week."
              : sent === 1
                ? "nudge you've sent — you're a great supporter!"
                : "nudges you've sent — you're a great supporter!"}
          </span>
        </li>
      </ul>
    </article>
  );
}
