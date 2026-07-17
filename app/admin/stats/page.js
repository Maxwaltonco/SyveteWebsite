"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../../../lib/useAdminAuth";
import AdminNav from "../../../components/AdminNav";
import AdminLoginForm from "../../../components/AdminLoginForm";

function StatsDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  async function load() {
    setLoadError("");
    const res = await fetch(`/api/admin/stats?_=${Date.now()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) {
      setStats(data);
    } else {
      setLoadError(data.error || "Could not load stats.");
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

  return (
    <div className="admin-shell">
      <div className="wrap" style={{ maxWidth: 900 }}>
        <div className="eyebrow">Admin</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="h2" style={{ fontSize: 26, margin: 0 }}>
            Stats
          </h2>
          <button className="export-btn" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <AdminNav active="stats" />

        {loadError && (
          <p className="fine-print" style={{ color: "#c0392b" }}>
            {loadError}
          </p>
        )}

        {loading ? (
          <p className="fine-print">Loading…</p>
        ) : !stats ? null : (
          <>
            <h3 className="h2" style={{ fontSize: 18, marginBottom: 8 }}>
              Sales velocity
            </h3>
            <div className="stat-row" style={{ marginBottom: 12 }}>
              <div className="stat">
                <div className="num">{stats.velocity.last24h}</div>
                <div className="label">Last 24h</div>
              </div>
              <div className="stat">
                <div className="num">{stats.velocity.prior24h}</div>
                <div className="label">Prior 24h</div>
              </div>
              <div className="stat">
                <div
                  className="num"
                  style={{
                    color: stats.velocity.deltaPct >= 0 ? "#1e7e34" : "#c0392b",
                  }}
                >
                  {stats.velocity.deltaPct >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(stats.velocity.deltaPct)}%
                </div>
                <div className="label">Vs prior 24h</div>
              </div>
            </div>
            {stats.daily.length > 0 && (
              <div style={{ overflowX: "auto", marginBottom: 32 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Tickets sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.daily.map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="h2" style={{ fontSize: 18, marginBottom: 8 }}>
              Group size distribution
            </h3>
            <div style={{ overflowX: "auto", marginBottom: 32 }}>
              <table>
                <thead>
                  <tr>
                    <th>Group size</th>
                    <th>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {["1", "2", "3", "4+"].map((size) => (
                    <tr key={size}>
                      <td>{size} {size === "1" ? "ticket" : "tickets"}</td>
                      <td>{stats.groupSizes[size]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="h2" style={{ fontSize: 18, marginBottom: 8 }}>
              Net revenue
            </h3>
            <div className="stat-row" style={{ marginBottom: 8 }}>
              <div className="stat">
                <div className="num">
                  ${(stats.revenue.netCents / 100).toFixed(0)}
                </div>
                <div className="label">Net revenue</div>
              </div>
            </div>
            <p className="fine-print" style={{ marginBottom: 32 }}>
              Gross (approved + revoked): $
              {(stats.revenue.grossCents / 100).toFixed(0)} — Refunded: $
              {(stats.revenue.refundedCents / 100).toFixed(0)}
            </p>

            <h3 className="h2" style={{ fontSize: 18, marginBottom: 8 }}>
              Lead-to-purchase conversion
            </h3>
            <p className="fine-print" style={{ marginBottom: 32 }}>
              {stats.conversion.converted} of {stats.conversion.totalLeads}{" "}
              leads converted
              {stats.conversion.totalLeads > 0
                ? ` (${Math.round(
                    (stats.conversion.converted / stats.conversion.totalLeads) * 100
                  )}%)`
                : ""}
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { loggedIn, checked, setLoggedIn } = useAdminAuth("/api/admin/stats");

  if (!checked) return null;
  return loggedIn ? (
    <StatsDashboard />
  ) : (
    <AdminLoginForm title="Stats" onLoggedIn={() => setLoggedIn(true)} />
  );
}
