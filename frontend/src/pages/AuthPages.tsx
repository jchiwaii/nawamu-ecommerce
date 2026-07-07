import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { Field } from "../components/forms";
import { PageHero } from "../components/PageHero";
import { useAuth } from "../state/auth";
import { Link, useRouter } from "../state/router";

export function LoginPage() {
  const [error, setError] = useState("");
  const { refreshUser } = useAuth();
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.login(String(form.get("email")), String(form.get("password")));
      await refreshUser();
      router.navigate("/cart");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  }

  return (
    <>
      <PageHero eyebrow="Login" title="Continue your buying path." copy="Login before checkout so cart, orders, favorites, and support stay connected." />
      <form className="auth-card" onSubmit={submit}>
        <Field label="Email" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required />
        <button className="button primary full">Login</button>
        {error ? <p className="inline-status error-text">{error}</p> : null}
        <p>New here? <Link to="/register">Create account</Link></p>
      </form>
    </>
  );
}

export function RegisterPage() {
  const [error, setError] = useState("");
  const { refreshUser } = useAuth();
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.register({
        email: String(form.get("email")),
        password: String(form.get("password")),
        full_name: String(form.get("full_name")),
        phone: String(form.get("phone")),
      });
      await refreshUser();
      router.navigate("/shop");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    }
  }

  return (
    <>
      <PageHero eyebrow="Register" title="Create a Nawamu account." copy="Your account unlocks checkout, order tracking, favorites, reviews, and support tickets." />
      <form className="auth-card" onSubmit={submit}>
        <Field label="Full name" name="full_name" required />
        <Field label="Phone" name="phone" required />
        <Field label="Email" name="email" type="email" required />
        <Field label="Password" name="password" type="password" minLength={8} required />
        <button className="button primary full">Create account</button>
        {error ? <p className="inline-status error-text">{error}</p> : null}
        <p>Already registered? <Link to="/login">Login</Link></p>
      </form>
    </>
  );
}
