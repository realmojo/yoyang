import {
  breakdownBy,
  comparisonSentence,
  formatEvalDate,
  getNationalStats,
  getRegionStats,
  gradeCounts,
  latestPerCode,
  latestPerCodeAndService,
  listFacilities,
  round1,
  serviceTypeLabel,
} from "@/lib/region-data";
import { REGION_HUB_SLUG, siblingRegions, type Region } from "@/lib/regions";
import { breadcrumbJsonLd, regionDatasetJsonLd } from "@/lib/seo";
import StatTile from "@/components/region/StatTile";
import FacilityTable from "@/components/region/FacilityTable";
import BreakdownList from "@/components/region/BreakdownList";
import ScoreBars from "@/components/region/ScoreBars";
import DataNotice from "@/components/region/DataNotice";
import Adsense from "@/components/Adsense";
import { AD_SLOTS } from "@/lib/ads";

/** 상단에 따로 뽑아 보여줄 상위 기관 수 */
const TOP_LIMIT = 20;

export default async function RegionView({ region }: { region: Region }) {
  const [stats, national, facilities] = await Promise.all([
    getRegionStats(region.slug),
    getNationalStats(),
    listFacilities(region.slug),
  ]);

  if (!stats || stats.facility_count === 0 || facilities.length === 0) {
    return <EmptyRegion region={region} />;
  }

  // 한 행은 기관이 아니라 평가 한 건이다. 목록과 등급 분포는 기관 단위로
  // 줄여서 보여준다. 그래야 집계(stats.facility_count)와 줄 수가 맞는다.
  // 중복을 걷어내면 원래 정렬(등급 → 총점)이 흐트러지므로 다시 세운다
  const uniqueFacilities = latestPerCode(facilities).sort((a, b) => {
    const grade = (a.grade ?? "Z").localeCompare(b.grade ?? "Z");
    if (grade !== 0) return grade;
    return (b.total_score ?? -1) - (a.total_score ?? -1);
  });
  const counts = gradeCounts(uniqueFacilities);
  const topFacilities = uniqueFacilities
    .filter((f) => f.grade === "A")
    .slice(0, TOP_LIMIT);

  // 급여종류는 한 기관이 여러 개를 운영할 수 있으므로 (기관, 급여종류) 쌍 기준
  const byService = breakdownBy(latestPerCodeAndService(facilities), (f) =>
    serviceTypeLabel(f.service_type),
  );
  const byFounder = breakdownBy(uniqueFacilities, (f) => f.founder);
  const sentence = comparisonSentence(region, stats, national);
  const siblings = siblingRegions(region);

  const description = `${region.name}의 장기요양기관 ${stats.facility_count}곳의 평가등급과 평가일자입니다. A등급 ${counts.A}곳, 평균 평가총점 ${round1(stats.avg_total_score) ?? "-"}점.`;

  const crumbs = breadcrumbJsonLd([
    { name: "홈", path: "/" },
    { name: "지역별", path: `/${REGION_HUB_SLUG}` },
    { name: region.name, path: `/${region.slug}` },
  ]);

  const dataset = regionDatasetJsonLd({
    name: `${region.name} 장기요양기관 평가 결과`,
    path: `/${region.slug}`,
    description,
    dateModified: stats.latest_eval_date,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />

      <div className="page-head">
        <span className="cat-badge cat-badge--region">{region.sidoName}</span>
        <h1>{region.name} 장기요양기관 평가 결과</h1>
        <p>
          {region.name}에서 평가를 받은 장기요양기관 {stats.facility_count}곳의
          등급·총점·평가일자를 정리했습니다.
        </p>
      </div>

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.top} />
      </div>

      <section className="stat-grid">
        <StatTile
          label="평가 대상 기관"
          value={`${stats.facility_count.toLocaleString()}곳`}
          sub={`평가 ${stats.eval_count.toLocaleString()}건`}
        />
        <StatTile
          label="A등급 (최우수)"
          value={`${counts.A}곳`}
          sub={`전체의 ${Math.round((counts.A / stats.facility_count) * 100)}%`}
        />
        <StatTile
          label="평균 평가총점"
          value={
            round1(stats.avg_total_score) !== null
              ? `${round1(stats.avg_total_score)}점`
              : "-"
          }
          sub={
            national && round1(national.avg_total_score) !== null
              ? `전국 평균 ${round1(national.avg_total_score)}점`
              : undefined
          }
        />
        <StatTile
          label="최근 평가일자"
          value={formatEvalDate(stats.latest_eval_date)}
          sub={
            stats.oldest_eval_date
              ? `가장 오래된 건 ${formatEvalDate(stats.oldest_eval_date)}`
              : undefined
          }
        />
      </section>

      {sentence && (
        <div className="panel">
          <p className="panel__desc" style={{ margin: 0 }}>
            {sentence} 등급 분포는 A {counts.A}곳 · B {counts.B}곳 · C{" "}
            {counts.C}곳 · D {counts.D}곳 · E {counts.E}곳입니다.
            {counts.none > 0 &&
              ` 이 밖에 등급이 공개되지 않은 기관이 ${counts.none}곳 있습니다.`}
          </p>
        </div>
      )}

      {topFacilities.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">A등급(최우수) 기관</h2>
          <p className="panel__desc">
            평가등급 A를 받은 기관입니다. 등급은 평가일자 기준이며, 그 이후의
            변화는 반영되지 않습니다.
          </p>
          <FacilityTable facilities={topFacilities} regionSlug={region.slug} />
        </section>
      )}

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.middle} />
      </div>

      <section className="panel">
        <h2 className="panel__title">급여종류별 분포</h2>
        <p className="panel__desc">
          같은 지역이라도 시설급여(요양원)와 재가급여(방문요양·주야간보호 등)의
          기관 수는 크게 다릅니다. 찾는 서비스가 무엇인지에 따라 선택지가
          달라집니다.
        </p>
        <BreakdownList items={byService} />
      </section>

      <section className="panel">
        <h2 className="panel__title">영역별 평균 점수</h2>
        <p className="panel__desc">
          공단이 2025년 정기평가부터 지표 체계를 바꿨습니다. 두 체계는 영역
          구성이 달라 서로 비교할 수 없으므로 나눠서 보여줍니다.
        </p>
        <ScoreBars stats={stats} national={national} />
      </section>

      <section className="panel">
        <h2 className="panel__title">설립주체 구성</h2>
        <p className="panel__desc">
          지자체·법인·개인 중 어디가 운영하는지에 따라 규모와 운영 방식이 다른
          경우가 많습니다.
        </p>
        <BreakdownList items={byFounder} />
      </section>

      <section className="panel">
        <h2 className="panel__title">
          {region.name} 전체 기관 ({uniqueFacilities.length}곳)
        </h2>
        <p className="panel__desc">
          등급이 높은 순, 같은 등급 안에서는 총점이 높은 순입니다.
        </p>
        <FacilityTable facilities={uniqueFacilities} regionSlug={region.slug} />
      </section>

      <DataNotice />

      {siblings.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">{region.sidoName}의 다른 지역</h2>
          <p className="panel__desc">
            지리적으로 인접한 순서가 아니라 같은 시도에 속한 지역 목록입니다.
          </p>
          <div className="nearby-links region-chips">
            {siblings.map((r) => (
              <a target="_self" key={r.slug} href={`/${r.slug}`}>
                {r.sigungu || r.name}
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.bottom} />
      </div>
    </>
  );
}

/** 아직 평가 데이터가 적재되지 않은 지역 */
function EmptyRegion({ region }: { region: Region }) {
  return (
    <>
      <div className="page-head">
        <span className="cat-badge cat-badge--region">{region.sidoName}</span>
        <h1>{region.name} 장기요양기관 평가 결과</h1>
        <p>아직 이 지역의 평가 데이터가 준비되지 않았습니다.</p>
      </div>

      <div className="empty-box">
        {region.name}의 평가 결과를 정리하는 중입니다.
        <br />
        <a
          target="_self"
          href={`/${REGION_HUB_SLUG}`}
          style={{ textDecoration: "underline" }}
        >
          다른 지역 보기
        </a>
      </div>

      <DataNotice />
    </>
  );
}
