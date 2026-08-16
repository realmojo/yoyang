import {
  getAllRegionStats,
  getNationalStats,
  GRADE_LABEL,
  GRADES,
  type RegionStats,
} from "@/lib/region-data";
import { findRegion, REGION_HUB_SLUG } from "@/lib/regions";
import { listContents, type Category } from "@/lib/contents";
import { ContentCard } from "@/components/contents/ContentCard";
import { faqJsonLd, SITE } from "@/lib/seo";
import Adsense from "@/components/Adsense";
import { AD_SLOTS } from "@/lib/ads";

/**
 * `/등급` — 기관이 받는 평가등급 A~E 를 다루는 화면.
 *
 * 글 목록을 늘어놓는 카테고리 화면이 아니라, 우리가 가진 데이터로 만드는
 * 한 편의 문서다. 등급이 무엇인지 설명하고 전국 분포를 보여준 뒤,
 * A등급 비율이 높은 지역으로 넘긴다.
 *
 * 주의할 것이 하나 있다. 이 사이트에는 "등급"이 두 종류다.
 *   - 평가등급 A~E : 기관이 받는 등급. 이 페이지가 다루는 것
 *   - 장기요양등급 1~5 : 이용자가 받는 등급. 신청 가이드에서 다룬다
 * 헷갈리기 쉬워서 본문에서 한 번 짚어준다.
 */

/** 지역 순위에 넣을 최소 기관 수. 서너 곳뿐인 지역이 100% 로 올라오는 것을 막는다. */
const MIN_FACILITIES = 20;
const TOP_LIMIT = 20;

interface RankedRegion {
  slug: string;
  name: string;
  count: number;
  gradeA: number;
  ratio: number;
}

function rankByGradeA(stats: Map<string, RegionStats>): RankedRegion[] {
  const rows: RankedRegion[] = [];

  for (const [slug, s] of stats) {
    if (s.facility_count < MIN_FACILITIES) continue;
    const region = findRegion(slug);
    if (!region) continue;
    rows.push({
      slug,
      name: region.name,
      count: s.facility_count,
      gradeA: s.grade_a,
      ratio: s.grade_a / s.facility_count,
    });
  }

  return rows.sort((a, b) => b.ratio - a.ratio);
}

