import React from "react";

const RATINGS = [5, 4, 3, 2, 1];

function RatingDistribution({ distribution }) {
  const counts = RATINGS.map((rating) => Number(distribution[String(rating)]) || 0);
  const maximum = Math.max(...counts, 0);
  return (
    <article className="panel-card">
      <div className="panel-heading"><div><p className="eyebrow">FEEDBACK</p><h3>Rating distribution</h3></div></div>
      <div className="rating-list">
        {RATINGS.map((rating, index) => {
          const count = counts[index];
          const width = maximum > 0 ? (count / maximum) * 100 : 0;
          return <div className="rating-row" key={rating}><span>{rating} <span aria-hidden="true">★</span></span><div className="rating-track"><span style={{ width: `${width}%` }} /></div><strong>{count}</strong></div>;
        })}
      </div>
    </article>
  );
}

export default RatingDistribution;
