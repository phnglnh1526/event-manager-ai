import React, { useMemo } from "react";

/**
 * Reusable Pagination Component for Event Manager AI V2
 *
 * @param {number} totalItems - Total count of items matching current search/filters
 * @param {number} currentPage - Active page (1-based)
 * @param {number} pageSize - Number of items displayed per page
 * @param {Function} onPageChange - Callback when user clicks a page (newPage: number) => void
 * @param {number[]} [pageSizeOptions] - Optional list of page size choices, e.g. [10, 20, 50]
 * @param {Function} [onPageSizeChange] - Optional callback when user changes page size (newSize: number) => void
 * @param {string} [itemLabel="mục"] - Noun describing the items (e.g. "người dùng", "sự kiện", "thông báo")
 * @param {boolean} [hideIfSinglePage=false] - Whether to completely hide controls if totalPages <= 1
 * @param {boolean} [standalone=false] - Apply full card border/radius if rendered outside a table
 */
export default function Pagination({
  totalItems = 0,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  itemLabel = "mục",
  hideIfSinglePage = false,
  standalone = false,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Determine item range for current page
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers with ellipsis
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  }, [totalPages, currentPage]);

  // If hideIfSinglePage is true and total items fit in 1 page, don't show pagination
  if (hideIfSinglePage && totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className={`pagination-container ${standalone ? "pagination-standalone" : ""}`}
      aria-label="Điều hướng phân trang"
    >
      {/* Range summary: e.g. Hiển thị 1–10 trong tổng số 129 người dùng */}
      <div className="pagination-summary">
        {totalItems > 0 ? (
          <>
            Hiển thị <strong>{startItem}–{endItem}</strong> trong tổng số <strong>{totalItems}</strong> {itemLabel}
          </>
        ) : (
          <span>Không có {itemLabel} nào</span>
        )}
      </div>

      <div className="pagination-controls-wrapper">
        {/* Optional Page Size Selector */}
        {pageSizeOptions && pageSizeOptions.length > 1 && onPageSizeChange && (
          <div className="pagination-size-wrapper">
            <label htmlFor="pagination-page-size" className="sr-only">Số {itemLabel} mỗi trang</label>
            <select
              id="pagination-page-size"
              className="pagination-size-select"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                if (onPageSizeChange) {
                  onPageSizeChange(newSize);
                }
              }}
              aria-label={`Số ${itemLabel} mỗi trang`}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} / trang
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page Buttons */}
        {totalPages > 1 && (
          <div className="pagination-buttons">
            <button
              type="button"
              className="pagination-btn pagination-prev"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Trang trước"
            >
              ← Trước
            </button>

            {pageNumbers.map((page, index) => {
              if (page === "...") {
                return (
                  <span key={`ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">
                    …
                  </span>
                );
              }

              const isCurrent = page === currentPage;
              return (
                <button
                  key={page}
                  type="button"
                  className={`pagination-btn ${isCurrent ? "active" : ""}`}
                  onClick={() => onPageChange(Number(page))}
                  disabled={isCurrent}
                  aria-current={isCurrent ? "page" : undefined}
                  aria-label={`Trang ${page}`}
                >
                  {page}
                </button>
              );
            })}

            <button
              type="button"
              className="pagination-btn pagination-next"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Trang sau"
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

