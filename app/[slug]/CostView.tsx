import { listContents, type Category } from "@/lib/contents";
import { ContentCard } from "@/components/contents/ContentCard";
import { REGION_HUB_SLUG } from "@/lib/regions";
import { OFFICIAL_LINKS } from "@/lib/menu";
import { faqJsonLd, SITE } from "@/lib/seo";
import Adsense from "@/components/Adsense";
import { AD_SLOTS } from "@/lib/ads";

/**
 * `/비용` — 요양 비용이 정해지는 구조를 다루는 화면.
 *
 * 기관별 실제 부담액을 제공하는 공개 데이터가 없다. 그래서 이 페이지는
 * 숫자를 보여주는 대신 **무엇을 확인해야 하는지**를 정리한다.
 *
 * 깊은 설명은 가이드 글(/요양원-비용-구조)이 맡는다. 두 페이지가 같은 말을
 * 반복하면 중복 문서가 되므로, 여기서는 갈래를 잡아주고 상담 전에 물어볼 것을
 * 체크리스트로 주는 데 집중한다.
 */

const faq = [
  {
    q: "요양원 한 달 비용은 얼마인가요?",
    a: "하나로 답할 수 없습니다. 보험이 부담하는 급여 부분은 등급과 서비스 종류에 따라 정해지지만, 식사재료비와 상급침실 이용료 같은 비급여는 기관이 자율적으로 정하기 때문입니다. 같은 지역 같은 등급이라도 실제 부담액은 다릅니다. 기관에서 항목별 금액을 받아 비교하세요.",
  },
  {
    q: "이 사이트에는 왜 기관별 비용이 없나요?",
    a: "기관별 비급여 금액을 제공하는 공개 데이터가 없기 때문입니다. 공단 기관 찾기 화면에는 표시되지만 파일이나 API 형태로는 제공되지 않습니다. 확인되지 않은 금액을 짐작해서 적으면 그것을 믿고 판단하는 분이 생기므로, 구조만 설명하고 확인하는 방법을 안내합니다.",
  },
  {
    q: "월 한도액을 넘겨서 이용하면 어떻게 되나요?",
    a: "한도를 초과한 금액에는 본인부담 비율이 적용되지 않고 초과분 전액을 본인이 부담합니다. 서비스를 넉넉히 계획하다 예상보다 많이 나오는 경우가 대부분 여기서 생깁니다.",
  },
];

