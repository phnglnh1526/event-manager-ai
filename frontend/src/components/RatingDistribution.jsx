import React from "react";

const RATINGS = [5, 4, 3, 2, 1];

function RatingDistribution({ distribution = {}, feedbackCount = 0 }) {
  const counts = RATINGS.map((rating) => Number(distribution[String(rating)]) || 0);
  const total = Math.max(0, Number(feedbackCount) || 0);

  return (
    <article className="panel-card rating-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">PHẢN HỒI</p>
          <h3>Phân bố đánh giá</h3>
        </div>
        <span className="panel-total">
          <strong>{total}</strong> lượt phản hồi
        </span>
      </div>

      <div className="rating-list">
        {RATINGS.map((rating, index) => {
          const count = counts[index];
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const percentageLabel = Number.isInteger(percentage) ? percentage : Number(percentage.toFixed(1));

          return (
            <div className="rating-row" key={rating}>
              <div className="rating-score">
                <span>{rating}</span>
                <span className="star-icon" aria-hidden="true">★</span>
              </div>
              <div
                className="rating-track"
                role="progressbar"
                aria-label={`${rating} sao: ${count} lượt phản hồi, ${percentageLabel}%`}
                aria-valuenow={percentage}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span
                  className="rating-bar-fill"
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
              <div className="rating-metrics">
                <strong>{count}</strong>
                <small>{percentageLabel}%</small>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default RatingDistribution;
