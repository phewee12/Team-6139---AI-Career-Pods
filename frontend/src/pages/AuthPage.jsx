import { useMemo, useState } from "react";
import { getGoogleAuthUrl, loginUser, registerUser } from "../api/client";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("register");
  const [form, setForm] = useState(initialForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const title = useMemo(
    () => (mode === "register" ? "Create your account" : "Welcome back"),
    [mode],
  );

  const submitLabel = mode === "register" ? "Create account" : "Sign in";
  const passwordsMatch = form.password === form.confirmPassword;
  const canSubmit = mode === "register" ? passwordsMatch && form.confirmPassword.length > 0 : true;

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (mode === "register" && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);

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
          <p className="eyebrow">Qwyse</p>
          <h1>{title}</h1>
          <p>Join Qwyse to explore focused groups and build momentum in your career journey.</p>
        </header>

        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={mode === "register" ? "mode-switch-btn mode-register active" : "mode-switch-btn mode-register"}
            onClick={() => setMode("register")}
          >
            Register
          </button>
          <button
            type="button"
            className={mode === "login" ? "mode-switch-btn mode-login active" : "mode-switch-btn mode-login"}
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
            <div className="password-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={form.password}
                onChange={updateField}
                minLength={8}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {mode === "register" && (
            <label>
              Confirm password
              <div className="password-input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={updateField}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          )}

          {error && <p className="error-banner">{error}</p>}

          <button type="submit" className="primary" disabled={pending || !canSubmit}>
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
