function RoundsList({ rounds, activeRoundId, onSelect }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Rounds</p>
          <h2>Recent play</h2>
        </div>
        <span className="pill">{rounds.length} total</span>
      </div>

      <div className="stack compact">
        {rounds.length ? (
          rounds.map((round) => (
            <button
              key={round.id}
              type="button"
              className={round.id === activeRoundId ? "list-card active" : "list-card"}
              onClick={() => onSelect(round.id)}
            >
              <div>
                <h3>{round.title}</h3>
                <p>
                  {round.course_name} • {round.tee_name}
                </p>
              </div>
              <span>{round.played_on}</span>
            </button>
          ))
        ) : (
          <div className="empty-state">No rounds yet. Start one to track shots and stats.</div>
        )}
      </div>
    </section>
  );
}

export default RoundsList;
