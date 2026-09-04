import React from "react";

function ManagementNav({ activeView, onChange, currentUser }) {
  return (
    <nav className="management-nav" aria-label="Management workspace">
      <button type="button" aria-current={activeView === "analytics" ? "page" : undefined} className={activeView === "analytics" ? "active" : ""} onClick={() => onChange("analytics")}>Analytics</button>
      <button type="button" aria-current={activeView === "events" ? "page" : undefined} className={activeView === "events" ? "active" : ""} onClick={() => onChange("events")}>Events</button>
      <button type="button" aria-current={activeView === "announcements" ? "page" : undefined} className={activeView === "announcements" ? "active" : ""} onClick={() => onChange("announcements")}>Announcements</button>
      {currentUser?.role === "ADMIN" && <button type="button" aria-current={activeView === "users" ? "page" : undefined} className={activeView === "users" ? "active" : ""} onClick={() => onChange("users")}>Users</button>}
      <button type="button" aria-current={activeView === "profile" ? "page" : undefined} className={activeView === "profile" ? "active" : ""} onClick={() => onChange("profile")}>Profile</button>
    </nav>
  );
}

export default ManagementNav;
