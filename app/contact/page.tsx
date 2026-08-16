import type { Metadata } from "next";
import { buildMetadata, SITE } from "@/lib/seo";
import { OFFICIAL_LINKS } from "@/lib/menu";

export const metadata: Metadata = buildMetadata({
  path: "/contact",
  title: `문의하기 | ${SITE.name}`,
  description:
    "데이터 오류 제보, 제휴 문의, 정보 삭제 요청을 받습니다. 장기요양 신청·상담은 국민건강보험공단으로 문의하세요.",
});

export default function ContactPage() {
  return (
    <>
      <div className="page-head">
        <h1>
          <span aria-hidden>✉️</span>
          문의하기
        </h1>
        <p>
          잘못된 정보를 발견하셨다면 알려주세요. 확인 후 바로잡겠습니다.
        </p>
      </div>

      <section className="panel">
        <h2 className="panel__title">이메일</h2>
        <p className="panel__desc" style={{ marginBottom: 0 }}>
          <strong>support@keywordegg.com</strong>
          <br />
          평일 기준 2~3일 안에 답변드립니다.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel__title">이런 문의를 받습니다</h2>
        <ul className="panel__desc" style={{ paddingLeft: 18, marginBottom: 0 }}>
          <li>
            <strong>데이터 오류 제보</strong> — 기관명·등급·평가일자가 실제와 다른
            경우. 어느 페이지의 어떤 항목인지 함께 알려주시면 빠릅니다.
          </li>
          <li>
            <strong>기관 정보 관련 요청</strong> — 기관 운영자께서 게시 내용에
            정정이 필요하다고 판단하신 경우.
          </li>
          <li>
            <strong>제휴·광고 문의</strong>
          </li>
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel__title">이런 문의는 답변드리기 어렵습니다</h2>
        <p className="panel__desc">
          이 사이트는 공개 데이터를 정리해 보여줄 뿐, 장기요양 업무를 대행하지
          않습니다. 아래 내용은 공식 창구를 이용해 주세요.
        </p>
        <ul className="panel__desc" style={{ paddingLeft: 18, marginBottom: 0 }}>
          <li>장기요양등급 신청·판정 결과 문의</li>
          <li>특정 기관 입소 상담, 대기 순번, 비용 견적</li>
          <li>급여 한도액·본인부담금 산정</li>
        </ul>
        <p className="panel__desc" style={{ margin: "12px 0 0" }}>
          위 내용은{" "}
          <a
            href={OFFICIAL_LINKS.longtermcare}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "underline" }}
          >
            국민건강보험공단 노인장기요양보험
          </a>{" "}
          또는 공단 콜센터(1577-1000)로 문의하시면 정확한 안내를 받으실 수
          있습니다.
        </p>
      </section>
    </>
  );
}
