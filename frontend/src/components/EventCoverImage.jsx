import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../services/api";

export function normalizeCoverImageUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Blob and inline data URLs pass directly
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }

  // Internal upload endpoint matcher: /api/uploads/file/<id>
  const uploadMatch = trimmed.match(/\/api\/uploads\/file\/[a-zA-Z0-9_-]+/);
  if (uploadMatch) {
    const relPath = uploadMatch[0];
    // If API_BASE_URL is configured and points to a reachable external host (not docker internal 'backend:8000')
    if (API_BASE_URL && !API_BASE_URL.includes("backend:8000")) {
      return `${API_BASE_URL}${relPath}`;
    }
    return relPath;
  }

  // If URL contains Docker internal backend:8000 hostname, strip or re-route to API_BASE_URL
  if (trimmed.includes("backend:8000")) {
    const pathPart = trimmed.split("backend:8000")[1];
    if (API_BASE_URL && !API_BASE_URL.includes("backend:8000")) {
      return `${API_BASE_URL}${pathPart}`;
    }
    return pathPart;
  }

  return trimmed;
}

export function EventCoverImage({
  src,
  alt = "Ảnh sự kiện",
  className = "",
  fallbackClassName = "",
  loading = "lazy",
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const cleanSrc = normalizeCoverImageUrl(src);

  if (!cleanSrc || hasError) {
    return (
      <div
        className={`event-cover-placeholder ${fallbackClassName}`.trim()}
        aria-hidden="true"
      >
        <div className="event-cover-placeholder-inner">
          <svg
            viewBox="0 0 24 24"
            width="32"
            height="32"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="placeholder-brand">Chưa có ảnh bìa</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      className={`event-cover-img ${className}`.trim()}
      onError={() => setHasError(true)}
      loading={loading}
    />
  );
}

export default EventCoverImage;
