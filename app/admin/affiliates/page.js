"use client";

import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "../../../lib/useAdminAuth";
import AdminNav from "../../../components/AdminNav";
import AdminLoginForm from "../../../components/AdminLoginForm";

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AffiliatesDashboard() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [promoterName, setPromoterName] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const copyTimeoutRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(copyTimeoutRef.current);
  }, []);

  async function copyLink(c) {
    const link = `${process.env.NEXT_PUBLIC_SITE_URL}/?ref=${c.code}`;
    try {
      await navigator.clipboard.writeText(link);
      clearTimeout(copyTimeoutRef.current);
      setCopiedId(c.id);
      copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard unavailable — no popup per spec, just silently no-op
    }
  }

  async function load() {
    setLoading(true);
    setLoadError("");
    const res = await fetch(`/api/admin/affiliates?_=${Date.now()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) {
      setCodes(data.codes || []);
    } else {
      setLoadError(data.error || "Could not load affiliate codes.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    const res = await fetch("/api/admin/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, promoterName, discountPercent }),
    });
    const data = await res.json();
    setCreating(false);
    if (res.ok) {
      setCode("");
      setPromoterName("");
      setDiscountPercent("");
      load();
    } else {
      setCreateError(data.error || "Could not create code.");
    }
  }

  async function toggleActive(c) {
    setBusyId(c.id);
    await fetch("/api/admin/affiliates/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, active: !c.active }),
    });
    setBusyId(null);
    load();
  }

  return (
    <div className="admin-shell">
      <div className="wrap" style={{ maxWidth: 900 }}>
        <div className="eyebrow">Admin</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="h2" style={{ fontSize: 26, margin: 0 }}>
            Affiliates
          </h2>
          <button className="export-btn" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <AdminNav active="affiliates" />

        <form
          onSubmit={handleCreate}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: 28,
          }}
        >
          <input
            placeholder="Code (e.g. JESS10)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            style={affiliateInputStyle}
          />
          <input
            placeholder="Promoter name"
            value={promoterName}
            onChange={(e) => setPromoterName(e.target.value)}
            required
            style={affiliateInputStyle}
          />
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            placeholder="Discount % / ticket"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            style={{ ...affiliateInputStyle, width: 160 }}
          />
          <button type="submit" className="btn-glossy" disabled={creating} style={{ padding: "10px 20px" }}>
            {creating ? "Adding…" : "Add code"}
          </button>
        </form>
        {createError && (
          <p className="fine-print" style={{ color: "#c0392b", marginTop: -18 }}>
            {createError}
          </p>
        )}

        {loadError && (
          <p className="fine-print" style={{ color: "#c0392b" }}>
            {loadError}
          </p>
        )}

        {loading ? (
          <p className="fine-print">Loading…</p>
        ) : loadError ? null : codes.length === 0 ? (
          <p className="fine-print">No affiliate codes yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Promoter</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Clicks</th>
                <th>Tickets</th>
                <th>Conversion</th>
                <th>Revenue</th>
                <th>Discount given</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className={!c.active ? "revoked" : ""}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {c.code}
                      <button
                        type="button"
                        className="copy-link-btn"
                        aria-label={`Copy referral link for ${c.code}`}
                        onClick={() => copyLink(c)}
                      >
                        {copiedId === c.id ? <CheckIcon /> : <CopyIcon />}
                      </button>
                    </span>
                  </td>
                  <td>{c.promoter_name}</td>
                  <td>{c.discount_percent}%</td>
                  <td>
                    <span className={`badge ${c.active ? "valid" : "no"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{c.clickCount}</td>
                  <td>{c.ticketCount}</td>
                  <td>
                    {c.conversionRate === null
                      ? "—"
                      : `${c.conversionRate.toFixed(0)}%`}
                  </td>
                  <td>${(c.revenueCents / 100).toFixed(0)}</td>
                  <td>${(c.discountCents / 100).toFixed(0)}</td>
                  <td>
                    <button
                      className="revoke-btn"
                      disabled={busyId === c.id}
                      onClick={() => toggleActive(c)}
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const affiliateInputStyle = {
  padding: 12,
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  background: "#ffffff",
  color: "#000000",
  fontFamily: "var(--mono)",
  flex: "1 1 180px",
};

export default function AffiliatesPage() {
  const { loggedIn, checked, setLoggedIn } = useAdminAuth("/api/admin/affiliates");

  if (!checked) return null;
  return loggedIn ? (
    <AffiliatesDashboard />
  ) : (
    <AdminLoginForm title="Affiliates" onLoggedIn={() => setLoggedIn(true)} />
  );
}
