import { useState } from "react";

const initialForm = {
  displayName: "",
  email: "",
  password: "",
};

function AuthScreen({ loading, error, message, onSignIn, onSignUp }) {
  const [mode, setMode] = useState("signIn");
  const [form, setForm] = useState(initialForm);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (mode === "signIn") {
      await onSignIn({
        email: form.email.trim(),
        password: form.password,
      });
      return;
    }

    await onSignUp({
      displayName: form.displayName.trim(),
      email: form.email.trim(),
      password: form.password,
    });
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">FairwayIQ</p>
        <p className="maker-line">by ifonlyicouldputt</p>
        <h1>Smarter shot tracking for every round.</h1>
        <p className="auth-copy">
          Sign in to track rounds, log every shot, upload swings, and keep your stats synced with
          Supabase.
        </p>

        <div className="segmented">
          <button
            type="button"
            className={mode === "signIn" ? "segment active" : "segment"}
            onClick={() => setMode("signIn")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={mode === "signUp" ? "segment active" : "segment"}
            onClick={() => setMode("signUp")}
          >
            Create Account
          </button>
        </div>

        {error ? <div className="notice error">{error}</div> : null}
        {message ? <div className="notice success">{message}</div> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signUp" ? (
            <label className="field">
              <span>Name</span>
              <input
                value={form.displayName}
                onChange={(event) => updateField("displayName", event.target.value)}
                placeholder="Jordan"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              required
            />
          </label>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Working..." : mode === "signIn" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default AuthScreen;
