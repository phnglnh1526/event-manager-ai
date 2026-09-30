import React, { useEffect, useRef, useState } from "react";
import EventCoverImage from "./EventCoverImage";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function EventImageUpload({
  currentImageUrl,
  pendingFile,
  onFileSelect,
  onRemove,
  uploading = false,
  error: externalError = "",
  disabled = false,
}) {
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [localError, setLocalError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Generate object URL for pending file preview
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(pendingFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [pendingFile]);

  const displayImage = previewUrl || currentImageUrl;

  const validateAndSelectFile = (file) => {
    setLocalError("");
    if (!file) return;

    // Check MIME type and extension
    const hasValidType =
      ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())
      || ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidType) {
      setLocalError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setLocalError("Ảnh không được vượt quá 5 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    onFileSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled && !uploading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleTriggerUpload = () => {
    if (!disabled && !uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemove = () => {
    setLocalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onRemove();
  };

  const displayError = localError || externalError;

  return (
    <div className="event-image-upload-section">
      <label className="editor-field-label">Ảnh sự kiện (Cover Image)</label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleInputChange}
        disabled={disabled || uploading}
      />

      {displayImage ? (
        <div className="event-image-preview-card">
          <div className="event-image-preview-wrapper">
            <EventCoverImage
              src={displayImage}
              alt="Cover preview"
              className="event-image-preview-img"
            />
            {uploading && (
              <div className="event-image-uploading-overlay">
                <div className="app-loader" />
                <span>Đang tải ảnh lên...</span>
              </div>
            )}
          </div>
          <div className="event-image-preview-actions">
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={handleTriggerUpload}
              disabled={disabled || uploading}
            >
              Thay đổi ảnh
            </button>
            <button
              type="button"
              className="danger-button compact-button"
              onClick={handleRemove}
              disabled={disabled || uploading}
            >
              Xóa ảnh
            </button>
          </div>
          <p className="field-help">
            {pendingFile
              ? `Đã chọn: ${pendingFile.name} (${(pendingFile.size / 1024).toFixed(1)} KB) — Ảnh sẽ được tải lên khi bạn lưu.`
              : "Ảnh cover hiện tại của sự kiện."}
          </p>
        </div>
      ) : (
        <div
          className={`event-image-dropzone ${isDragOver ? "drag-over" : ""} ${disabled || uploading ? "disabled" : ""}`}
          onClick={handleTriggerUpload}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleTriggerUpload();
            }
          }}
        >
          <div className="dropzone-icon" aria-hidden="true">
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
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div className="dropzone-text">
            <strong>Kéo thả ảnh vào đây hoặc nhấp để chọn file</strong>
            <span>Định dạng hỗ trợ: JPG, PNG, WEBP (Tối đa 5 MB)</span>
          </div>
        </div>
      )}

      {displayError && (
        <div className="field-error image-upload-error" role="alert">
          {displayError}
        </div>
      )}
    </div>
  );
}

export default EventImageUpload;
