import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findRegion, REGION_HUB_SLUG } from "@/lib/regions";
import { getNationalStats, getRegionStats, round1 } from "@/lib/region-data";
import {
  compareAreas,
  getFacilityDetail,
  listSimilarFacilities,
  summarySentence,
  formatEvalMonth,
  type FacilityDetail,
} from "@/lib/facility";
import { absoluteUrl, breadcrumbJsonLd, buildMetadata, SITE } from "@/lib/seo";
import { decodeSlug } from "@/lib/slug";
import { OFFICIAL_LINKS } from "@/lib/menu";
import GradeBadge from "@/components/region/GradeBadge";
import StatTile from "@/components/region/StatTile";
import DataNotice from "@/components/region/DataNotice";
import Adsense from "@/components/Adsense";
import { AD_SLOTS } from "@/lib/ads";

/**
 * 기관 상세 `/경기-성남시/실버릿지판교-21113000123`.
 *
 * 지역 페이지와 같은 이유로 매 요청 렌더링한다. DB 조회는 지역 목록
 * 하나뿐이고 그건 캐시되어 있어서(lib/region-data.ts) 실제 질의는 거의 없다.
 */
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; facility: string }>;
}

async function load(params: Props["params"]) {
  const { slug, facility } = await params;
  const region = findRegion(decodeSlug(slug));
  if (!region) return null;

  const detail = await getFacilityDetail(region.slug, decodeSlug(facility));
  if (!detail) return null;

  return { region, detail };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await load(params);
  if (!loaded) return {};

  const { region, detail } = loaded;
  const { latest } = detail;

  const gradeText = latest.grade
    ? `${latest.grade}등급`
    : "평가등급 미공개";
  const scoreText =
    latest.totalScore !== null ? `, 평가총점 ${latest.totalScore}점` : "";

  return {
    ...buildMetadata({
      path: `/${region.slug}/${detail.slug}`,
      title: `${detail.name} 평가등급 · ${region.name} | ${SITE.name}`,
      description: `${region.name} ${detail.name}의 장기요양기관 평가 결과입니다. ${formatEvalMonth(latest.date)} 평가 기준 ${gradeText}${scoreText}. 급여종류 ${detail.serviceLabels.join(", ")}.`,
      keywords: [
        detail.name,
        `${detail.name} 평가등급`,
        `${region.name} 요양원`,
        ...detail.serviceLabels,
      ],
    }),
    // 이름이 바뀌어 슬러그가 달라져도 예전 주소로 들어올 수 있다.
    // canonical 은 항상 현재 슬러그를 가리킨다.
    alternates: { canonical: absoluteUrl(`/${region.slug}/${detail.slug}`) },
  };
}

