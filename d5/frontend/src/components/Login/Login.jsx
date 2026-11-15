import { useState } from "react";
import { client } from "../../api.js";
import Icon from "../Icon/Icon.jsx";

// D9: e-mail + password login. The server returns a signed JWT with the role.
export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await client.post("/login", { email, password });
      setPassword("");
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="dashboard login-page">
      <section className="panel login-panel">
        <div className="panel-heading">
          <h2>Sign in to ROSCA</h2>
          <Icon name="logo" />
        </div>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit">{busy ? "Signing in…" : "Sign in"}</button>
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
