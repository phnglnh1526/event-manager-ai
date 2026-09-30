import React, { useEffect, useMemo, useRef, useState } from "react";

export const ROLE_LABELS = {
  ADMIN: "Quản trị viên",
  ORGANIZER: "Ban tổ chức",
  STAFF: "Nhân viên",
  ATTENDEE: "Người tham dự",
};

export const WORKSPACE_SUBTITLES = {
  ADMIN: "Không gian quản trị & phân tích",
  ORGANIZER: "Không gian quản lý sự kiện",
  STAFF: "Không gian check-in",
  ATTENDEE: "Cổng thông tin người tham dự",
};

export const VIEW_TITLES = {
  analytics: "Tổng quan phân tích",
  events: "Sự kiện",
  announcements: "Thông báo",
  users: "Quản lý người dùng",
  profile: "Thông tin cá nhân",
  checkin: "Check-in sự kiện",
  registrations: "Sự kiện đã đăng ký",
  tickets: "Vé của tôi",
  feedback: "Phản hồi sự kiện",
};

export const SIDEBAR_ITEMS_BY_ROLE = {
  ADMIN: [
    { view: "analytics", label: "Tổng quan", icon: "dashboard" },
    { view: "events", label: "Sự kiện", icon: "events" },
    { view: "users", label: "Người dùng", icon: "users" },
    { view: "announcements", label: "Thông báo", icon: "announcements" },
  ],
  ORGANIZER: [
    { view: "analytics", label: "Tổng quan", icon: "dashboard" },
    { view: "events", label: "Sự kiện", icon: "events" },
    { view: "announcements", label: "Thông báo", icon: "announcements" },
  ],
  STAFF: [
    { view: "checkin", label: "Check-in", icon: "checkin" },
  ],
  ATTENDEE: [
    { view: "events", label: "Khám phá sự kiện", icon: "events" },
    { view: "registrations", label: "Đã đăng ký", icon: "registrations" },
    { view: "tickets", label: "Vé của tôi", icon: "tickets" },
    { view: "feedback", label: "Phản hồi", icon: "feedback" },
    { view: "announcements", label: "Thông báo", icon: "announcements" },
  ],
};

function renderNavIcon(icon) {
  switch (icon) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="7" height="9" x="3" y="3" rx="1.5" />
          <rect width="7" height="5" x="14" y="3" rx="1.5" />
          <rect width="7" height="9" x="14" y="12" rx="1.5" />
          <rect width="7" height="5" x="3" y="16" rx="1.5" />
        </svg>
      );
    case "events":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "announcements":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      );
    case "checkin":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "registrations":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case "tickets":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2M13 11v2M13 17v2" />
        </svg>
      );
    case "feedback":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
}

