import { regionsBySido } from "@/lib/regions";
import { getAllRegionStats, getNationalStats, round1 } from "@/lib/region-data";
import StatTile from "@/components/region/StatTile";
import DataNotice from "@/components/region/DataNotice";
import Adsense from "@/components/Adsense";
import { AD_SLOTS } from "@/lib/ads";

/**
 * 지역 허브 `/지역`.
 *
 * 시도별로 시군구를 나열한다. 아직 데이터가 없는 지역도 목록에는 남기되
 * 흐리게 표시해서, 크롤러와 사람 모두 어디가 채워졌는지 알 수 있게 한다.
 */
export default async function RegionHubView() {
  const [stats, national] = await Promise.all([
    getAllRegionStats(),
    getNationalStats(),
  ]);

  const groups = regionsBySido();

  return (
    <>
      <div className="page-head">
        <h1>
          <span aria-hidden>📍</span>
          지역별 장기요양기관 평가 결과
        </h1>
        <p>
          시군구를 고르면 그 지역 장기요양기관의 평가등급·총점·평가일자를 볼 수
          있습니다.
        </p>
      </div>

      {national && national.facility_count > 0 && (
        <section className="stat-grid">
          <StatTile
            label="평가 대상 기관"
            value={`${national.facility_count.toLocaleString()}곳`}
            sub="전국"
          />
          <StatTile
            label="A등급 기관"
            value={`${national.grade_a.toLocaleString()}곳`}
          />
          <StatTile
            label="평균 평가총점"
            value={
              round1(national.avg_total_score) !== null
                ? `${round1(national.avg_total_score)}점`
                : "-"
            }
          />
          <StatTile
            label="집계된 시군구"
            value={`${national.region_count.toLocaleString()}곳`}
          />
        </section>
      )}

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.top} />
      </div>

      {groups.map(({ sido, regions }) => {
        const filled = regions.filter(
          (r) => (stats.get(r.slug)?.facility_count ?? 0) > 0,
        ).length;

        return (
          <section className="sido-block" key={sido.short} id={sido.short}>
            <h2 className="sido-block__title">
              <span aria-hidden>{sido.emoji}</span>
              {sido.name}
              <span className="sido-block__count">
                {filled > 0
                  ? `${filled}개 지역 집계 완료`
                  : "데이터 준비 중"}
              </span>
            </h2>
            <div className="region-chips">
              {regions.map((region) => {
                const count = stats.get(region.slug)?.facility_count ?? 0;
                return (
                  <a
                    target="_self"
                    key={region.slug}
                    href={`/${region.slug}`}
                    data-empty={count === 0 ? "true" : undefined}
                  >
                    {region.sigungu || region.name}
                    {count > 0 && (
                      <span style={{ fontSize: 11, color: "#8b9184" }}>
                        {count}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}

      <DataNotice />

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.bottom} />
      </div>
    </>
  );
}
