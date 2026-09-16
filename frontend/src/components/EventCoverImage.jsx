import React, { useEffect, useState } from "react";

export function EventCoverImage({ src, alt = "Event cover", className = "", fallbackClassName = "" }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`event-cover-placeholder ${fallbackClassName || className}`.trim()}
        aria-hidden="true"
      >
        <div className="event-cover-placeholder-inner">
          <svg
            viewBox="0 0 24 24"
            width="36"
            height="36"
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
            <circle cx="12" cy="15" r="2" />
          </svg>
          <span className="placeholder-brand">Event Manager AI</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`event-cover-img ${className}`.trim()}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

export default EventCoverImage;
