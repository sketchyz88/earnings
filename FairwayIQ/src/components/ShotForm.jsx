import { useMemo, useState } from "react";

const clubOptions = ["Driver", "3 Wood", "5 Wood", "Hybrid", "4 Iron", "5 Iron", "6 Iron", "7 Iron", "8 Iron", "9 Iron", "PW", "GW", "SW", "LW", "Putter"];
const lieOptions = ["Tee", "Fairway", "Rough", "Sand", "Recovery", "Green"];
const resultOptions = ["Fairway", "Green", "Rough", "Bunker", "Penalty", "Holed", "Miss"];

function ShotForm({ rounds, selectedRoundId, onSelectRound, onSaveShot, busy }) {
  const [form, setForm] = useState({
    holeNumber: 1,
    shotNumber: 1,
    club: "Driver",
    distanceYards: 265,
    lie: "Tee",
    result: "Fairway",
    locationLabel: "Center fairway",
  });

  const hasRounds = rounds.length > 0;
  const activeRound = rounds.find((round) => round.id === selectedRoundId) || rounds[0];
  const roundId = activeRound?.id || "";

  const summary = useMemo(
    () => `${form.club} • ${form.distanceYards} yds • ${form.result}`,
    [form.club, form.distanceYards, form.result],
  );

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!roundId) {
      return;
    }

    await onSaveShot({
      roundId,
      holeNumber: Number(form.holeNumber),
      shotNumber: Number(form.shotNumber),
      club: form.club,
      distanceYards: Number(form.distanceYards),
      lie: form.lie,
      result: form.result,
      locationLabel: form.locationLabel.trim(),
    });
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Shot Tracking</p>
          <h2>Log every shot</h2>
        </div>
        <span className="pill">{summary}</span>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Round</span>
          <select value={roundId} onChange={(event) => onSelectRound(event.target.value)} disabled={!hasRounds}>
            {hasRounds ? (
              rounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.title}
                </option>
              ))
            ) : (
              <option value="">Create a round first</option>
            )}
          </select>
        </label>

        <div className="grid-two">
          <label className="field">
            <span>Hole</span>
            <input
              type="number"
              min="1"
              max="18"
              value={form.holeNumber}
              onChange={(event) => updateField("holeNumber", event.target.value)}
            />
          </label>
          <label className="field">
            <span>Shot #</span>
            <input
              type="number"
              min="1"
              max="15"
              value={form.shotNumber}
              onChange={(event) => updateField("shotNumber", event.target.value)}
            />
          </label>
        </div>

        <div className="grid-two">
          <label className="field">
            <span>Club</span>
            <select value={form.club} onChange={(event) => updateField("club", event.target.value)}>
              {clubOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Distance</span>
            <input
              type="number"
              min="1"
              max="450"
              value={form.distanceYards}
              onChange={(event) => updateField("distanceYards", event.target.value)}
            />
          </label>
        </div>

        <div className="grid-two">
          <label className="field">
            <span>Location</span>
            <select value={form.lie} onChange={(event) => updateField("lie", event.target.value)}>
              {lieOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Result</span>
            <select value={form.result} onChange={(event) => updateField("result", event.target.value)}>
              {resultOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Notes / location detail</span>
          <input
            value={form.locationLabel}
            onChange={(event) => updateField("locationLabel", event.target.value)}
            placeholder="Right edge rough"
          />
        </label>

        <button className="primary-button" type="submit" disabled={!hasRounds || busy}>
          {busy ? "Saving..." : "Save Shot"}
        </button>
      </form>
    </section>
  );
}

export default ShotForm;
