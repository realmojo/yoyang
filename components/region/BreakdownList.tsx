import type { Breakdown } from "@/lib/region-data";

/** 급여종류·설립주체 같은 구성비를 막대로 보여준다 */
export default function BreakdownList({
  items,
  limit = 8,
}: {
  items: Breakdown[];
  limit?: number;
}) {
  const rows = items.slice(0, limit);
  if (rows.length === 0) {
    return <p className="panel__desc">집계할 자료가 없습니다.</p>;
  }

  const max = rows[0].count || 1;

  return (
    <div>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span className="bar-row__label">{row.label}</span>
          <span className="bar-row__track">
            <span
              className="bar-row__fill"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </span>
          <span className="bar-row__value">
            {row.count}곳
            <span className="bar-row__diff">
              {Math.round(row.ratio * 100)}%
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
