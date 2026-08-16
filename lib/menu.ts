import { CATEGORIES } from "./contents";
import { REGION_HUB_SLUG } from "./regions";

export interface MenuItem {
  name: string;
  href: string;
}

/** 상단 GNB */
export const NAV: MenuItem[] = [
  { name: "홈", href: "/" },
  { name: "지역별", href: `/${REGION_HUB_SLUG}` },
  ...CATEGORIES.map((c) => ({ name: c.name, href: `/${c.slug}` })),
];

/** 푸터에 노출하는 안내 페이지 */
export const SITE_LINKS: MenuItem[] = [
  { name: "사이트 소개", href: "/about" },
  { name: "문의하기", href: "/contact" },
  { name: "개인정보처리방침", href: "/privacy" },
  { name: "이용약관", href: "/terms" },
];

/**
 * 공식 사이트 링크.
 *
 * 이 사이트는 공개 데이터를 정리해 보여줄 뿐이고, 신청·상담·기관별 실제 비용은
 * 공단에서 확인해야 한다. 확인되지 않은 숫자를 쓰는 대신 여기로 넘긴다.
 */
export const OFFICIAL_LINKS = {
  /** 국민건강보험공단 노인장기요양보험 */
  longtermcare: "https://www.longtermcare.or.kr/",
  /** 공공데이터포털 — 장기요양기관 평가 결과 (이 사이트 데이터 원본) */
  dataset: "https://www.data.go.kr/data/15104801/fileData.do",
} as const;
