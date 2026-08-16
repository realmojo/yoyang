import type { Metadata } from "next";
import { buildMetadata, SITE } from "@/lib/seo";
import { OFFICIAL_LINKS } from "@/lib/menu";
import { REGION_HUB_SLUG } from "@/lib/regions";

export const metadata: Metadata = buildMetadata({
  path: "/about",
  title: `사이트 소개 | ${SITE.name}`,
  description:
    "요양정보는 국민건강보험공단이 공개한 장기요양기관 평가 결과를 시군구별로 정리해 보여주는 사이트입니다. 데이터 출처와 한계를 함께 밝힙니다.",
});

export default function AboutPage() {
  return (
    <>
      <div className="page-head">
        <h1>
          <span aria-hidden>🧡</span>
          사이트 소개
        </h1>
        <p>
          부모님 모실 곳을 알아볼 때 가장 먼저 필요한 것은 광고가 아니라
          공개된 사실입니다.
        </p>
      </div>

      <section className="panel">
        <h2 className="panel__title">무엇을 하는 사이트인가요</h2>
        <p className="panel__desc">
          {SITE.name}는 국민건강보험공단이 공개한{" "}
          <strong>장기요양기관 평가 결과</strong>를 시군구 단위로 정리해
          보여줍니다. 어느 기관이 어떤 등급을 받았는지, 그 평가가 언제 이뤄진
          것인지, 우리 지역 평균이 전국과 비교해 어디쯤인지를 한 페이지에서
          볼 수 있게 만드는 것이 목표입니다.
        </p>
        <p className="panel__desc" style={{ marginBottom: 0 }}>
          여기에 더해 장기요양등급 신청 절차, 비용 구조, 시설 선택 기준처럼
          지역과 상관없이 공통으로 알아야 할 내용을 가이드로 정리합니다.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel__title">데이터 출처</h2>
        <p className="panel__desc">
          지역 페이지의 모든 수치는 공공데이터포털에 공개된{" "}
          <a
            href={OFFICIAL_LINKS.dataset}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "underline" }}
          >
            국민건강보험공단 장기요양기관 평가 결과
          </a>{" "}
          자료를 그대로 집계한 것입니다. 원본에 없는 값을 추정해서 채우지
          않습니다.
        </p>
        <ul className="panel__desc" style={{ paddingLeft: 18, marginBottom: 0 }}>
          <li>제공 기관: 국민건강보험공단</li>
          <li>갱신 주기: 연 1회</li>
          <li>포함 항목: 기관명, 급여종류, 설립주체, 관할 시도·시군구, 평가일자, 평가등급, 평가총점, 영역별 점수</li>
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel__title">이 사이트가 하지 않는 것</h2>
        <ul className="panel__desc" style={{ paddingLeft: 18, marginBottom: 0 }}>
          <li>
            <strong>기관을 추천하거나 순위를 매기지 않습니다.</strong> 등급과
            점수는 공단이 매긴 값이고, 저희는 그것을 지역별로 모아 보여줄 뿐입니다.
          </li>
          <li>
            <strong>기관별 실제 부담 비용을 안내하지 않습니다.</strong>{" "}
            식사재료비·상급침실 이용료·이미용비 같은 비급여 항목은 기관이 자율로
            정하고, 이를 공개하는 데이터가 없습니다. 확인되지 않은 금액을
            적는 대신 확인하는 방법을 안내합니다.
          </li>
          <li>
            <strong>기관 정보를 대신 중개하지 않습니다.</strong> 상담과 신청은{" "}
            <a
              href={OFFICIAL_LINKS.longtermcare}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "underline" }}
            >
              공단
            </a>
            을 통해 진행하세요.
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel__title">알아두어야 할 한계</h2>
        <p className="panel__desc" style={{ marginBottom: 0 }}>
          장기요양기관 정기평가는 급여종류별로 3년 주기로 돌아갑니다. 그래서 모든
          기관이 매년 평가되지 않고, 지역과 급여종류에 따라 평가일자가 몇 년 전인
          경우가 있습니다. 이 사이트가 등급 옆에 <strong>평가일자를 항상 함께
          표시</strong>하는 이유입니다. 등급만 보고 현재 상태를 단정하지 마시고,
          방문과 상담으로 확인하시기 바랍니다.
        </p>
      </section>

      <div className="empty-box">
        <a
          target="_self"
          href={`/${REGION_HUB_SLUG}`}
          style={{ textDecoration: "underline" }}
        >
          지역별 평가 결과 보러 가기
        </a>
      </div>
    </>
  );
}
