import {
  round1,
  SCORE_SYSTEMS,
  type NationalStats,
  type RegionStats,
} from "@/lib/region-data";

/**
 * 영역별 평균 점수를 전국 평균과 나란히 보여준다.
 *
 * 지표 체계가 2021~2024(5개 영역)와 2025(4개 영역)로 나뉘고 서로 배타적이다.
 * 섞어서 평균 내면 의미가 없으므로 체계별로 따로 그리고, 그 체계로 평가받은
 * 기관이 없는 지역에서는 해당 블록을 아예 빼버린다.
 */
export default function ScoreBars({
  stats,
  national,
}: {
  stats: RegionStats;
  national: NationalStats | null;
}) {
  const blocks = SCORE_SYSTEMS.map((system) => {
    const count = system.system === "2025" ? stats.count_2025 : stats.count_2021;
    const rows = system.fields
      .map((f) => ({
        label: f.label,
        mine: round1(stats[f.avg] as number | null),
        all: round1((national?.[f.avg] as number | null) ?? null),
      }))
      .filter((row) => row.mine !== null);

    return { system, count, rows };
  }).filter((block) => block.rows.length > 0);

  if (blocks.length === 0) {
    return (
      <p className="panel__desc">
        이 지역에는 영역별 점수가 공개된 평가 건이 없습니다.
      </p>
    );
  }

  return (
    <div>
      {blocks.map(({ system, count, rows }) => (
        <div key={system.system} style={{ marginBottom: 18 }}>
          <p
            className="panel__desc"
            style={{ margin: "0 0 10px", fontWeight: 700, color: "#495244" }}
          >
            {system.label}
            <span style={{ fontWeight: 500, marginLeft: 6 }}>
              ({count}곳 · {system.note})
            </span>
          </p>

          {rows.map((row) => {
            const diff = row.all === null ? null : round1(row.mine! - row.all);
            return (
              <div className="bar-row" key={`${system.system}-${row.label}`}>
                <span className="bar-row__label">{row.label}</span>
                <span className="bar-row__track">
                  <span
                    className="bar-row__fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, row.mine!))}%`,
                    }}
                  />
                </span>
                <span className="bar-row__value">
                  {row.mine}
                  {diff !== null && diff !== 0 && (
                    <span
                      className={`bar-row__diff ${diff > 0 ? "is-up" : "is-down"}`}
                    >
                      {diff > 0 ? "▲" : "▼"}
                      {Math.abs(diff)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {national && (
        <p className="panel__desc" style={{ margin: 0 }}>
          ▲▼ 는 같은 지표 체계의 전국 평균과 비교한 차이입니다. 점수는 100점
          환산 기준입니다.
        </p>
      )}
    </div>
  );
}
