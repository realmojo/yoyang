import { OFFICIAL_LINKS } from "@/lib/menu";

/**
 * 지역 페이지 하단 공통 안내.
 *
 * 두 가지를 반드시 말한다.
 *   1) 평가는 급여종류별 3년 주기라 등급이 최신 상태가 아닐 수 있다
 *   2) 비급여(식사재료비·상급침실·이미용비)는 기관이 자율 결정하므로
 *      실제 부담액은 계약 전에 직접 확인해야 한다
 *
 * 기관별 비급여 금액을 제공하는 개방 데이터는 없다. 금액을 단정하지 않고
 * 구조만 설명한 뒤 공식 사이트로 넘기는 것이 이 사이트의 원칙이다.
 */
export default function DataNotice() {
  return (
    <div className="notice">
      <p style={{ margin: "0 0 8px" }}>
        <strong>이 페이지를 읽을 때 알아둘 것</strong>
      </p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>
          장기요양기관 정기평가는 <strong>급여종류별 3년 주기</strong>로
          진행됩니다. 표에 적힌 평가일자를 함께 확인하세요. 몇 년 전 평가 결과인
          경우 현재 운영 상태와 다를 수 있습니다.
        </li>
        <li>
          식사재료비, 상급침실(1~2인실) 이용 추가비용, 이·미용비 같은{" "}
          <strong>비급여 항목은 기관이 자율적으로 정합니다.</strong> 같은
          등급이라도 실제 부담액은 기관마다 다르므로 계약 전 항목별 비용을
          설명받고 확인하세요.
        </li>
        <li>
          공개 자료는 지자체 신고 자료와 기관 제출 자료를 결합한 것이라 실제와
          다를 수 있습니다. 방문 전 전화로 확인하시기 바랍니다.
        </li>
      </ul>
      <p style={{ margin: "10px 0 0" }}>
        기관 검색과 신청은{" "}
        <a
          href={OFFICIAL_LINKS.longtermcare}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "underline" }}
        >
          국민건강보험공단 노인장기요양보험
        </a>
        에서 확인할 수 있습니다.
      </p>
    </div>
  );
}
