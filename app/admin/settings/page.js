"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../../../lib/useAdminAuth";
import AdminNav from "../../../components/AdminNav";
import AdminLoginForm from "../../../components/AdminLoginForm";

const FIELDS = [
  { key: "name", label: "Event name" },
  { key: "subtitle", label: "Subtitle" },
  { key: "dateDisplay", label: "Date" },
  { key: "boardingTime", label: "Boarding time" },
  { key: "departLocation", label: "Depart location" },
  { key: "priceAUD", label: "Price (AUD)", format: (v) => `$${v}` },
  { key: "capacity", label: "Capacity" },
  { key: "instagramHandle", label: "Instagram handle" },
];

// The datetime-local input has no timezone of its own — its value is
// treated verbatim as Perth local time (AWST, +08:00), which never
// observes daylight saving, so this stays correct year-round without
// needing real timezone-conversion logic.
function deriveFromDateTimeLocal(value) {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const dateISO = `${datePart}T${timePart}:00+08:00`;

  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = calendarDate.toLocaleDateString("en-AU", {
    weekday: "long",
    timeZone: "UTC",
  });
  const monthName = calendarDate.toLocaleDateString("en-AU", {
    month: "long",
    timeZone: "UTC",
  });
  const dateDisplay = `${weekday} ${day} ${monthName} ${year}`;

  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  const boardingTime = `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;

  return { dateISO, dateDisplay, boardingTime };
}

function rowFromApiData(data) {
  return {
    name: data.name,
    subtitle: data.subtitle,
    dateTimeLocal: (data.date_iso || data.dateISO || "").slice(0, 16),
    departLocation: data.depart_location ?? data.departLocation,
    priceAUD: String(data.price_aud ?? data.priceAUD),
    capacity: String(data.capacity),
    instagramHandle: data.instagram_handle ?? data.instagramHandle ?? "",
  };
}

function displayFromForm(form) {
  const derived = form.dateTimeLocal
    ? deriveFromDateTimeLocal(form.dateTimeLocal)
    : { dateDisplay: "", boardingTime: "" };
  return {
    name: form.name,
    subtitle: form.subtitle,
    dateDisplay: derived.dateDisplay,
    boardingTime: derived.boardingTime,
    departLocation: form.departLocation,
    priceAUD: form.priceAUD,
    capacity: form.capacity,
    instagramHandle: form.instagramHandle,
  };
}

function SettingsDashboard() {
  const [form, setForm] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState(null);

  async function load() {
    setLoading(true);
    setLoadError("");
    const res = await fetch(`/api/admin/event-settings?_=${Date.now()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (res.ok) {
      setForm(rowFromApiData(data));
      setOriginal(displayFromForm(rowFromApiData(data)));
    } else {
      setLoadError(data.error || "Could not load event settings.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  }

  function handleReview(e) {
    e.preventDefault();
    setFormError("");

    if (!form.name.trim() || !form.subtitle.trim() || !form.departLocation.trim()) {
      setFormError("Event name, subtitle, and depart location are required.");
      return;
    }
    if (!form.dateTimeLocal) {
      setFormError("Pick an event date and time.");
      return;
    }
    const price = parseInt(form.priceAUD, 10);
    if (!Number.isFinite(price) || price <= 0) {
      setFormError("Price must be a positive whole number.");
      return;
    }
    const capacity = parseInt(form.capacity, 10);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setFormError("Capacity must be a positive whole number.");
      return;
    }

    setReviewing(true);
  }

  async function handleConfirm() {
    setSaving(true);
    setSaveError("");
    const derived = deriveFromDateTimeLocal(form.dateTimeLocal);
    const res = await fetch("/api/admin/event-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        subtitle: form.subtitle.trim(),
        dateISO: derived.dateISO,
        dateDisplay: derived.dateDisplay,
        boardingTime: derived.boardingTime,
        departLocation: form.departLocation.trim(),
        priceAUD: parseInt(form.priceAUD, 10),
        capacity: parseInt(form.capacity, 10),
        instagramHandle: form.instagramHandle.trim(),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      const newForm = rowFromApiData(data);
      setForm(newForm);
      setOriginal(displayFromForm(newForm));
      setReviewing(false);
      setSavedAt(Date.now());
    } else {
      setSaveError(data.error || "Could not save changes.");
    }
  }

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="wrap" style={{ maxWidth: 700 }}>
          <div className="eyebrow">Admin</div>
          <h2 className="h2" style={{ fontSize: 26 }}>Settings</h2>
          <AdminNav active="settings" />
          <p className="fine-print">Loading…</p>
        </div>
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="admin-shell">
        <div className="wrap" style={{ maxWidth: 700 }}>
          <div className="eyebrow">Admin</div>
          <h2 className="h2" style={{ fontSize: 26 }}>Settings</h2>
          <AdminNav active="settings" />
          <p className="fine-print" style={{ color: "#c0392b" }}>
            {loadError || "Could not load event settings."}
          </p>
        </div>
      </div>
    );
  }

  const newDisplay = displayFromForm(form);
  const changedKeys = FIELDS.filter(
    (f) => String(original[f.key]) !== String(newDisplay[f.key])
  ).map((f) => f.key);

  return (
    <div className="admin-shell">
      <div className="wrap" style={{ maxWidth: 700 }}>
        <div className="eyebrow">Admin</div>
        <h2 className="h2" style={{ fontSize: 26 }}>Settings</h2>

        <AdminNav active="settings" />

        <p className="fine-print" style={{ marginBottom: 20 }}>
          These values drive the public site and every new Stripe checkout —
          changing price or capacity here only affects future purchases,
          never tickets already sold.
        </p>

        {!reviewing ? (
          <form onSubmit={handleReview} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 460 }}>
            <label style={labelStyle}>
              Event name
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </label>
            <label style={labelStyle}>
              Subtitle
              <input
                style={inputStyle}
                value={form.subtitle}
                onChange={(e) => updateField("subtitle", e.target.value)}
              />
            </label>
            <label style={labelStyle}>
              Event date &amp; boarding time (Perth / AWST)
              <input
                type="datetime-local"
                style={inputStyle}
                value={form.dateTimeLocal}
                onChange={(e) => updateField("dateTimeLocal", e.target.value)}
              />
            </label>
            <label style={labelStyle}>
              Depart location
              <input
                style={inputStyle}
                value={form.departLocation}
                onChange={(e) => updateField("departLocation", e.target.value)}
              />
            </label>
            <label style={labelStyle}>
              Price (AUD)
              <input
                type="number"
                min="1"
                step="1"
                style={inputStyle}
                value={form.priceAUD}
                onChange={(e) => updateField("priceAUD", e.target.value)}
              />
            </label>
            <label style={labelStyle}>
              Capacity
              <input
                type="number"
                min="1"
                step="1"
                style={inputStyle}
                value={form.capacity}
                onChange={(e) => updateField("capacity", e.target.value)}
              />
            </label>
            <label style={labelStyle}>
              Instagram handle
              <input
                style={inputStyle}
                value={form.instagramHandle}
                onChange={(e) => updateField("instagramHandle", e.target.value)}
                placeholder="@syvete"
              />
            </label>

            {formError && (
              <p className="fine-print" style={{ color: "#c0392b" }}>{formError}</p>
            )}
            {savedAt && (
              <p className="fine-print" style={{ color: "#1e7e34" }}>Saved.</p>
            )}

            <button type="submit" className="btn-glossy" style={{ padding: "12px 20px", alignSelf: "flex-start" }}>
              Review changes
            </button>
          </form>
        ) : (
          <div style={{ maxWidth: 460 }}>
            {changedKeys.length === 0 ? (
              <p className="fine-print">No changes to save.</p>
            ) : (
              <table style={{ marginBottom: 20 }}>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Old value</th>
                    <th>New value</th>
                  </tr>
                </thead>
                <tbody>
                  {changedKeys.map((key) => {
                    const field = FIELDS.find((f) => f.key === key);
                    const fmt = field.format || ((v) => v);
                    return (
                      <tr key={key}>
                        <td>{field.label}</td>
                        <td>{fmt(original[key])}</td>
                        <td>{fmt(newDisplay[key])}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {saveError && (
              <p className="fine-print" style={{ color: "#c0392b" }}>{saveError}</p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn-glossy"
                disabled={saving || changedKeys.length === 0}
                onClick={handleConfirm}
                style={{ padding: "12px 20px" }}
              >
                {saving ? "Saving…" : "Confirm and save"}
              </button>
              <button
                type="button"
                className="revoke-btn"
                disabled={saving}
                onClick={() => setReviewing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontFamily: "var(--mono)",
  fontSize: 13,
};

const inputStyle = {
  padding: 12,
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  background: "#ffffff",
  color: "#000000",
  fontFamily: "var(--mono)",
};

export default function SettingsPage() {
  const { loggedIn, checked, setLoggedIn } = useAdminAuth("/api/admin/event-settings");

  if (!checked) return null;
  return loggedIn ? (
    <SettingsDashboard />
  ) : (
    <AdminLoginForm title="Settings" onLoggedIn={() => setLoggedIn(true)} />
  );
}
