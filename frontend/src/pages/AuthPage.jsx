import { useMemo, useState } from "react";
import { getGoogleAuthUrl, loginUser, registerUser } from "../api/client";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
};

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("register");
  const [form, setForm] = useState(initialForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(
    () => (mode === "register" ? "Create your account" : "Welcome back"),
    [mode],
  );

  const submitLabel = mode === "register" ? "Create account" : "Sign in";

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const payload = {
        email: form.email,
        password: form.password,
      };

      let result;
      if (mode === "register") {
        result = await registerUser({ ...payload, fullName: form.fullName || undefined });
      } else {
        result = await loginUser(payload);
      }

      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message || "Could not complete authentication.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <header className="auth-header">
          <p className="eyebrow">qwyse</p>
          <h1>{title}</h1>
          <p>Join qwyse to explore focused groups and build momentum in your career journey.</p>
        </header>

        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                name="fullName"
                autoComplete="name"
                value={form.fullName}
                onChange={updateField}
                minLength={2}
                maxLength={60}
                required
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={form.password}
              onChange={updateField}
              minLength={8}
              required
            />
          </label>

          {error && <p className="error-banner">{error}</p>}

          <button type="submit" className="primary" disabled={pending}>
            {pending ? "Please wait..." : submitLabel}
          </button>
        </form>

        <div className="oauth-row">
          <span />
          <p>or</p>
          <span />
        </div>

        <a className="google-button" href={getGoogleAuthUrl()}>
          Continue with Google
        </a>

        <p className="footnote">
          LinkedIn OAuth is scheduled for Sprint 2.
        </p>
      </section>
    </main>
  );
}