export default async function GradeView({ category }: { category: Category }) {
  const [national, regionStats, { items: guides }] = await Promise.all([
    getNationalStats(),
    getAllRegionStats(),
    listContents({ category: category.slug, perPage: 6 }),
  ]);

  const ranked = rankByGradeA(regionStats);
  const top = ranked.slice(0, TOP_LIMIT);
  const bottom = ranked.slice(-5).reverse();

  const total = national?.facility_count ?? 0;
  const gradeRows = GRADES.map((g) => {
    const key = `grade_${g.toLowerCase()}` as keyof typeof national;
    const count = (national?.[key] as number | undefined) ?? 0;
    return {
      grade: g,
      label: GRADE_LABEL[g],
      count,
      ratio: total > 0 ? count / total : 0,
    };
  });

  const graded = gradeRows.reduce((sum, r) => sum + r.count, 0);
  const ungraded = Math.max(0, total - graded);

  const faq = [
    {
      q: "장기요양기관 평가등급은 어떻게 나뉘나요?",
      a: "A(최우수), B(우수), C(양호), D(보통), E(미흡) 다섯 단계입니다. 다른 기관과 견주어 순위를 매기는 상대평가가 아니라 정해진 기준을 넘겼는지 보는 절대평가입니다.",
    },
    {
      q: "A등급이면 좋은 기관인가요?",
      a: `평가 시점 기준으로 공단이 정한 지표에서 최우수를 받았다는 뜻입니다. 전국 ${total.toLocaleString()}곳 가운데 A등급은 ${(national?.grade_a ?? 0).toLocaleString()}곳입니다. 다만 정기평가가 3년 주기라 결과가 몇 년 전 것일 수 있고, 비용과 거리는 등급에 담기지 않습니다.`,
    },
    {
      q: "평가등급과 장기요양등급은 다른 건가요?",
      a: "다릅니다. 평가등급 A~E는 기관이 받는 등급이고, 장기요양등급 1~5등급과 인지지원등급은 서비스를 이용하는 사람이 받는 등급입니다. 이름이 비슷해 자주 혼동됩니다.",
    },
  ];

  return (
    <div className="single-wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            faqJsonLd(faq.map((f) => ({ question: f.q, answer: f.a }))),
          ),
        }}
      />

      <article className="single-article">
        <div className="single-article__inner">
          <header className="entry-header">
            <h1 className="entry-title">
              장기요양기관 평가등급 A~E, 어떻게 읽어야 하나
            </h1>
            <div className="entry-header__bottom">
              <div className="entry-meta">
                <span>{SITE.name}</span>
                <span className="entry-meta__sep" />
                <span>공단 평가 결과 기준</span>
              </div>
              <span
                className={`entry-cat cat-badge cat-badge--${category.key}`}
              >
                {category.name}
              </span>
            </div>
          </header>

          <div className="entry-content">
            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.top} />
            </div>

            <p className="entry-lead">
              국민건강보험공단은 장기요양기관을 평가해 A부터 E까지 다섯 단계로
              공개합니다. 전국 {total.toLocaleString()}곳의 등급 분포와, 어느
              지역에 좋은 등급이 몰려 있는지를 실제 데이터로 정리했습니다.
            </p>

            <div className="cta-row">
              <a
                className="cta-btn"
                href={`/${REGION_HUB_SLUG}`}
                target="_self"
              >
                📍 우리 동네 기관 등급 보기
              </a>
              <a className="cta-btn cta-btn--ghost" href="#top" target="_self">
                🏆 A등급 많은 지역 보기
              </a>
            </div>

            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.middle} />
            </div>

            <nav className="toc" aria-label="목차">
              <p className="toc__title">📑 목차</p>
              <ol className="toc__list">
                <li data-depth={2}>
                  <a href="#what">평가등급은 무엇을 재는가</a>
                </li>
                <li data-depth={2}>
                  <a href="#dist">전국 등급 분포</a>
                </li>
                <li data-depth={2}>
                  <a href="#top">A등급 비율이 높은 지역</a>
                </li>
                <li data-depth={2}>
                  <a href="#gap">지역 차이가 이렇게 큽니다</a>
                </li>
                <li data-depth={2}>
                  <a href="#caution">등급을 읽을 때 주의할 점</a>
                </li>
                <li data-depth={2}>
                  <a href="#faq">자주 묻는 질문</a>
                </li>
              </ol>
            </nav>

            {/* --------------------------- 무엇을 재나 --------------------------- */}
            <h2 id="what">평가등급은 무엇을 재는가</h2>
            <p>
              평가는 시설이 깨끗한지만 보는 것이 아닙니다. 기관 운영, 환경과
              안전, 수급자 권리 보장, 서비스 제공 과정과 결과 같은 영역을 나눠
              채점하고 합산합니다. 그 결과가 다섯 단계로 공개됩니다.
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
              중요한 것은 <strong>절대평가</strong>라는 점입니다. 상위 몇 퍼센트를
              잘라 A를 주는 방식이 아니라 정해진 기준을 넘기면 A입니다. 그래서
              지역에 따라 A등급이 몰려 있기도 하고 거의 없기도 합니다.
            </p>
            <p>
              하나 더. 이 사이트에는 이름이 비슷한 등급이 두 개 나옵니다.{" "}
              <strong>평가등급 A~E는 기관이 받는 등급</strong>이고,{" "}
              <strong>장기요양등급 1~5등급과 인지지원등급</strong>은 서비스를
              이용하는 사람이 받는 등급입니다. 신청과 판정 절차는{" "}
              <a target="_self" href="/장기요양등급-신청-절차">
                장기요양등급 신청 절차
              </a>
              에서 다룹니다.
            </p>

            {/* ---------------------------- 전국 분포 ---------------------------- */}
            <h2 id="dist">전국 등급 분포</h2>

            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.bottom} />
            </div>

            {total > 0 ? (
              <>
                <p>
                  공단이 공개한 평가 결과에 들어 있는 전국{" "}
                  {total.toLocaleString()}곳의 등급 분포입니다. 기관마다 가장
                  최근 평가 한 건을 기준으로 셌습니다.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">등급</th>
                      <th scope="col">구분</th>
                      <th scope="col">기관 수</th>
                      <th scope="col">비율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeRows.map((row) => (
                      <tr key={row.grade}>
                        <th scope="row">{row.grade}</th>
                        <td>{row.label}</td>
                        <td>{row.count.toLocaleString()}곳</td>
                        <td>{Math.round(row.ratio * 100)}%</td>
                      </tr>
                    ))}
                    {ungraded > 0 && (
                      <tr>
                        <th scope="row">—</th>
                        <td>등급 미공개</td>
                        <td>{ungraded.toLocaleString()}곳</td>
                        <td>{Math.round((ungraded / total) * 100)}%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <p>
                  A등급은 전체의{" "}
                  {Math.round(((national?.grade_a ?? 0) / total) * 100)}%
                  입니다. 흔하지 않지만 아주 드물지도 않습니다. 그래서 전국
                  기준으로만 보기보다{" "}
                  <strong>우리 지역 안에서 견주는 편</strong>이 실질적입니다.
                </p>
              </>
            ) : (
              <p>아직 집계된 데이터가 없습니다.</p>
            )}

            {/* -------------------------- A등급 많은 지역 -------------------------- */}
            <h2 id="top">A등급 비율이 높은 지역</h2>
            {top.length > 0 ? (
              <>
                <p>
                  관내 기관 가운데 A등급이 차지하는 비율이 높은 순서입니다.
                  기관이 너무 적으면 비율이 쉽게 튀기 때문에{" "}
                  <strong>평가 대상이 {MIN_FACILITIES}곳 이상인 지역</strong>만
                  넣었습니다.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">지역</th>
                      <th scope="col">A등급 비율</th>
                      <th scope="col">A등급</th>
                      <th scope="col">전체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((r) => (
                      <tr key={r.slug}>
                        <th scope="row">
                          <a target="_self" href={`/${r.slug}`}>
                            {r.name}
                          </a>
                        </th>
                        <td>{Math.round(r.ratio * 100)}%</td>
                        <td>{r.gradeA}곳</td>
                        <td>{r.count}곳</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p>아직 집계된 데이터가 없습니다.</p>
            )}

            {/* ---------------------------- 지역 격차 ---------------------------- */}
            {top.length > 0 && bottom.length > 0 && (
              <>
                <h2 id="gap">지역 차이가 이렇게 큽니다</h2>
                <p>
                  절대평가인데도 지역별 A등급 비율은 크게 벌어집니다. 가장 높은
                  곳은 {top[0].name} {Math.round(top[0].ratio * 100)}%, 가장 낮은
                  곳은 {bottom[0].name} {Math.round(bottom[0].ratio * 100)}%
                  입니다. 같은 A등급이라도 그 지역에서 얼마나 흔한지는 전혀
                  다릅니다.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">지역</th>
                      <th scope="col">A등급 비율</th>
                      <th scope="col">A등급</th>
                      <th scope="col">전체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottom.map((r) => (
                      <tr key={r.slug}>
                        <th scope="row">
                          <a target="_self" href={`/${r.slug}`}>
                            {r.name}
                          </a>
                        </th>
                        <td>{Math.round(r.ratio * 100)}%</td>
                        <td>{r.gradeA}곳</td>
                        <td>{r.count}곳</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  A등급이 적은 지역이라고 해서 좋은 기관이 없다는 뜻은 아닙니다.
                  선택지가 적을 뿐이므로 <strong>B등급까지 함께 보고</strong>{" "}
                  평가일자가 최근인 곳을 우선 확인하시는 편이 현실적입니다.
                </p>
              </>
            )}

            {/* ---------------------------- 주의할 점 ---------------------------- */}
            <h2 id="caution">등급을 읽을 때 주의할 점</h2>
            <p>
              등급 하나만 보고 판단하면 놓치는 것이 있습니다. 아래 세 가지는 이
              사이트가 모든 기관 표에 평가일자를 함께 적어두는 이유이기도 합니다.
            </p>
            <ul>
              <li>
                <strong>평가는 3년 주기입니다.</strong> 급여종류별로 돌아가기
                때문에 지금 보는 등급이 몇 년 전 결과일 수 있습니다. 등급 옆의
                평가일자를 반드시 함께 보세요.
              </li>
              <li>
                <strong>등급이 없는 기관도 있습니다.</strong> 문제가 있어서가
                아니라 아직 평가 회차가 돌아오지 않은 경우가 많습니다. 새로 문을
                연 기관이 대표적입니다.
              </li>
              <li>
                <strong>비용은 등급과 무관합니다.</strong> 식사재료비와 상급침실
                이용료는 기관이 자율로 정합니다.{" "}
                <a target="_self" href="/비용">
                  비용이 정해지는 구조
                </a>
                를 따로 확인하세요.
              </li>
            </ul>

            {/* ----------------------------- FAQ ----------------------------- */}
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
          </div>

          <footer className="entry-footer">
            <span>
              출처: 국민건강보험공단 장기요양기관 평가 결과
            </span>
            <span>
              <a target="_self" href={`/${REGION_HUB_SLUG}`}>
                지역별로 보기
              </a>
            </span>
          </footer>
        </div>
      </article>

      {guides.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <div className="sec-head">
            <h2 className="sec-title">{category.name} 가이드</h2>
          </div>
          <div className="post-grid">
            {guides.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.bottom} />
      </div>
    </div>
  );
}
