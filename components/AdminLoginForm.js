"use client";

import { useState } from "react";

export default function AdminLoginForm({ title, onLoggedIn }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      onLoggedIn();
    } else {
      setErr("Wrong password.");
    }
  }

  return (
    <div className="admin-shell">
      <form className="admin-login" onSubmit={submit}>
        <div className="eyebrow">Admin</div>
        <h2 className="h2" style={{ fontSize: 22, margin: "8px 0" }}>
          {title}
        </h2>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {err && (
          <p className="fine-print" style={{ color: "#c0392b" }}>
            {err}
          </p>
        )}
        <button type="submit" className="btn-glossy" disabled={loading}>
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
