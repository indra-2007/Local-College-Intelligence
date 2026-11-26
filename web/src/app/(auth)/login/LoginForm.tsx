"use client";

import TitleLetters from "@/components/TitleLetters";
import { useState, type FormEvent } from "react";
import { clearActiveThread } from "@/lib/conversations";
import styles from "./entry.module.css";

type Field = "email" | "captcha" | "password";
type LoginError = { field?: Field; message: string };

export default function LoginForm({
  captchaCode,
  expired,
  onSuccess,
}: {
  captchaCode: string;
  expired?: boolean;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<LoginError | null>(
    expired ? { message: "Your session expired. Sign in again." } : null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    function reject(field: Field, message: string) {
      setError({ field, message });
      const input = form.elements.namedItem(field);
      if (input instanceof HTMLInputElement) input.focus();
    }

    if (!email.endsWith("@rvce.edu.in")) {
      return reject("email", "Only @rvce.edu.in emails are allowed.");
    }
    if (data.get("captcha") !== captchaCode) {
      return reject("captcha", "Incorrect CAPTCHA code.");
    }
    if (password.length < 6) {
      return reject("password", "Invalid password. Use at least 6 characters.");
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        return reject("password", body?.detail || "Invalid email or password.");
      }
      clearActiveThread(body?.user?.id);
      clearActiveThread();
      form.reset();
      onSuccess();
    } catch {
      setBusy(false);
      setError({
        message: "Authentication service unavailable. Check the local FastAPI connection.",
      });
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} method="post" aria-labelledby="sign-in-heading">
      <div className={styles.formKicker}><i aria-hidden="true" />Institutional session</div>
      <h2 id="sign-in-heading" aria-label="Institutional access"><TitleLetters text="Institutional access" /></h2>
      <p className={styles.formIntro}>Sign in with your RVCE account.</p>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="email">College email</label>
          <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none"
            spellCheck={false} required placeholder="student@rvce.edu.in" disabled={busy}
            aria-invalid={error?.field === "email" || undefined}
            aria-describedby={error?.field === "email" ? "login-error" : undefined} />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <div className={styles.passwordField}>
            <input id="password" name="password" type={showPassword ? "text" : "password"}
              autoComplete="current-password" required placeholder="Enter your password" disabled={busy}
              aria-invalid={error?.field === "password" || undefined}
              aria-describedby={error?.field === "password" ? "login-error" : undefined} />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="captcha">Verification code</label>
          <div className={styles.challengeRow}>
            <span className={styles.challenge} aria-hidden="true">{captchaCode}</span>
            <span className={styles.srOnly} id="displayed-code">Displayed code: {captchaCode.split("").join(" ")}.</span>
            <input id="captcha" name="captcha" type="text" inputMode="numeric" autoComplete="off"
              spellCheck={false} required placeholder="Type the code" disabled={busy}
              aria-invalid={error?.field === "captcha" || undefined}
              aria-describedby={error?.field === "captcha" ? "displayed-code login-error" : "displayed-code"} />
          </div>
        </div>
      </div>
      {error && <p id="login-error" className={styles.error} role="alert">{error.message}</p>}
      <button type="submit" className={styles.signIn} disabled={busy}>
        <span className={styles.keyIcon} aria-hidden="true" />{busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
