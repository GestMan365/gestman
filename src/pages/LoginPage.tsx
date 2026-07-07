import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("admin@gestman365.local");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  if (isAuthenticated) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await login({ email, password });
    } catch {
      setError("Nao foi possivel acessar o sistema.");
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <strong className="login-logo">GESTMAN365</strong>
        <p>Base CMMS/EAM modular com rotas protegidas.</p>
        <label>
          E-mail
          <input value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        <label>
          Senha
          <input type="password" value={password} onChange={event => setPassword(event.target.value)} />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <button className="btn primary" type="submit">Entrar</button>
      </form>
    </main>
  );
}
