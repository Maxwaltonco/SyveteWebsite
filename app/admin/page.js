"use client";

import { useEffect, useState } from "react";
import { toCSV, downloadCSV } from "../../lib/csv";
import { useAdminAuth } from "../../lib/useAdminAuth";
import AdminNav from "../../components/AdminNav";
import AdminLoginForm from "../../components/AdminLoginForm";

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <polyline points="23 20 23 14 17 14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

// Cycled by first-appearance order across whatever order_id groups are on
// the current page of tickets — not tied to any particular order, just
// gives each group a distinct, consistent color for this render.
const GROUP_COLORS = [
  "#4a90d9",
  "#e07b39",
  "#5aa469",
  "#b05cc4",
  "#d9455f",
  "#c9a227",
];

function buildGroupColorMap(tickets) {
  const counts = {};
  tickets.forEach((t) => {
    if (t.order_id) counts[t.order_id] = (counts[t.order_id] || 0) + 1;
  });
  const colorMap = {};
  let i = 0;
  Object.keys(counts).forEach((id) => {
    if (counts[id] > 1) {
      colorMap[id] = GROUP_COLORS[i % GROUP_COLORS.length];
      i++;
    }
  });
  return colorMap;
}

// Keeps a group order's tickets sitting together in the list, instead of
// scattering wherever each individual row's own created_at happens to fall
// (e.g. a ticket added to an existing order later, or attendee rows with a
// slightly different timestamp than the buyer's). Groups (and standalone
// tickets) are still ordered newest-first overall, using the EARLIEST
// created_at in each group as its sort key; within a group, the buyer row
// (attendee_name null) leads, then guests in original creation order.
function sortForDisplay(tickets) {
  const groupEarliest = {};
  tickets.forEach((t) => {
    if (!t.order_id) return;
    const ts = new Date(t.created_at).getTime();
    if (groupEarliest[t.order_id] === undefined || ts < groupEarliest[t.order_id]) {
      groupEarliest[t.order_id] = ts;
    }
  });

  return [...tickets].sort((a, b) => {
    const aKey = a.order_id ? groupEarliest[a.order_id] : new Date(a.created_at).getTime();
    const bKey = b.order_id ? groupEarliest[b.order_id] : new Date(b.created_at).getTime();
    if (aKey !== bKey) return bKey - aKey;
    if (a.order_id && a.order_id === b.order_id) {
      if (!a.attendee_name !== !b.attendee_name) return a.attendee_name ? 1 : -1;
      return new Date(a.created_at) - new Date(b.created_at);
    }
    return 0;
  });
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [revokedCount, setRevokedCount] = useState(0);
  const [refundedCount, setRefundedCount] = useState(0);
  const [capacity, setCapacity] = useState(0);
  const [spotsLeft, setSpotsLeft] = useState(0);
  const [leadsCount, setLeadsCount] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("");
  const [exportingLeads, setExportingLeads] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [failedOrders, setFailedOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    // cache: "no-store" stops the browser from serving a cached response;
    // the timestamp param is belt-and-suspenders against any intermediary
    // (proxy, service worker) that keys on URL rather than cache headers.
    const res = await fetch(`/api/admin/tickets?_=${Date.now()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setTickets(sortForDisplay(data.tickets || []));
    setPendingCount(data.pendingCount || 0);
    setApprovedCount(data.approvedCount || 0);
    setRevokedCount(data.revokedCount || 0);
    setRefundedCount(data.refundedCount || 0);
    setCapacity(data.capacity || 0);
    setSpotsLeft(data.spotsLeft || 0);
    setLeadsCount(data.leadsCount || 0);

    const pendingRes = await fetch(`/api/admin/pending-orders?_=${Date.now()}`, {
      cache: "no-store",
    });
    const pendingData = await pendingRes.json();
    setPendingOrders(pendingData.pendingOrders || []);
    setFailedOrders(pendingData.failedOrders || []);
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function exportTickets() {
    const columns = [
      { key: "ticket_code", label: "Ticket Code" },
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "instagram_handle", label: "Instagram Handle" },
      { key: "age_confirmed", label: "18+ Confirmed" },
      { key: "quantity", label: "Quantity" },
      { key: "amount_paid_cents", label: "Amount Paid (cents)" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Created At" },
      { key: "revoked_at", label: "Revoked/Refunded At" },
      { key: "revoke_reason", label: "Revoke/Refund Reason" },
    ];
    downloadCSV(`tickets-export-${todayStamp()}.csv`, toCSV(columns, tickets));
  }

  async function exportLeads() {
    setExportingLeads(true);
    try {
      const res = await fetch("/api/admin/leads");
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to load leads.");
        return;
      }
      const columns = [
        { key: "email", label: "Email" },
        { key: "instagram_handle", label: "Instagram Handle" },
        { key: "created_at", label: "Created At" },
      ];
      downloadCSV(
        `leads-export-${todayStamp()}.csv`,
        toCSV(columns, data.leads || [])
      );
    } finally {
      setExportingLeads(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(ticket) {
    setBusyId(ticket.id);
    const res = await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id }),
    });
    setBusyId(null);
    if (res.ok) {
      load();
    } else {
      const d = await res.json();
      alert(d.error || "Failed to approve.");
    }
  }

  async function reinstate(ticket) {
    setBusyId(ticket.id);
    const res = await fetch("/api/admin/reinstate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: ticket.id }),
    });
    setBusyId(null);
    if (res.ok) {
      load();
    } else {
      const d = await res.json();
      alert(d.error || "Failed to reinstate.");
    }
  }

  async function revoke(ticket, withRefund) {
    const reason = window.prompt(
      `Reason for ${withRefund ? "revoking + refunding" : "revoking"} ${
        ticket.full_name || ticket.email
      }'s ticket? (shown in your own records only)`
    );
    if (reason === null) return; // cancelled
    setBusyId(ticket.id);
    const res = await fetch("/api/admin/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: ticket.id,
        reason,
        refund: withRefund,
      }),
    });
    setBusyId(null);
    if (res.ok) {
      load();
    } else {
      const d = await res.json();
      alert(d.error || "Failed to revoke.");
    }
  }

  const filtered = tickets.filter((t) => {
    const q = filter.toLowerCase();
    if (!q) return true;
    return (
      (t.full_name || "").toLowerCase().includes(q) ||
      (t.email || "").toLowerCase().includes(q) ||
      (t.instagram_handle || "").toLowerCase().includes(q) ||
      (t.ticket_code || "").toLowerCase().includes(q)
    );
  });

  const groupColors = buildGroupColorMap(tickets);

  return (
    <div className="admin-shell">
      <div className="wrap" style={{ maxWidth: 1100 }}>
        <div className="eyebrow">Admin</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="h2" style={{ fontSize: 26, margin: 0 }}>
            Guest list
          </h2>
          <button className="export-btn" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <AdminNav active="guest" />

        <div className="stat-row">
          <div className="stat">
            <div className="num">{pendingCount}</div>
            <div className="label">Pending approval</div>
          </div>
          <div className="stat">
            <div className="num">{approvedCount}</div>
            <div className="label">Approved</div>
          </div>
          <div className="stat">
            <div className="num">{revokedCount}</div>
            <div className="label">Revoked</div>
          </div>
          <div className="stat">
            <div className="num">{refundedCount}</div>
            <div className="label">Refunded</div>
          </div>
          <div className="stat">
            <div className="num">{spotsLeft}</div>
            <div className="label">Spots left of {capacity}</div>
          </div>
          <div className="stat">
            <div className="num">{leadsCount}</div>
            <div className="label">Leads collected</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="export-btn" onClick={exportTickets}>
            Export tickets
          </button>
          <button
            className="export-btn"
            onClick={exportLeads}
            disabled={exportingLeads}
          >
            {exportingLeads ? "Exporting…" : "Export leads"}
          </button>
        </div>

        <input
          placeholder="Search name, email, Instagram, or ticket code…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
            border: "1px solid #e5e5e5",
            background: "#ffffff",
            color: "#000000",
            fontFamily: "var(--mono)",
          }}
        />

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Instagram</th>
                <th>18+?</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Referral</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const groupColor = t.order_id ? groupColors[t.order_id] : null;
                return (
                <tr
                  key={t.id}
                  className={
                    t.status === "revoked" || t.status === "refunded" ? "revoked" : ""
                  }
                >
                  <td
                    style={{
                      borderLeft: `4px solid ${groupColor || "transparent"}`,
                    }}
                    title={groupColor ? "Part of a group order" : undefined}
                  >
                    {t.ticket_code}
                  </td>
                  <td>{t.full_name || "—"}</td>
                  <td>{t.email || "—"}</td>
                  <td>{t.phone || "—"}</td>
                  <td>{t.instagram_handle || "—"}</td>
                  <td>
                    <span
                      className={`badge ${
                        t.age_confirmed === "No" ? "no" : "valid"
                      }`}
                    >
                      {t.age_confirmed}
                    </span>
                  </td>
                  <td>${(t.amount_paid_cents / 100).toFixed(0)}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className={`badge ${t.status}`}>{t.status}</span>
                      {t.status === "revoked" && (
                        <button
                          type="button"
                          className="copy-link-btn"
                          aria-label="Bring back to pending"
                          disabled={busyId === t.id}
                          onClick={() => reinstate(t)}
                        >
                          <RefreshIcon />
                        </button>
                      )}
                    </span>
                  </td>
                  <td>{t.referral_code || "—"}</td>
                  <td>
                    {t.status === "pending" || t.status === "approved" ? (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {t.status === "pending" && (
                          <button
                            className="revoke-btn"
                            disabled={busyId === t.id}
                            onClick={() => approve(t)}
                          >
                            Approve
                          </button>
                        )}
                        <button
                          className="revoke-btn"
                          disabled={busyId === t.id}
                          onClick={() => revoke(t, false)}
                        >
                          Revoke only
                        </button>
                        <button
                          className="revoke-btn"
                          disabled={busyId === t.id}
                          onClick={() => revoke(t, true)}
                        >
                          Revoke + refund
                        </button>
                      </div>
                    ) : (
                      <span className="fine-print">
                        {t.revoke_reason || "—"}
                      </span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {failedOrders.length > 0 && (
          <>
            <h2 className="h2" style={{ fontSize: 20, margin: 0, marginTop: 40, color: "#c0392b" }}>
              Payment issues — needs manual fix
            </h2>
            <p className="fine-print" style={{ marginTop: 8, marginBottom: 16 }}>
              Payment succeeded but the ticket couldn't be created automatically.
              Check the Stripe dashboard for the session/payment intent below,
              then create the ticket manually in Supabase.
            </p>
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Group size</th>
                    <th>When</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {failedOrders.map((p) => (
                    <tr key={p.id}>
                      <td>{p.buyer_name || "—"}</td>
                      <td>{p.buyer_email || "—"}</td>
                      <td>{p.quantity}</td>
                      <td title={p.created_at}>{timeAgo(p.created_at)}</td>
                      <td className="fine-print">{p.reconciliation_note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2 className="h2" style={{ fontSize: 20, margin: 0, marginTop: 40 }}>
          Abandoned applications
        </h2>
        <p className="fine-print" style={{ marginTop: 8, marginBottom: 16 }}>
          Started the "Apply for Ticket" form but never completed payment —
          treat as a lead list.
        </p>
        {pendingOrders.length === 0 ? (
          <p className="fine-print">None right now.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Instagram</th>
                  <th>Group size</th>
                  <th>Applied</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.map((p) => (
                  <tr key={p.id}>
                    <td>{p.buyer_name || "—"}</td>
                    <td>{p.buyer_email || "—"}</td>
                    <td>{p.buyer_instagram || "—"}</td>
                    <td>{p.quantity}</td>
                    <td title={p.created_at}>{timeAgo(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { loggedIn, checked, setLoggedIn } = useAdminAuth("/api/admin/tickets");

  if (!checked) return null;
  return loggedIn ? (
    <Dashboard />
  ) : (
    <AdminLoginForm title="Guest list" onLoggedIn={() => setLoggedIn(true)} />
  );
}
