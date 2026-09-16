import React, { useEffect, useMemo, useRef, useState } from "react";

export const ROLE_LABELS = {
  ADMIN: "Quản trị viên",
  ORGANIZER: "Ban tổ chức",
  STAFF: "Nhân viên",
  ATTENDEE: "Người tham dự",
};

export const WORKSPACE_SUBTITLES = {
  ADMIN: "Analytics workspace",
  ORGANIZER: "Event management workspace",
  STAFF: "Check-in workspace",
  ATTENDEE: "Attendee portal",
};

export const NAV_ITEMS_BY_ROLE = {
  ADMIN: [
    { view: "analytics", label: "Analytics" },
    { view: "events", label: "Events" },
    { view: "announcements", label: "Announcements" },
    { view: "users", label: "Users" },
    { view: "profile", label: "Profile" },
  ],
  ORGANIZER: [
    { view: "analytics", label: "Analytics" },
    { view: "events", label: "Events" },
    { view: "announcements", label: "Announcements" },
    { view: "profile", label: "Profile" },
  ],
  STAFF: [
    { view: "checkin", label: "Check-in Workspace" },
    { view: "profile", label: "Profile" },
  ],
  ATTENDEE: [
    { view: "events", label: "Events" },
    { view: "registrations", label: "My Registrations" },
    { view: "tickets", label: "My Tickets" },
    { view: "feedback", label: "Feedback" },
    { view: "announcements", label: "Announcements" },
    { view: "profile", label: "Profile" },
  ],
};

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
}

function WorkspaceHeader({ currentUser, activeView, onNavigate, onProfile, onLogout, onBack, backLabel = "Back", workspaceLabel, showBackButton = false }) {
  const headerRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = useMemo(() => NAV_ITEMS_BY_ROLE[currentUser?.role] || [], [currentUser?.role]);
  const subtitle = workspaceLabel || WORKSPACE_SUBTITLES[currentUser?.role] || "Workspace";
  const roleLabel = ROLE_LABELS[currentUser?.role] || currentUser?.role || "User";
  const initials = getInitials(currentUser?.full_name);

  const closeMenus = () => { setProfileOpen(false); setMobileOpen(false); };

  useEffect(() => { closeMenus(); }, [activeView, currentUser?.role]);

  useEffect(() => {
    if (!profileOpen && !mobileOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) closeMenus();
    };
    const handleKeyDown = (event) => { if (event.key === "Escape") closeMenus(); };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen, profileOpen]);

  const selectView = (view) => {
    closeMenus();
    if (view === "profile") {
      if (onProfile) onProfile();
      else onNavigate?.(view);
      return;
    }
    onNavigate?.(view);
  };

  const navigation = (
    <div className="workspace-sidebar-nav">
      <p className="workspace-sidebar-section">Workspace</p>
      {navItems.map((item) => (
        <button key={item.view} type="button" className={`workspace-sidebar-link ${activeView === item.view ? "active" : ""}`} aria-current={activeView === item.view ? "page" : undefined} onClick={() => selectView(item.view)}>
          <span className="workspace-sidebar-dot" aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {!showBackButton && <aside className="workspace-sidebar">
        <div className="workspace-sidebar-brand">
          <div className="brand-mark compact" aria-hidden="true"><span /><span /><span /></div>
          <div><strong>EVENT MANAGER AI</strong><span>{subtitle}</span></div>
        </div>
        {navigation}
        <div className="workspace-sidebar-footer">
          <span className="workspace-avatar" aria-hidden="true">{initials}</span>
          <div><strong>{currentUser.full_name}</strong><span>{roleLabel}</span></div>
        </div>
      </aside>}

      <header className={`workspace-header ${showBackButton ? "workspace-header-profile" : ""}`} ref={headerRef}>
        <div className="workspace-mobile-brand">
          <div className="brand-mark compact" aria-hidden="true"><span /><span /><span /></div>
          <div><strong>{subtitle}</strong><span>{roleLabel}</span></div>
        </div>
        <button type="button" className="workspace-menu-toggle" aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>
          <span aria-hidden="true"><i /><i /><i /></span><span>Menu</span>
        </button>
        <div className="workspace-actions">
          {showBackButton ? (
            <div className="workspace-back-actions">
              <button type="button" className="secondary-button workspace-back-button" onClick={() => onBack?.()}>{backLabel}</button>
              <button type="button" className="secondary-button" onClick={() => onLogout?.()}>Logout</button>
            </div>
          ) : (
            <button type="button" className="workspace-profile-toggle" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}>
              <span className="workspace-avatar" aria-hidden="true">{initials}</span>
              <span className="workspace-profile-copy"><strong>{currentUser.full_name}</strong><span>{roleLabel}</span></span>
              <span className="workspace-caret" aria-hidden="true">⌄</span>
            </button>
          )}
        </div>

        {!showBackButton && <div id="workspace-profile-menu" className={`workspace-popover ${profileOpen ? "open" : ""}`}>
          <button type="button" onClick={() => selectView("profile")}>Profile</button>
          <button type="button" onClick={() => { closeMenus(); onLogout?.(); }}>Logout</button>
        </div>}

        <div className={`workspace-mobile-menu ${mobileOpen ? "open" : ""}`}>
          {navigation}
        </div>
      </header>
    </>
  );
}

export default WorkspaceHeader;
