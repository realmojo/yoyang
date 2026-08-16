import { CATEGORIES, listContents } from "@/lib/contents";
import { ContentCard } from "@/components/contents/ContentCard";
import { REGION_HUB_SLUG, SIDOS } from "@/lib/regions";
import { getNationalStats, round1 } from "@/lib/region-data";
import StatTile from "@/components/region/StatTile";
import Adsense from "@/components/Adsense";
import { AD_SLOTS } from "@/lib/ads";

export const revalidate = 300;

export default async function HomePage() {
  const [{ items: latest }, national] = await Promise.all([
    listContents({ perPage: 6 }),
    getNationalStats(),
  ]);

  const heroItems = latest.slice(0, 2);
  const rest = latest.slice(2);

  const gradeATotal = national?.grade_a ?? 0;
  const facilityTotal = national?.facility_count ?? 0;

  return (
    <>
      <div className="page-head">
        <h1>
          <span aria-hidden>🧡</span>
          우리 동네 요양기관, 평가 결과부터 봅니다
        </h1>
        <p>
          국민건강보험공단이 공개한 장기요양기관 평가 결과를 시군구별로 정리해
          보여줍니다. 등급뿐 아니라 <strong>평가일자</strong>를 함께 확인하세요.
        </p>
      </div>

      {national && facilityTotal > 0 && (
        <section className="stat-grid">
          <StatTile
            label="평가 대상 기관"
            value={`${facilityTotal.toLocaleString()}곳`}
            sub={`전국 · 평가 ${national.eval_count.toLocaleString()}건`}
          />
          <StatTile
            label="A등급 기관"
            value={`${gradeATotal.toLocaleString()}곳`}
            sub={
              facilityTotal > 0
                ? `전체의 ${Math.round((gradeATotal / facilityTotal) * 100)}%`
                : undefined
            }
          />
          <StatTile
            label="평균 평가총점"
            value={
              round1(national.avg_total_score) !== null
                ? `${round1(national.avg_total_score)}점`
                : "-"
            }
            sub="전국 평균"
          />
          <StatTile
            label="집계된 시군구"
            value={`${national.region_count.toLocaleString()}곳`}
            sub="지역 페이지"
          />
        </section>
      )}

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.home} />
      </div>

      {/* 지역 진입 — 이 사이트의 본체 */}
      <section style={{ marginBottom: 36 }}>
        <div className="sec-head">
          <h2 className="sec-title">지역별 평가 결과</h2>
          <a
            target="_self"
            href={`/${REGION_HUB_SLUG}`}
            className="cat-section__more"
          >
            전체 지역 보기
          </a>
        </div>
        <div className="sido-block">
          <div className="region-chips">
            {SIDOS.map((sido) => (
              <a
                target="_self"
                key={sido.short}
                href={`/${REGION_HUB_SLUG}#${sido.short}`}
              >
                <span aria-hidden>{sido.emoji}</span>
                {sido.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 가이드 글 */}
      {heroItems.length > 0 && (
        <section className="hero">
          {heroItems.map((item) => (
            <ContentCard key={item.id} item={item} main />
          ))}
        </section>
      )}

      {rest.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div className="sec-head">
            <h2 className="sec-title">최신 가이드</h2>
          </div>
          <div className="post-grid">
            {rest.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* 카테고리 진입 카드 */}
      <section>
        <div className="sec-head">
          <h2 className="sec-title">알아두면 좋은 것들</h2>
        </div>
        <div className="bento-grid">
          {CATEGORIES.map((category) => (
            <a
              target="_self"
              key={category.slug}
              href={`/${category.slug}`}
              className="bento-card"
            >
              <div className="bento-card__icon" aria-hidden>
                {category.emoji}
              </div>
              <h3 className="bento-card__title">{category.name}</h3>
              <p className="bento-card__desc">{category.description}</p>
            </a>
          ))}
        </div>
      </section>

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.home} />
      </div>
    </>
  );
}
