import React, { useEffect, useState } from "react";

export function normalizeCoverImageUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // If the image is stored in our uploaded files endpoint, extract the relative path
  // so it always resolves through the current frontend origin / Vite proxy
  // (fixing Docker internal backend:8000 hostnames or third-party hostnames)
  const uploadMatch = trimmed.match(/\/api\/uploads\/file\/[a-zA-Z0-9_-]+/);
  if (uploadMatch) {
    return uploadMatch[0];
  }

  return trimmed;
}

export function EventCoverImage({ src, alt = "Ảnh sự kiện", className = "", fallbackClassName = "" }) {
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
      loading="lazy"
    />
  );
}

export default EventCoverImage;
