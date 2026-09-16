import React, { useEffect, useState } from "react";

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { view: "home", label: "Home", icon: "⌂" },
      { view: "events", label: "Discover Events", icon: "⌕" },
    ],
  },
  {
    label: "MY EVENTS",
    items: [
      { view: "registrations", label: "My Registrations", icon: "▣" },
      { view: "tickets", label: "My Tickets", icon: "▤" },
    ],
  },
  {
    label: "ENGAGEMENT",
    items: [
      { view: "feedback", label: "Feedback", icon: "☆" },
      { view: "announcements", label: "Announcements", icon: "♧" },
    ],
  },
  {
    label: "ACCOUNT",
    items: [{ view: "profile", label: "Profile", icon: "♙" }],
  },
];

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
}

function Brand() {
  return (
    <div className="attendee-brand">
      <span className="brand-logo" aria-hidden="true"><i/><i/><i/></span>
      <div>
        <strong>EVENT MANAGER AI</strong>
        <span>Attendee portal</span>
      </div>
    </div>
  );
}

function Navigation({ activeView, onNavigate }) {
  return (
    <nav className="attendee-side-nav" aria-label="Attendee navigation">
      {NAV_SECTIONS.map((section, index) => (
        <div className="attendee-nav-group" key={section.label || `main-${index}`}>
          {section.label && <div className="attendee-nav-label">{section.label}</div>}
          {section.items.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`attendee-nav-item ${activeView === item.view ? "active" : ""}`}
              aria-current={activeView === item.view ? "page" : undefined}
              onClick={() => onNavigate(item.view)}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

function AttendeeShell({
  currentUser,
  activeView,
  onNavigate,
  onLogout,
  children,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search events, speakers, topics...",
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
    setProfileOpen(false);
  }, [activeView]);

  const navigate = (view) => {
    setDrawerOpen(false);
    onNavigate(view);
  };

  return (
    <div className="attendee-app-shell">
      <aside className="attendee-sidebar" aria-label="Attendee sidebar">
        <Brand />
        <Navigation activeView={activeView} onNavigate={navigate} />
        <div className="attendee-sidebar-bottom">
          <button type="button" className="attendee-nav-item" onClick={onLogout}>
            <span aria-hidden="true">⇥</span><span>Logout</span>
          </button>
          <div className="attendee-sidebar-user">
            <span className="attendee-avatar">{initials(currentUser?.full_name)}</span>
            <div>
              <strong>{currentUser?.full_name || "Attendee"}</strong>
              <span>Người tham dự</span>
            </div>
          </div>
        </div>
      </aside>

      {drawerOpen && (
        <div className="attendee-mobile-backdrop" onClick={() => setDrawerOpen(false)}>
          <aside
            className="attendee-mobile-drawer"
            onClick={(event) => event.stopPropagation()}
            aria-label="Mobile attendee navigation"
          >
            <button
              type="button"
              className="attendee-drawer-close"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              ×
            </button>
            <div className="attendee-sidebar">
              <Brand />
              <Navigation activeView={activeView} onNavigate={navigate} />
              <div className="attendee-sidebar-bottom">
                <button type="button" className="attendee-nav-item" onClick={onLogout}>
                  <span aria-hidden="true">⇥</span><span>Logout</span>
                </button>
                <div className="attendee-sidebar-user">
                  <span className="attendee-avatar">{initials(currentUser?.full_name)}</span>
                  <div>
                    <strong>{currentUser?.full_name || "Attendee"}</strong>
                    <span>Người tham dự</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="attendee-main-shell">
        <header className="attendee-topbar">
          <button
            type="button"
            className="attendee-mobile-trigger"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>

          {onSearchChange ? (
            <div className="attendee-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
              <kbd>/</kbd>
            </div>
          ) : (
            <div className="attendee-topbar-spacer" />
          )}

          <div className="attendee-top-actions">
            <button
              type="button"
              className="attendee-icon-button"
              aria-label="Announcements"
              onClick={() => navigate("announcements")}
            >
              ♧
            </button>
            <div className="attendee-profile-wrap">
              <button
                type="button"
                className="attendee-profile-button"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((value) => !value)}
              >
                <span className="attendee-avatar">{initials(currentUser?.full_name)}</span>
                <span>
                  <strong>{currentUser?.full_name || "Attendee"}</strong>
                  <small>Người tham dự</small>
                </span>
                <span aria-hidden="true">⌄</span>
              </button>
              {profileOpen && (
                <div className="attendee-profile-menu">
                  <button type="button" onClick={() => navigate("profile")}>Profile</button>
                  <button type="button" onClick={onLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="attendee-main-content">{children}</main>
      </div>
    </div>
  );
}

export default AttendeeShell;
