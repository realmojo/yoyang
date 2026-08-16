import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findRegion, REGION_HUB_SLUG } from "@/lib/regions";
import {
  getNationalStats,
  getRegionStats,
  GRADE_LABEL,
  round1,
} from "@/lib/region-data";
import {
  buildFaq,
  compareAreas,
  getFacilityDetail,
  listSimilarFacilities,
  summarySentence,
  formatEvalMonth,
  withParticle,
} from "@/lib/facility";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  buildMetadata,
  faqJsonLd,
  SITE,
} from "@/lib/seo";
import { decodeSlug } from "@/lib/slug";
import { OFFICIAL_LINKS } from "@/lib/menu";
import Adsense from "@/components/Adsense";
import { AD_SLOTS } from "@/lib/ads";

/**
 * 기관 상세 `/경기-성남시/실버릿지판교-21113000123`.
 *
 * 화면은 가이드 글과 같은 본문 틀(single-article > entry-content)을 쓴다.
 * 통계 카드를 늘어놓는 대신 h2 / p / ul / table 로 이어지는 한 편의 문서로
 * 만든다. 검색엔진이 읽는 것은 카드가 아니라 문서 구조이고, 사람이 읽기에도
 * "이 기관이 어떤 평가를 받았고 그게 무슨 뜻인지"가 순서대로 오는 편이 낫다.
 *
 * 지역 페이지와 같은 이유로 매 요청 렌더링한다. DB 조회는 지역 목록 하나뿐이고
 * 그건 캐시되어 있어서(lib/region-data.ts) 실제 질의는 거의 없다.
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

  const gradeText = latest.grade ? `${latest.grade}등급` : "평가등급 미공개";
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
        `${detail.name} 후기`,
        `${region.name} 요양원`,
        ...detail.serviceLabels,
      ],
      type: "article",
    }),
    // 이름이 바뀌어 슬러그가 달라져도 예전 주소로 들어올 수 있다.
    // canonical 은 항상 현재 슬러그를 가리킨다.
    alternates: { canonical: absoluteUrl(`/${region.slug}/${detail.slug}`) },
  };
}

/** 본문 h2 목록. 목차와 실제 제목이 어긋나지 않게 한 곳에서 관리한다. */
interface Section {
  id: string;
  title: string;
  show: boolean;
}