export default async function FacilityPage({ params }: Props) {
  const loaded = await load(params);
  if (!loaded) notFound();

  const { region, detail } = loaded;
  const [stats, national, similar] = await Promise.all([
    getRegionStats(region.slug),
    getNationalStats(),
    listSimilarFacilities(detail, 6),
  ]);

  const comparison = compareAreas(detail, stats, region.name);
  const summary = summarySentence(detail, region.name, national);
  const regionAvg = round1(stats?.avg_total_score ?? null);

  const crumbs = breadcrumbJsonLd([
    { name: "홈", path: "/" },
    { name: "지역별", path: `/${REGION_HUB_SLUG}` },
    { name: region.name, path: `/${region.slug}` },
    { name: detail.name, path: `/${region.slug}/${detail.slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />

      <nav className="crumbs" aria-label="이동 경로">
        <a target="_self" href={`/${REGION_HUB_SLUG}`}>
          지역별
        </a>
        <span aria-hidden>›</span>
        <a target="_self" href={`/${region.slug}`}>
          {region.name}
        </a>
      </nav>

      <div className="page-head">
        <h1>{detail.name}</h1>
        <p>
          {region.name}
          {detail.sigunguDetail ? ` ${detail.sigunguDetail}` : ""} ·{" "}
          {detail.serviceLabels.join(" · ")}
          {detail.founder ? ` · ${detail.founder}` : ""}
        </p>
      </div>

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.top} />
      </div>

      <section className="stat-grid">
        <StatTile
          label="평가등급"
          value={detail.latest.grade ?? "—"}
          sub={formatEvalMonth(detail.latest.date)}
        />
        <StatTile
          label="평가총점"
          value={
            detail.latest.totalScore !== null
              ? `${detail.latest.totalScore}점`
              : "—"
          }
          sub={regionAvg !== null ? `지역 평균 ${regionAvg}점` : undefined}
        />
        <StatTile
          label={`${region.name} 순위`}
          value={detail.rank !== null ? `${detail.rank}위` : "—"}
          sub={detail.rankTotal > 0 ? `${detail.rankTotal}곳 중` : undefined}
        />
        <StatTile
          label="같은 급여종류 순위"
          value={detail.serviceRank !== null ? `${detail.serviceRank}위` : "—"}
          sub={
            detail.serviceRankTotal > 0
              ? `${detail.latest.serviceLabel} ${detail.serviceRankTotal}곳 중`
              : undefined
          }
        />
      </section>

      {summary && (
        <div className="panel">
          <p className="panel__desc" style={{ margin: 0 }}>
            {summary}
          </p>
        </div>
      )}

      {comparison && (
        <section className="panel">
          <h2 className="panel__title">영역별 점수</h2>
          <p className="panel__desc">
            {comparison.system.label} · {comparison.system.note} 막대 옆 숫자는{" "}
            {region.name} 평균과의 차이입니다.
          </p>
          {comparison.rows.map((row) => (
            <div className="bar-row" key={row.label}>
              <span className="bar-row__label">{row.label}</span>
              <span className="bar-row__track">
                <span
                  className="bar-row__fill"
                  style={{ width: `${Math.min(100, Math.max(0, row.mine))}%` }}
                />
              </span>
              <span className="bar-row__value">
                {row.mine}
                {row.diff !== null && row.diff !== 0 && (
                  <span
                    className={`bar-row__diff ${row.diff > 0 ? "is-up" : "is-down"}`}
                  >
                    {row.diff > 0 ? "▲" : "▼"}
                    {Math.abs(row.diff)}
                  </span>
                )}
              </span>
            </div>
          ))}
          {comparison.sentence && (
            <p className="panel__desc" style={{ margin: "12px 0 0" }}>
              {comparison.sentence}
            </p>
          )}
        </section>
      )}

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.middle} />
      </div>

      <section className="panel">
        <h2 className="panel__title">평가 이력</h2>
        <p className="panel__desc">
          {detail.records.length > 1
            ? "급여종류와 평가 회차별 결과입니다. 회차마다 지표 체계가 다를 수 있어 총점을 그대로 비교하기 어려운 경우가 있습니다."
            : "이 기관의 공개된 평가는 아래 한 건입니다. 정기평가가 급여종류별 3년 주기라 다음 평가까지 시간이 걸릴 수 있습니다."}
        </p>
        <div className="table-scroll">
          <table className="fac-table">
            <thead>
              <tr>
                <th scope="col">평가</th>
                <th scope="col">급여종류</th>
                <th scope="col">등급</th>
                <th scope="col" className="is-num">
                  총점
                </th>
                <th scope="col" className="is-num">
                  평가일자
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.records.map((r, i) => (
                <tr key={`${r.serviceType}-${r.date}-${i}`}>
                  <td>{r.round ? `${r.round}년 정기평가` : "-"}</td>
                  <td>{r.serviceLabel}</td>
                  <td>
                    <GradeBadge grade={r.grade} />
                  </td>
                  <td className="is-num">
                    {r.totalScore === null ? "-" : r.totalScore.toFixed(1)}
                  </td>
                  <td className="is-num">
                    {r.date ? r.date.replace(/-/g, ".") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="notice">
        <p style={{ margin: "0 0 8px" }}>
          <strong>이 기관에 연락하기 전에</strong>
        </p>
        <p style={{ margin: 0 }}>
          이 페이지에는 <strong>주소·전화번호·정원 정보가 없습니다.</strong>{" "}
          공단이 공개하는 평가 결과 데이터에 포함되지 않는 항목이라, 확인되지
          않은 값을 적는 대신 비워 두었습니다. 연락처와 현재 운영 상태는{" "}
          <a
            href={OFFICIAL_LINKS.longtermcare}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "underline" }}
          >
            노인장기요양보험 기관 찾기
          </a>
          에서 기관명으로 검색해 확인하세요.
        </p>
      </div>

      {similar.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">
            {region.name}의 비슷한 기관
          </h2>
          <p className="panel__desc">
            같은 급여종류를 운영하는 관내 다른 기관입니다.
          </p>
          <div className="table-scroll">
            <table className="fac-table">
              <thead>
                <tr>
                  <th scope="col">기관명</th>
                  <th scope="col">등급</th>
                  <th scope="col" className="is-num">
                    총점
                  </th>
                </tr>
              </thead>
              <tbody>
                {similar.map((item) => (
                  <tr key={item.slug}>
                    <td>
                      <a
                        target="_self"
                        href={`/${region.slug}/${item.slug}`}
                        className="fac-table__link"
                      >
                        {item.name}
                      </a>
                      <span className="fac-table__meta">{item.service}</span>
                    </td>
                    <td>
                      <GradeBadge grade={item.grade} />
                    </td>
                    <td className="is-num">
                      {item.score === null ? "-" : item.score.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel__desc" style={{ margin: "14px 0 0" }}>
            <a
              target="_self"
              href={`/${region.slug}`}
              style={{ textDecoration: "underline" }}
            >
              {region.name} 전체 기관 보기
            </a>
          </p>
        </section>
      )}

      <DataNotice />

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.bottom} />
      </div>
    </>
  );
}

export type { FacilityDetail };
