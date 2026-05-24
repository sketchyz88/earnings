import { useMemo, useState } from "react";

const courseOptions = [
  "Pebble Beach Golf Links",
  "Torrey Pines South",
  "Bandon Dunes",
  "Bethpage Black",
  "Practice Session",
];

function RoundForm({ onCreateRound, busy }) {
  const [form, setForm] = useState({
    title: "",
    courseName: courseOptions[0],
    teeName: "Blue",
    date: new Date().toISOString().slice(0, 10),
  });

  const summary = useMemo(() => `${form.courseName} • ${form.teeName} tees`, [form]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onCreateRound({
      title: form.title.trim() || `${form.courseName} Round`,
      courseName: form.courseName,
      teeName: form.teeName,
      playedOn: form.date,
    });
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Round Setup</p>
          <h2>Start a round</h2>
        </div>
        <span className="pill">{summary}</span>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Round name</span>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Saturday Morning Match"
          />
        </label>

        <label className="field">
          <span>Course</span>
          <select value={form.courseName} onChange={(event) => updateField("courseName", event.target.value)}>
            {courseOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="grid-two">
          <label className="field">
            <span>Tee</span>
            <input value={form.teeName} onChange={(event) => updateField("teeName", event.target.value)} />
          </label>

          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => updateField("date", event.target.value)}
            />
          </label>
        </div>

        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Creating..." : "Start Round"}
        </button>
      </form>
    </section>
  );
}

export default RoundForm;
