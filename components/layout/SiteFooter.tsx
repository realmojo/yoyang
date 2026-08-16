import { CATEGORIES } from "@/lib/contents";
import { SITE_LINKS, OFFICIAL_LINKS } from "@/lib/menu";
import { SIDOS, REGION_HUB_SLUG } from "@/lib/regions";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <div className="site-footer__logo">
              <span aria-hidden>🧡</span> 요양정보
            </div>
            <p className="site-footer__desc">
              전국 시군구별 장기요양기관 평가 결과와 장기요양등급·비용 정보를
              공개 데이터로 정리해 전합니다.
            </p>
          </div>

          <div className="site-footer__col">
            <h3>지역별</h3>
            <ul>
              <li>
                <a target="_self" href={`/${REGION_HUB_SLUG}`}>
                  전체 지역 보기
                </a>
              </li>
              {SIDOS.slice(0, 7).map((s) => (
                <li key={s.short}>
                  <a target="_self" href={`/${REGION_HUB_SLUG}#${s.short}`}>
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__col">
            <h3>가이드</h3>
            <ul>
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <a target="_self" href={`/${c.slug}`}>
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__col">
            <h3>사이트</h3>
            <ul>
              {SITE_LINKS.map((item) => (
                <li key={item.href}>
                  <a target="_self" href={item.href}>
                    {item.name}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={OFFICIAL_LINKS.longtermcare}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  노인장기요양보험 (공식)
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>© {new Date().getFullYear()} 요양정보. All rights reserved.</p>
          <p className="site-footer__note">
            평가 결과는 국민건강보험공단이 공개한 자료를 정리한 것이며, 평가
            시점 이후의 변화는 반영되지 않습니다. 기관의 현재 운영 상태와 실제
            부담 비용은 계약 전에 반드시 직접 확인하시기 바랍니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
