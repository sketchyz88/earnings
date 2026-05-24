function StatCard({ label, value, note }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <h3>{value}</h3>
      <p className="stat-note">{note}</p>
    </article>
  );
}

export default StatCard;
