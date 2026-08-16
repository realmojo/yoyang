/**
 * 행정구역(시도 · 시군구) 정의와 URL 슬러그 규칙.
 *
 * 이 파일은 "라우팅의 단일 출처"다. /지역 허브, /[slug] 지역 상세, 사이트맵이
 * 모두 여기 목록을 기준으로 만들어진다.
 *
 * 목록 자체는 data/regions.json 에 두고 적재 스크립트
 * (scripts/import-evaluations.mjs)와 함께 읽는다. 평가 데이터의 관할시군구명이
 * 목록에 없는 이름으로 오면 스크립트가 경고를 찍고 그 행을 건너뛴다.
 * 값이 조용히 사라지지 않게 하려는 것이므로, 경고가 나오면 JSON 을 고친 뒤
 * 다시 적재할 것.
 */

import regionData from "@/data/regions.json";

export interface Sido {
  /** 슬러그·표시에 쓰는 짧은 이름. 예: "서울" */
  short: string;
  /** 공식 명칭. 예: "서울특별시" */
  name: string;
  /** 목록 화면 아이콘 */
  emoji: string;
}

export interface Region {
  /** URL 경로. `/{slug}` 로 열린다. 예: "서울-강남구" */
  slug: string;
  /** 시도 짧은 이름. 예: "서울" */
  sido: string;
  /** 시도 공식 명칭. 예: "서울특별시" */
  sidoName: string;
  /** 시군구 이름. 예: "강남구", "성남시분당구" */
  sigungu: string;
  /** 화면 표기용 전체 이름. 예: "서울 강남구" */
  name: string;
}

/** 17개 시도 */
export const SIDOS: Sido[] = regionData.sidos;

/**
 * 시도별 시군구 목록.
 *
 * 인구 50만 이상 시의 일반구(예: 성남시 분당구)는 공단 평가 데이터가 일반구
 * 단위로 내려오므로 붙여 쓴 형태("성남시분당구")로 둔다.
 * 세종특별자치시는 하위 시군구가 없어 빈 배열이고, 시도 자체가 한 페이지가 된다.
 */
export const SIGUNGU: Record<string, string[]> = regionData.sigungu;

/** 개편 전 표기가 섞여 들어올 때 흡수한다 (예: "강원도" → "강원") */
const SIDO_ALIASES: Record<string, string> = regionData.sidoAliases;

/** 지역 허브 경로. `/[slug]` 안에서 이 값이면 허브 화면을 그린다. */
export const REGION_HUB_SLUG = "지역";

/** 시도·시군구 이름으로 슬러그를 만든다. 적재 스크립트도 같은 규칙을 쓴다. */
export function regionSlug(sidoShort: string, sigungu: string): string {
  const g = sigungu.replace(/\s+/g, "");
  return g ? `${sidoShort}-${g}` : sidoShort;
}

function buildRegions(): Region[] {
  const list: Region[] = [];

  for (const sido of SIDOS) {
    const children = SIGUNGU[sido.short] ?? [];

    // 세종처럼 하위 시군구가 없는 곳은 시도 자체가 한 페이지가 된다
    if (children.length === 0) {
      list.push({
        slug: regionSlug(sido.short, ""),
        sido: sido.short,
        sidoName: sido.name,
        sigungu: "",
        name: sido.name,
      });
      continue;
    }

    for (const sigungu of children) {
      list.push({
        slug: regionSlug(sido.short, sigungu),
        sido: sido.short,
        sidoName: sido.name,
        sigungu,
        name: `${sido.short} ${sigungu}`,
      });
    }
  }

  return list;
}

export const REGIONS: Region[] = buildRegions();

const REGION_INDEX = new Map<string, Region>(REGIONS.map((r) => [r.slug, r]));
const SIDO_INDEX = new Map<string, Sido>(SIDOS.map((s) => [s.short, s]));

export function findRegion(slug: string): Region | null {
  return REGION_INDEX.get(slug) ?? null;
}

export function findSido(short: string): Sido | null {
  return SIDO_INDEX.get(short) ?? null;
}

/** 시도 순서를 지킨 채 시도별로 묶은 목록 (허브 화면용) */
export function regionsBySido(): Array<{ sido: Sido; regions: Region[] }> {
  return SIDOS.map((sido) => ({
    sido,
    regions: REGIONS.filter((r) => r.sido === sido.short),
  }));
}

/**
 * 같은 시도의 다른 시군구.
 *
 * 실제 지리적 인접성 데이터가 없으므로 "인접"이라고 쓰지 않는다.
 * 화면에서도 "같은 시도의 다른 지역"으로 표기한다.
 */
export function siblingRegions(region: Region, limit = 12): Region[] {
  return REGIONS.filter(
    (r) => r.sido === region.sido && r.slug !== region.slug,
  ).slice(0, limit);
}

/** 평가 데이터의 관할시도명(예: "서울특별시")을 짧은 이름으로 바꾼다 */
export function toSidoShort(raw: string): string | null {
  const value = raw.trim();
  const exact = SIDOS.find((s) => s.name === value || s.short === value);
  if (exact) return exact.short;
  return SIDO_ALIASES[value] ?? null;
}