export default async function FacilityPage({ params }: Props) {
  const loaded = await load(params);
  if (!loaded) notFound();

  const { region, detail } = loaded;
  const [stats, national, similar] = await Promise.all([
    getRegionStats(region.slug),
    getNationalStats(),
    listSimilarFacilities(detail, 8),
  ]);

  const { latest } = detail;
  const comparison = compareAreas(detail, stats, region.name);
  const summary = summarySentence(detail, region.name, national);
  const faq = buildFaq(detail, region.name, stats, national);

  const regionAvg = round1(stats?.avg_total_score ?? null);
  const nationalAvg = round1(national?.avg_total_score ?? null);
  const percentile =
    detail.rank !== null && detail.rankTotal > 0
      ? Math.round((detail.rank / detail.rankTotal) * 100)
      : null;

  const sections: Section[] = [
    { id: "summary", title: "평가 결과 한눈에 보기", show: true },
    {
      id: "grade",
      title: latest.grade
        ? `${latest.grade}등급은 어떤 뜻인가`
        : "평가등급이 없는 이유",
      show: true,
    },
    { id: "areas", title: "영역별 점수", show: comparison !== null },
    { id: "history", title: "평가 이력", show: true },
    {
      id: "rank",
      title: `${region.name} 안에서의 위치`,
      show: detail.rank !== null && detail.rankTotal > 1,
    },
    { id: "check", title: "알아보기 전에 확인할 것", show: true },
    {
      id: "similar",
      title: `${region.name}의 비슷한 기관`,
      show: similar.length > 0,
    },
    { id: "faq", title: "자주 묻는 질문", show: faq.length > 0 },
  ].filter((s) => s.show);

  const crumbs = breadcrumbJsonLd([
    { name: "홈", path: "/" },
    { name: "지역별", path: `/${REGION_HUB_SLUG}` },
    { name: region.name, path: `/${region.slug}` },
    { name: detail.name, path: `/${region.slug}/${detail.slug}` },
  ]);

  return (
    <div className="single-wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      {faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              faqJsonLd(faq.map((f) => ({ question: f.q, answer: f.a }))),
            ),
          }}
        />
      )}

      <article className="single-article">
        <div className="single-article__inner">
          <nav className="crumbs" aria-label="이동 경로">
            <a target="_self" href={`/${REGION_HUB_SLUG}`}>
              지역별
            </a>
            <span aria-hidden>›</span>
            <a target="_self" href={`/${region.slug}`}>
              {region.name}
            </a>
          </nav>

          <header className="entry-header">
            <h1 className="entry-title">
              {detail.name} 평가등급 — {region.name} 장기요양기관
            </h1>
            <div className="entry-header__bottom">
              <div className="entry-meta">
                <span>{SITE.name}</span>
                <span className="entry-meta__sep" />
                <time dateTime={latest.date ?? undefined}>
                  {formatEvalMonth(latest.date)} 평가 기준
                </time>
              </div>
              <a
                target="_self"
                href={`/${region.slug}`}
                className="entry-cat cat-badge cat-badge--region"
              >
                {region.name}
              </a>
            </div>
          </header>

          <div className="entry-content">
            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.top} />
            </div>

            <p className="entry-lead">{summary}</p>

            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.middle} />
            </div>

            <nav className="toc" aria-label="목차">
              <p className="toc__title">📑 목차</p>
              <ol className="toc__list">
                {sections.map((s) => (
                  <li key={s.id} data-depth={2}>
                    <a href={`#${s.id}`}>{s.title}</a>
                  </li>
                ))}
              </ol>
            </nav>

            {/* ------------------------- 한눈에 보기 ------------------------- */}
            <h2 id="summary">평가 결과 한눈에 보기</h2>
            <p>
              아래는 국민건강보험공단이 공개한 장기요양기관 평가 결과에서
              {" "}
              {detail.name} 항목만 뽑아 정리한 것입니다. 모든 값은{" "}
              <strong>{formatEvalMonth(latest.date)} 평가 시점 기준</strong>
              입니다.
            </p>
            <table>
              <tbody>
                <tr>
                  <th scope="row">기관명</th>
                  <td>{detail.name}</td>
                </tr>
                <tr>
                  <th scope="row">소재 지역</th>
                  <td>
                    {region.name}
                    {detail.sigunguDetail ? ` ${detail.sigunguDetail}` : ""}
                  </td>
                </tr>
                <tr>
                  <th scope="row">급여종류</th>
                  <td>{detail.serviceLabels.join(", ")}</td>
                </tr>
                <tr>
                  <th scope="row">설립주체</th>
                  <td>{detail.founder ?? "미상"}</td>
                </tr>
                <tr>
                  <th scope="row">평가등급</th>
                  <td>
                    {latest.grade
                      ? `${latest.grade}등급 (${GRADE_LABEL[latest.grade]})`
                      : "공개된 등급 없음"}
                  </td>
                </tr>
                <tr>
                  <th scope="row">평가총점</th>
                  <td>
                    {latest.totalScore !== null
                      ? `${latest.totalScore}점`
                      : "-"}
                    {regionAvg !== null &&
                      ` (${region.name} 평균 ${regionAvg}점)`}
                  </td>
                </tr>
                <tr>
                  <th scope="row">평가일자</th>
                  <td>
                    {latest.date ? latest.date.replace(/-/g, ".") : "-"}
                    {latest.round ? ` (${latest.round}년 정기평가)` : ""}
                  </td>
                </tr>
                {detail.rank !== null && detail.rankTotal > 1 && (
                  <tr>
                    <th scope="row">{region.name} 순위</th>
                    <td>
                      {detail.rankTotal}곳 중 {detail.rank}위
                      {percentile !== null && ` (상위 ${percentile}%)`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* --------------------------- 등급 의미 --------------------------- */}
            <h2 id="grade">
              {latest.grade
                ? `${latest.grade}등급은 어떤 뜻인가`
                : "평가등급이 없는 이유"}
            </h2>

            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.bottom} />
            </div>

            {latest.grade ? (
              <>
                <p>
                  공단은 장기요양기관을 평가해 A부터 E까지 다섯 단계로 공개합니다.
                  다른 기관과 견주어 매기는 상대평가가 아니라{" "}
                  <strong>정해진 기준을 넘겼는지 보는 절대평가</strong>입니다.
                  그래서 지역에 따라 A등급이 몰려 있기도 하고 거의 없기도 합니다.
                </p>
                <ul>
                  <li>
                    <strong>A</strong> — 최우수
                  </li>
                  <li>
                    <strong>B</strong> — 우수
                  </li>
                  <li>
                    <strong>C</strong> — 양호
                  </li>
                  <li>
                    <strong>D</strong> — 보통
                  </li>
                  <li>
                    <strong>E</strong> — 미흡
                  </li>
                </ul>
                <p>
                  {withParticle(detail.name, "은는")}{" "}
                  <strong>
                    {latest.grade}등급({GRADE_LABEL[latest.grade]})
                  </strong>
                  을 받았습니다.
                  {stats &&
                    ` ${region.name}에서 A등급을 받은 기관은 ${stats.facility_count}곳 가운데 ${stats.grade_a}곳입니다.`}
                  {nationalAvg !== null &&
                    latest.totalScore !== null &&
                    ` 평가총점은 전국 평균 ${nationalAvg}점과 비교해 ${Math.abs(round1(latest.totalScore - nationalAvg)!)}점 ${latest.totalScore >= nationalAvg ? "높습니다" : "낮습니다"}.`}
                </p>
              </>
            ) : (
              <p>
                이 기관은 공개된 평가 등급이 없습니다. 문제가 있다는 뜻이 아니라
                아직 평가 회차가 돌아오지 않았거나 평가 대상이 아니었을 수
                있습니다. 정기평가는 급여종류별로 3년 주기로 진행되어 새로 문을
                연 기관은 등급이 없는 경우가 흔합니다.
              </p>
            )}

            {/* -------------------------- 영역별 점수 -------------------------- */}
            {comparison && (
              <>
                <h2 id="areas">영역별 점수</h2>
                <p>
                  평가는 총점 하나로만 나오지 않고 영역을 나눠 채점합니다.{" "}
                  {detail.name}의 최근 평가는{" "}
                  <strong>{comparison.system.label}</strong>이 적용되어{" "}
                  {comparison.system.fields.length}개 영역으로 나뉩니다. 공단이
                  2025년 정기평가부터 지표 체계를 바꿨기 때문에, 체계가 다른
                  기관끼리는 영역 점수를 그대로 견주기 어렵습니다.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">영역</th>
                      <th scope="col">{detail.name}</th>
                      <th scope="col">{region.name} 평균</th>
                      <th scope="col">차이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        <td>{row.mine}</td>
                        <td>{row.region ?? "-"}</td>
                        <td>
                          {row.diff === null
                            ? "-"
                            : row.diff === 0
                              ? "±0"
                              : `${row.diff > 0 ? "+" : "−"}${Math.abs(row.diff)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {comparison.sentence && <p>{comparison.sentence}</p>}
              </>
            )}

            {/* --------------------------- 평가 이력 --------------------------- */}
            <h2 id="history">평가 이력</h2>
            <p>
              {detail.records.length > 1
                ? "급여종류와 평가 회차별 결과입니다. 회차마다 지표 체계가 달라질 수 있어 총점을 그대로 비교하기 어려운 경우가 있습니다."
                : "공개된 평가는 아래 한 건입니다. 정기평가가 급여종류별 3년 주기로 돌아가기 때문에 다음 평가까지 시간이 걸릴 수 있습니다."}
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">평가 회차</th>
                  <th scope="col">급여종류</th>
                  <th scope="col">등급</th>
                  <th scope="col">총점</th>
                  <th scope="col">평가일자</th>
                </tr>
              </thead>
              <tbody>
                {detail.records.map((r, i) => (
                  <tr key={`${r.serviceType}-${r.date}-${i}`}>
                    <td>{r.round ? `${r.round}년 정기평가` : "-"}</td>
                    <td>{r.serviceLabel}</td>
                    <td>
                      {r.grade
                        ? `${r.grade} (${GRADE_LABEL[r.grade]})`
                        : "미공개"}
                    </td>
                    <td>{r.totalScore === null ? "-" : r.totalScore}</td>
                    <td>{r.date ? r.date.replace(/-/g, ".") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ---------------------------- 지역 순위 ---------------------------- */}
            {detail.rank !== null && detail.rankTotal > 1 && (
              <>
                <h2 id="rank">{region.name} 안에서의 위치</h2>
                <p>
                  평가총점만 놓고 줄을 세우면 {withParticle(detail.name, "이가")}{" "}
                  어디쯤인지 볼 수 있습니다. 다만 급여종류와 평가 시점이 기관마다
                  달라서 <strong>순위를 그대로 우열로 읽기는 어렵습니다.</strong>{" "}
                  같은 조건끼리 견주라고 급여종류별 순위를 따로 두었습니다.
                </p>
                <ul>
                  <li>
                    <strong>{region.name} 전체</strong> — 평가 대상{" "}
                    {detail.rankTotal}곳 중 {detail.rank}위
                    {percentile !== null && ` (상위 ${percentile}%)`}
                  </li>
                  {detail.serviceRank !== null &&
                    detail.serviceRankTotal > 1 && (
                      <li>
                        <strong>{latest.serviceLabel}</strong> — 같은 급여종류{" "}
                        {detail.serviceRankTotal}곳 중 {detail.serviceRank}위
                      </li>
                    )}
                  {regionAvg !== null && latest.totalScore !== null && (
                    <li>
                      <strong>{region.name} 평균과의 차이</strong> —{" "}
                      {round1(latest.totalScore - regionAvg)! >= 0 ? "+" : "−"}
                      {Math.abs(round1(latest.totalScore - regionAvg)!)}점
                    </li>
                  )}
                </ul>
              </>
            )}

            {/* --------------------------- 확인할 것 --------------------------- */}
            <h2 id="check">알아보기 전에 확인할 것</h2>
            <p>
              평가등급은 출발점이지 결론이 아닙니다. 아래 네 가지는 이 페이지의
              숫자로는 알 수 없는 것들이라 직접 확인하셔야 합니다.
            </p>
            <ul>
              <li>
                <strong>주소와 연락처</strong> — 공단이 공개하는 평가 결과
                데이터에 주소·전화번호·정원이 들어 있지 않습니다. 확인되지 않은
                정보를 적지 않으려고 비워 두었습니다.{" "}
                <a
                  href={OFFICIAL_LINKS.longtermcare}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  노인장기요양보험
                </a>
                에서 기관명으로 검색해 확인하세요.
              </li>
              <li>
                <strong>실제 부담 비용</strong> — 식사재료비, 상급침실 이용
                추가비용, 이·미용비는 기관이 자율적으로 정합니다. 등급이 같아도
                한 달 부담액은 다릅니다. 계약 전에 항목별 금액을 서면으로
                받아보세요.
              </li>
              <li>
                <strong>평가 이후의 변화</strong> — 위 등급은{" "}
                {formatEvalMonth(latest.date)} 기준입니다. 그 사이 인력이나 운영이
                달라졌을 수 있습니다.
              </li>
              <li>
                <strong>대기 여부</strong> — 자리가 없으면 등급과 무관하게 이용할
                수 없습니다. 전화로 먼저 확인하는 편이 빠릅니다.
              </li>
            </ul>
            <p>
              공개 자료는 지자체 신고 자료와 기관 제출 자료를 결합한 것이라 실제와
              다를 수 있습니다. <strong>방문과 상담은 생략하지 마세요.</strong>
            </p>

            {/* --------------------------- 비슷한 기관 --------------------------- */}
            {similar.length > 0 && (
              <>
                <h2 id="similar">{region.name}의 비슷한 기관</h2>
                <p>
                  같은 급여종류를 운영하는 관내 다른 기관입니다. 한 곳만 보고
                  정하기보다 두세 곳을 같은 기준으로 견주어 보시는 편이 낫습니다.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">기관명</th>
                      <th scope="col">급여종류</th>
                      <th scope="col">등급</th>
                      <th scope="col">총점</th>
                    </tr>
                  </thead>
                  <tbody>
                    {similar.map((item) => (
                      <tr key={item.slug}>
                        <th scope="row">
                          <a
                            target="_self"
                            href={`/${region.slug}/${item.slug}`}
                          >
                            {item.name}
                          </a>
                        </th>
                        <td>{item.service}</td>
                        <td>{item.grade ?? "-"}</td>
                        <td>{item.score ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  <a target="_self" href={`/${region.slug}`}>
                    {region.name} 전체 기관 목록 보기
                  </a>
                </p>
              </>
            )}

            {/* ----------------------------- FAQ ----------------------------- */}
            {faq.length > 0 && (
              <section className="faq">
                <h2 className="faq__title" id="faq">
                  자주 묻는 질문
                </h2>
                {faq.map((item, index) => (
                  <div className="faq__item" key={index}>
                    <h3 className="faq__q">{item.q}</h3>
                    <div className="faq__a">
                      <p>{item.a}</p>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>

          <footer className="entry-footer">
            <span>
              지역:{" "}
              <a target="_self" href={`/${region.slug}`}>
                {region.name}
              </a>
            </span>
            <span>
              출처: 국민건강보험공단 장기요양기관 평가 결과 ·{" "}
              {formatEvalMonth(latest.date)} 평가 기준
            </span>
          </footer>
        </div>
      </article>

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.bottom} />
      </div>
    </div>
  );
}