export default async function CostView({ category }: { category: Category }) {
  const { items: guides } = await listContents({
    category: category.slug,
    perPage: 6,
  });

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
              요양 비용은 어떻게 정해지나 — 확인해야 할 것들
            </h1>
            <div className="entry-header__bottom">
              <div className="entry-meta">
                <span>{SITE.name}</span>
                <span className="entry-meta__sep" />
                <span>금액 대신 구조</span>
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
              &ldquo;한 달에 얼마 드나요&rdquo;에는 하나의 답이 없습니다. 보험이
              부담하는 부분과 기관이 자율로 정하는 부분이 섞여 있어서입니다. 그
              구조를 알면 상담 자리에서 무엇을 물어야 하는지가 분명해집니다.
            </p>

            <div className="cta-row">
              <a
                className="cta-btn"
                href="/요양원-비용-구조"
                target="_self"
              >
                💳 비용 구조 자세히 보기
              </a>
              <a
                className="cta-btn cta-btn--ghost"
                href={`/${REGION_HUB_SLUG}`}
                target="_self"
              >
                🏥 우리 동네 기관 찾기
              </a>
              <p className="cta-row__note">
                기관별 실제 부담액은 공개 데이터가 없어 이 사이트에 없습니다.
                금액은 기관과{" "}
                <a
                  href={OFFICIAL_LINKS.longtermcare}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  공단
                </a>
                에서 확인하세요.
              </p>
            </div>

            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.middle} />
            </div>

            <nav className="toc" aria-label="목차">
              <p className="toc__title">📑 목차</p>
              <ol className="toc__list">
                <li data-depth={2}>
                  <a href="#split">비용은 두 갈래로 나뉜다</a>
                </li>
                <li data-depth={2}>
                  <a href="#vary">기관마다 달라지는 항목</a>
                </li>
                <li data-depth={2}>
                  <a href="#checklist">상담 전에 물어볼 네 가지</a>
                </li>
                <li data-depth={2}>
                  <a href="#relief">부담을 줄이는 제도</a>
                </li>
                <li data-depth={2}>
                  <a href="#nonumber">이 사이트에 금액이 없는 이유</a>
                </li>
                <li data-depth={2}>
                  <a href="#faq">자주 묻는 질문</a>
                </li>
              </ol>
            </nav>

            {/* --------------------------- 두 갈래 --------------------------- */}
            <h2 id="split">비용은 두 갈래로 나뉜다</h2>
            <p>
              먼저 이 구분부터 잡으면 나머지가 따라옵니다. 통장에서 나가는 돈은
              아래 두 갈래를 합친 값입니다.
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">구분</th>
                  <th scope="col">누가 부담하나</th>
                  <th scope="col">기관마다 다른가</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">급여</th>
                  <td>
                    등급별 월 한도 안에서 정해진 비율만 본인 부담, 나머지는 보험
                  </td>
                  <td>아니오 (기준이 정해져 있음)</td>
                </tr>
                <tr>
                  <th scope="row">비급여</th>
                  <td>전액 본인 부담</td>
                  <td>
                    <strong>예 (기관이 자율 결정)</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              기관을 비교할 때 차이가 생기는 곳은 거의 언제나 비급여 쪽입니다.
              급여 부분에서 꼭 알아두실 것은 하나입니다 —{" "}
              <strong>한도를 넘긴 금액에는 부담 비율이 적용되지 않고 초과분
              전액을 본인이 냅니다.</strong>
            </p>

            {/* -------------------------- 달라지는 항목 -------------------------- */}
            <h2 id="vary">기관마다 달라지는 항목</h2>

            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.bottom} />
            </div>

            <p>
              시설급여를 이용할 때 아래 항목은 각 기관이 스스로 정합니다. 같은
              지역, 같은 평가등급이라도 한 달 부담액이 달라지는 이유입니다.
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">항목</th>
                  <th scope="col">무엇인가</th>
                  <th scope="col">확인 방법</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">식사재료비</th>
                  <td>식사에 들어가는 재료 비용</td>
                  <td>한 달 기준 금액을 묻는다</td>
                </tr>
                <tr>
                  <th scope="row">상급침실 이용료</th>
                  <td>1~2인실을 쓸 때 붙는 추가 비용</td>
                  <td>배정될 방이 몇 인실인지 먼저 확인</td>
                </tr>
                <tr>
                  <th scope="row">이·미용비</th>
                  <td>이발과 미용 비용</td>
                  <td>회당 금액과 주기를 함께 묻는다</td>
                </tr>
              </tbody>
            </table>
            <p>
              기관은 계약할 때 비급여 대상과 항목별 비용을 설명하고 동의서를
              받게 되어 있습니다. 뒤집어 말하면{" "}
              <strong>계약 전에 항목별 금액을 서면으로 확인할 권리가 있다</strong>
              는 뜻입니다.
            </p>

            {/* --------------------------- 체크리스트 --------------------------- */}
            <h2 id="checklist">상담 전에 물어볼 네 가지</h2>
            <p>
              이 네 가지만 물어도 실제 부담액이 대체로 잡힙니다. 전화 상담에서도
              충분히 확인할 수 있습니다.
            </p>
            <ol>
              <li>급여 부분의 월 본인부담금은 얼마인가</li>
              <li>식사재료비는 한 달에 얼마인가</li>
              <li>어떤 방을 쓰게 되며, 상급침실이면 추가 비용은 얼마인가</li>
              <li>그 밖에 정기적으로 나가는 비용이 또 있는가</li>
            </ol>
            <p>
              두세 곳에 같은 질문을 하고 답을 나란히 적어 두면 비교가 됩니다.
              한 곳만 보고 정하면 그 금액이 비싼지 싼지 알 수 없습니다.{" "}
              <a target="_self" href={`/${REGION_HUB_SLUG}`}>
                지역별 기관 목록
              </a>
              에서 후보를 먼저 추리세요.
            </p>

            {/* ---------------------------- 경감 제도 ---------------------------- */}
            <h2 id="relief">부담을 줄이는 제도</h2>
            <p>
              소득과 재산 수준에 따라 본인부담금을 덜어주는 제도가 있습니다. 크게
              세 갈래인데, 본인이 어디에 해당하는지는 공단에 문의하시면 확인해
              주십니다.
            </p>
            <ul>
              <li>
                <strong>의료급여 수급권자</strong> — 해당 구분에 따라 본인부담이
                없거나 상당 부분 경감됩니다
              </li>
              <li>
                <strong>소득·재산이 일정 기준 이하인 경우</strong> — 정해진
                비율만큼 경감됩니다
              </li>
              <li>
                <strong>복지용구</strong> — 월 한도액과 별개로 계산됩니다.
                다른 서비스를 한도까지 쓰고 있어도 따로 이용할 수 있습니다
              </li>
            </ul>

            {/* --------------------------- 금액이 없는 이유 --------------------------- */}
            <h2 id="nonumber">이 사이트에 금액이 없는 이유</h2>
            <p>
              솔직하게 말씀드리면, <strong>기관별 비급여 금액을 제공하는 공개
              데이터를 찾지 못했기 때문입니다.</strong> 공단 기관 찾기 화면에는
              표시되지만 파일이나 API 로는 나오지 않습니다.
            </p>
            <p>
              등급별 월 한도액과 본인부담 비율도 마찬가지입니다. 이 값들은
              고시로 정해지고 해마다 바뀝니다. 지금 적어두면 시간이 지나 틀린
              정보가 되고, 그것을 믿고 판단하는 분이 생깁니다. 부모님 모실 곳을
              정하는 데 쓰는 정보라 더 조심해야 한다고 생각합니다.
            </p>
            <p>
              그래서 이 사이트는 <strong>구조만 설명하고 금액은 공식 창구로
              넘깁니다.</strong> 현재 기준 금액은{" "}
              <a
                href={OFFICIAL_LINKS.longtermcare}
                target="_blank"
                rel="noopener noreferrer"
              >
                국민건강보험공단 노인장기요양보험
              </a>
              에서 확인하시거나 공단 콜센터(1577-1000)로 문의하세요.
            </p>

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
            <span>비급여 항목은 기관이 자율적으로 정합니다</span>
            <span>
              <a target="_self" href={`/${REGION_HUB_SLUG}`}>
                지역별 기관 보기
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