function WorkspaceHeader({
  currentUser,
  activeView,
  onNavigate,
  onProfile,
  onLogout,
  onBack,
  backLabel = "Quay lại",
  workspaceLabel,
  showBackButton = false,
}) {
  const profileMenuRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = useMemo(() => SIDEBAR_ITEMS_BY_ROLE[currentUser?.role] || [], [currentUser?.role]);
  const roleLabel = ROLE_LABELS[currentUser?.role] || currentUser?.role || "Người dùng";
  const initials = getInitials(currentUser?.full_name);
  const pageTitle = VIEW_TITLES[activeView] || workspaceLabel || "Bảng điều khiển";

  const closeMenus = () => {
    setProfileOpen(false);
    setMobileOpen(false);
  };

  useEffect(() => {
    closeMenus();
  }, [activeView, currentUser?.role]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Click outside to close profile popover
  useEffect(() => {
    if (!profileOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeMenus();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  const selectView = (view) => {
    closeMenus();
    if (view === "profile") {
      if (onProfile) onProfile();
      else onNavigate?.(view);
      return;
    }
    onNavigate?.(view);
  };

  const handleBack = () => {
    closeMenus();
    onBack?.();
  };

  const handleLogout = () => {
    closeMenus();
    onLogout?.();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* =========================================================================
          1. MODERN APP SIDEBAR (Fixed Desktop 260px / Slide Drawer Mobile)
          ========================================================================= */}
      <aside className={`app-sidebar ${mobileOpen ? "open" : ""}`} aria-label="Điều hướng chính">
        {/* Sidebar Brand Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-mark compact" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-title">EVENT MANAGER AI</span>
              <span className="sidebar-subtitle">Tối ưu sự kiện bằng trí tuệ nhân tạo</span>
            </div>
          </div>
          {mobileOpen && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Đóng thanh điều hướng"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="sidebar-nav" role="navigation" aria-label="Menu chức năng">
          <div className="sidebar-group-label">CHỨC NĂNG CHÍNH</div>
          {navItems.map((item) => {
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => selectView(item.view)}
              >
                <span className="sidebar-item-icon">
                  {renderNavIcon(item.icon)}
                </span>
                <span className="sidebar-item-label">{item.label}</span>
                {isActive && <span className="sidebar-active-indicator" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with System / Role Status */}
        <div className="sidebar-footer">
          <button
            type="button"
            className={`sidebar-nav-item ${activeView === "profile" ? "active" : ""}`}
            onClick={() => selectView("profile")}
          >
            <span className="sidebar-item-icon">{renderNavIcon("profile")}</span>
            <span className="sidebar-item-label">Hồ sơ cá nhân</span>
          </button>

          <div className="sidebar-status-card">
            <div className="sidebar-status-indicator">
              <span className="status-dot-pulse" aria-hidden="true" />
              <span>Hệ thống AI sẵn sàng</span>
            </div>
            <span className="sidebar-version">v2.0 Event Intelligence</span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. TOP HEADER (Breadcrumbs, Title, Notifications & User Popover)
          ========================================================================= */}
      <header className="app-top-header" role="banner">
        <div className="top-header-left">
          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            className="sidebar-toggle-btn"
            aria-label="Mở thanh điều hướng"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <span aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>

          {/* Breadcrumbs / Page Heading */}
          <div className="top-header-heading">
            {showBackButton ? (
              <button type="button" className="header-back-link" onClick={handleBack}>
                <span aria-hidden="true">←</span> {backLabel}
              </button>
            ) : (
              <nav className="breadcrumbs" aria-label="Đường dẫn trang">
                <span className="breadcrumb-root">Hệ thống</span>
                <span className="breadcrumb-separator" aria-hidden="true">/</span>
                <span className="breadcrumb-current">{pageTitle}</span>
              </nav>
            )}
          </div>
        </div>

        <div className="top-header-right" ref={profileMenuRef}>
          {/* AI Intelligence Status Chip */}
          <div className="header-ai-badge" title="Động cơ trí tuệ nhân tạo đang hoạt động">
            <span className="ai-badge-spark" aria-hidden="true">✦</span>
            <span>AI Active</span>
          </div>

          {/* Notifications Status Button */}
          <button
            type="button"
            className="header-icon-btn"
            aria-label="Thông báo hệ thống"
            title="Bản tin & Thông báo"
            onClick={() => selectView("announcements")}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span className="notification-dot" aria-hidden="true" />
          </button>

          {/* Profile Dropdown Toggle */}
          <button
            type="button"
            className="header-profile-btn"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="Menu tài khoản"
            onClick={() => setProfileOpen((prev) => !prev)}
          >
            <span className="header-avatar" aria-hidden="true">{initials}</span>
            <div className="header-user-info">
              <strong className="header-user-name">{currentUser.full_name}</strong>
              <span className="header-user-role">{roleLabel}</span>
            </div>
            <span className="header-caret" aria-hidden="true">⌄</span>
          </button>

          {/* Account Popover Menu */}
          {profileOpen && (
            <div className="app-account-popover" role="menu" aria-label="Tùy chọn tài khoản">
              <div className="popover-user-summary">
                <strong>{currentUser.full_name}</strong>
                <span>{currentUser.email}</span>
                <span className="popover-role-chip">{roleLabel}</span>
              </div>
              <div className="popover-divider" />
              <button
                type="button"
                className="popover-menu-item"
                role="menuitem"
                onClick={() => selectView("profile")}
              >
                <span aria-hidden="true">{renderNavIcon("profile")}</span>
                <span>Hồ sơ &amp; Bảo mật</span>
              </button>
              <button
                type="button"
                className="popover-menu-item popover-danger"
                role="menuitem"
                onClick={handleLogout}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
}

export default WorkspaceHeader;
