"use client";

const TABS = [
  { key: "guest", href: "/admin", label: "Guest list" },
  { key: "affiliates", href: "/admin/affiliates", label: "Affiliates" },
  { key: "stats", href: "/admin/stats", label: "Stats" },
  { key: "settings", href: "/admin/settings", label: "Settings" },
];

export default function AdminNav({ active }) {
  return (
    <nav className="admin-nav">
      {TABS.map((t) => (
        <a
          key={t.key}
          href={t.href}
          className={`admin-nav-link ${active === t.key ? "active" : ""}`}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
