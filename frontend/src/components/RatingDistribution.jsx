import React from "react";

const RATINGS = [5, 4, 3, 2, 1];

function RatingDistribution({ distribution, feedbackCount }) {
  const counts = RATINGS.map((rating) => Number(distribution[String(rating)]) || 0);
  const total = Math.max(0, Number(feedbackCount) || 0);

  return (
    <article className="panel-card rating-panel">
      <div className="panel-heading"><div><p className="eyebrow">FEEDBACK</p><h3>Rating distribution</h3></div><span className="panel-total"><strong>{total}</strong> responses</span></div>
      <div className="rating-list">
        {RATINGS.map((rating, index) => {
          const count = counts[index];
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const percentageLabel = Number.isInteger(percentage) ? percentage : Number(percentage.toFixed(1));
          return <div className="rating-row" key={rating}><span>{rating} <span aria-hidden="true">★</span></span><div className="rating-track" aria-label={`${rating} stars: ${count} responses, ${percentageLabel}%`}><span style={{ width: `${Math.min(percentage, 100)}%` }} /></div><strong>{count}<small>{percentageLabel}%</small></strong></div>;
        })}
      </div>
    </article>
  );
}

export default RatingDistribution;
