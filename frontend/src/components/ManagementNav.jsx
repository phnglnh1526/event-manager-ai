import React from "react";

function ManagementNav({ activeView, onChange, currentUser }) {
  return (
    <nav className="management-nav" aria-label="Khu vực quản lý">
      <button type="button" aria-current={activeView === "analytics" ? "page" : undefined} className={activeView === "analytics" ? "active" : ""} onClick={() => onChange("analytics")}>Phân tích</button>
      <button type="button" aria-current={activeView === "events" ? "page" : undefined} className={activeView === "events" ? "active" : ""} onClick={() => onChange("events")}>Sự kiện</button>
      <button type="button" aria-current={activeView === "announcements" ? "page" : undefined} className={activeView === "announcements" ? "active" : ""} onClick={() => onChange("announcements")}>Thông báo</button>
      {currentUser?.role === "ADMIN" && <button type="button" aria-current={activeView === "users" ? "page" : undefined} className={activeView === "users" ? "active" : ""} onClick={() => onChange("users")}>Người dùng</button>}
      <button type="button" aria-current={activeView === "profile" ? "page" : undefined} className={activeView === "profile" ? "active" : ""} onClick={() => onChange("profile")}>Hồ sơ</button>
    </nav>
  );
}

export default ManagementNav;
