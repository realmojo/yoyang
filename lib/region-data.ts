/**
 * 장기요양기관 평가 결과 조회.
 *
 * 원본은 공공데이터포털 15104801 「국민건강보험공단_장기요양기관 평가 결과」다.
 * 적재는 scripts/import-evaluations.mjs 가 하고, 사이트는 읽기만 한다.
 *
 * 구조가 두 층이다.
 *   - yoyang_facilities : 기관 한 건씩. 지역 상세에서 그대로 나열한다.
 *   - yoyang_regions    : 시군구 집계. 허브 목록과 "전국 평균 대비" 비교에 쓴다.
 *                         매번 27,947건을 집계할 수 없어 적재 시 미리 계산해 둔다.
 *
 * 지역 하나의 기관 수는 많아야 수백 건이라, 상세 화면은 집계 테이블 대신
 * 기관 목록을 한 번 읽어 화면에서 직접 계산한다. (급여종류·설립주체 분포 등)
 */

import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { REGIONS, type Region } from "@/lib/regions";

export const FACILITIES_TABLE = "yoyang_facilities";
export const REGIONS_TABLE = "yoyang_regions";
export const NATIONAL_TABLE = "yoyang_national";

/** 평가등급 5단계. 미평가·등급 없음은 null 로 들어온다. */
export type Grade = "A" | "B" | "C" | "D" | "E";

export const GRADES: Grade[] = ["A", "B", "C", "D", "E"];

export const GRADE_LABEL: Record<Grade, string> = {
  A: "최우수",
  B: "우수",
  C: "양호",
  D: "보통",
  E: "미흡",
};

/**
 * 영역 지표 체계.
 *
 * 공단이 2025년 정기평가부터 지표를 바꿨고, 원본 데이터도 컬럼을 따로 준다.
 * 두 체계는 배타적이라 **섞어서 평균 내면 안 된다.** 화면에서도 따로 그린다.
 */
export type EvalSystem = "2021" | "2025";

export interface ScoreSystem {
  system: EvalSystem;
  label: string;
  note: string;
  fields: ReadonlyArray<{
    label: string;
    /** yoyang_facilities 컬럼 */
    field: keyof Facility;
    /** yoyang_regions / yoyang_national 의 평균 컬럼 */
    avg: keyof RegionStats & keyof NationalStats;
  }>;
}

export const SCORE_SYSTEMS: ScoreSystem[] = [
  {
    system: "2025",
    label: "2025년 평가 기준",
    note: "2025년 정기평가부터 적용된 4개 영역입니다.",
    fields: [
      { label: "기관운영", field: "score_2025_operation", avg: "avg_2025_operation" },
      { label: "수급자존중", field: "score_2025_respect", avg: "avg_2025_respect" },
      { label: "서비스제공", field: "score_2025_service", avg: "avg_2025_service" },
      { label: "서비스결과", field: "score_2025_result", avg: "avg_2025_result" },
    ],
  },
  {
    system: "2021",
    label: "2021~2024년 평가 기준",
    note: "2024년 정기평가까지 적용된 5개 영역입니다.",
    fields: [
      { label: "기관운영", field: "score_operation", avg: "avg_operation" },
      { label: "환경및안전", field: "score_safety", avg: "avg_safety" },
      { label: "수급자권리보장", field: "score_rights", avg: "avg_rights" },
      { label: "급여제공과정", field: "score_process", avg: "avg_process" },
      { label: "급여제공결과", field: "score_result", avg: "avg_result" },
    ],
  },
];

export interface Facility {
  id: number;
  /** 장기요양기관기호 */
  code: string;
  name: string;
  /** 기관 상세 URL. `/{region_slug}/{slug}` (lib/facility.ts 참고) */
  slug: string | null;
  /** 급여종류. 예: 노인요양시설, 방문요양 */
  service_type: string | null;
  /** 설립주체. 예: 개인, 법인, 지자체 */
  founder: string | null;
  region_slug: string;
  sido: string;
  /** 시 단위. 일반구는 시로 합친다 (data/regions.json 참고) */
  sigungu: string;
  /** 합치기 전의 일반구 이름. 예: 분당구, 마산합포구 */
  sigungu_detail: string | null;
  /** 평가구분. 예: 2025년 정기평가 */
  eval_type: string | null;
  /** 평가일자. 3년 주기라 몇 년 전인 경우가 흔하다 — 화면에 반드시 노출한다. */
  eval_date: string | null;
  /** 평가 회차 연도. 평가일자(실제 방문일)와 다를 수 있다 */
  eval_round: number | null;
  eval_system: EvalSystem | null;
  grade: Grade | null;
  total_score: number | null;
  score_operation: number | null;
  score_safety: number | null;
  score_rights: number | null;
  score_process: number | null;
  score_result: number | null;
  score_2025_operation: number | null;
  score_2025_respect: number | null;
  score_2025_service: number | null;
  score_2025_result: number | null;
}

/** 시군구 집계 (적재 시 미리 계산) */
export interface RegionStats {
  region_slug: string;
  sido: string;
  sigungu: string;
  /** 기관 수 (code 기준 중복 제거) */
  facility_count: number;
  /** 평가 건수 (급여종류·회차별 행 수) */
  eval_count: number;
  grade_a: number;
  grade_b: number;
  grade_c: number;
  grade_d: number;
  grade_e: number;
  avg_total_score: number | null;
  avg_operation: number | null;
  avg_safety: number | null;
  avg_rights: number | null;
  avg_process: number | null;
  avg_result: number | null;
  /** 지표 체계별 평가 건수 */
  count_2021: number;
  count_2025: number;
  avg_2025_operation: number | null;
  avg_2025_respect: number | null;
  avg_2025_service: number | null;
  avg_2025_result: number | null;
  /** 관내에서 가장 최근 / 가장 오래된 평가일자 */
  latest_eval_date: string | null;
  oldest_eval_date: string | null;
  updated_at: string;
}

/** 전국 집계 한 줄 */
export interface NationalStats {
  region_count: number;
  /** 기관 수 (code 기준 중복 제거) */
  facility_count: number;
  /** 평가 건수 */
  eval_count: number;
  grade_a: number;
  grade_b: number;
  grade_c: number;
  grade_d: number;
  grade_e: number;
  avg_total_score: number | null;
  avg_operation: number | null;
  avg_safety: number | null;
  avg_rights: number | null;
  avg_process: number | null;
  avg_result: number | null;
  count_2021: number;
  count_2025: number;
  avg_2025_operation: number | null;
  avg_2025_respect: number | null;
  avg_2025_service: number | null;
  avg_2025_result: number | null;
  latest_eval_date: string | null;
  updated_at: string;
}

const FACILITY_COLUMNS = [
  "id, code, name, slug, service_type, founder",
  "region_slug, sido, sigungu, sigungu_detail",
  "eval_type, eval_date, eval_round, eval_system, grade, total_score",
  "score_operation, score_safety, score_rights, score_process, score_result",
  "score_2025_operation, score_2025_respect, score_2025_service, score_2025_result",
].join(", ");

/* ------------------------------- 조회 ------------------------------- */

/**
 * 평가 데이터는 연 1회만 바뀐다. 그런데 지역 페이지가 force-dynamic 이라
 * (광고를 매 요청 새로 받기 위한 선택) 그냥 두면 요청마다 Supabase 를 세 번
 * 친다. 지역 페이지가 229개라 크롤러 한 번에 수백 건이 나간다.
 *
 * 그래서 페이지는 매번 그리되 **DB 조회 결과만** 캐시한다.
 * 광고와 조회수는 그대로 매 요청 동작한다.
 *
 * 적재(npm run import:eval) 직후에는 이 시간만큼 예전 값이 보일 수 있다.
 */
const CACHE_SECONDS = 3600;

/**
 * 캐시 키에 함께 넣는 버전.
 *
 * 조회 결과의 모양(컬럼 구성)이 바뀌면 반드시 올린다. 올리지 않으면 예전 모양
 * 그대로 저장돼 있던 값이 계속 나오고, 새로 추가한 필드를 읽는 화면이
 * `undefined` 로 터진다. 실제로 eval_count 를 더했을 때 이 사고가 났다.
 */
const CACHE_VERSION = "v2";

/** 시군구 하나의 집계. 아직 적재 전이면 null. */
async function fetchRegionStats(
  regionSlug: string,
): Promise<RegionStats | null> {
  if (!supabaseAdmin) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from(REGIONS_TABLE)
      .select("*")
      .eq("region_slug", regionSlug)
      .maybeSingle();

    if (error) {
      console.error("getRegionStats error", error.message);
      return null;
    }
    return (data as RegionStats) ?? null;
  } catch (error) {
    console.error("getRegionStats exception", error);
    return null;
  }
}

/**
 * 전 지역 집계 (허브 화면).
 *
 * 캐시를 거치므로 Map 이 아니라 배열을 돌려준다. unstable_cache 는 결과를
 * 직렬화해서 저장하는데 Map 은 그 과정에서 빈 객체가 되어버린다.
 */
async function fetchAllRegionStats(): Promise<RegionStats[]> {
  if (!supabaseAdmin) return [];

  try {
    // 시군구는 250개 안팎이라 한 번에 받아도 Supabase 기본 상한(1000행) 안이다
    const { data, error } = await supabaseAdmin
      .from(REGIONS_TABLE)
      .select("*")
      .limit(1000);

    if (error) {
      console.error("getAllRegionStats error", error.message);
      return [];
    }
    return (data ?? []) as RegionStats[];
  } catch (error) {
    console.error("getAllRegionStats exception", error);
    return [];
  }
}

async function fetchNationalStats(): Promise<NationalStats | null> {
  if (!supabaseAdmin) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from(NATIONAL_TABLE)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("getNationalStats error", error.message);
      return null;
    }
    return (data as NationalStats) ?? null;
  } catch (error) {
    console.error("getNationalStats exception", error);
    return null;
  }
}

/**
 * 시군구의 기관 전체 목록.
 *
 * 등급 좋은 순 → 총점 높은 순 → 이름 순. 한 지역이 1,000건을 넘는 일은 없지만
 * Supabase 기본 상한에 맞춰 한도를 명시해 둔다.
 */
async function fetchFacilities(
  regionSlug: string,
  limit = 1000,
): Promise<Facility[]> {
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from(FACILITIES_TABLE)
      .select(FACILITY_COLUMNS)
      .eq("region_slug", regionSlug)
      .order("grade", { ascending: true, nullsFirst: false })
      .order("total_score", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("listFacilities error", error.message);
      return [];
    }
    return (data ?? []) as unknown as Facility[];
  } catch (error) {
    console.error("listFacilities exception", error);
    return [];
  }
}

/* --------------------------- 캐시를 씌운 조회 --------------------------- */

/* unstable_cache 는 인자를 캐시 키에 함께 넣는다. 지역별로 따로 저장된다. */

const cachedRegionStats = unstable_cache(fetchRegionStats, [CACHE_VERSION, "region-stats"], {
  revalidate: CACHE_SECONDS,
  tags: ["yoyang-eval"],
});

const cachedAllRegionStats = unstable_cache(
  fetchAllRegionStats,
  [CACHE_VERSION, "all-region-stats"],
  { revalidate: CACHE_SECONDS, tags: ["yoyang-eval"] },
);

const cachedNationalStats = unstable_cache(
  fetchNationalStats,
  [CACHE_VERSION, "national-stats"],
  { revalidate: CACHE_SECONDS, tags: ["yoyang-eval"] },
);

const cachedFacilities = unstable_cache(fetchFacilities, [CACHE_VERSION, "facilities"], {
  revalidate: CACHE_SECONDS,
  tags: ["yoyang-eval"],
});

/** 시군구 하나의 집계. 아직 적재 전이면 null. */
export function getRegionStats(
  regionSlug: string,
): Promise<RegionStats | null> {
  return cachedRegionStats(regionSlug);
}

/** 전 지역 집계를 슬러그로 찾을 수 있게 (허브 화면) */
export async function getAllRegionStats(): Promise<Map<string, RegionStats>> {
  const rows = await cachedAllRegionStats();
  return new Map(rows.map((row) => [row.region_slug, row]));
}

export function getNationalStats(): Promise<NationalStats | null> {
  return cachedNationalStats();
}

/** 시군구의 기관 전체 목록 (등급·총점 순) */
export function listFacilities(
  regionSlug: string,
  limit = 1000,
): Promise<Facility[]> {
  return cachedFacilities(regionSlug, limit);
}

/* ----------------------------- 화면용 계산 ----------------------------- */

export interface Breakdown {
  label: string;
  count: number;
  ratio: number;
}

/**
 * 급여종류는 원본이 "04.방문요양" 처럼 정렬용 번호를 달고 온다.
 * 번호는 정렬에 쓰고 화면에는 이름만 보여준다.
 */
export function serviceTypeLabel(value: string | null): string {
  return (value ?? "").replace(/^\d+\s*\.\s*/, "").trim() || "미상";
}

/** 항목별 건수를 많은 순으로 (급여종류·설립주체 분포) */
export function breakdownBy(
  facilities: Facility[],
  pick: (f: Facility) => string | null,
): Breakdown[] {
  const counts = new Map<string, number>();
  for (const f of facilities) {
    const key = (pick(f) ?? "").trim() || "미상";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = facilities.length || 1;
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count, ratio: count / total }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 기관 단위로 줄인다 — code 마다 가장 최근 평가 한 건만 남긴다.
 *
 * yoyang_facilities 한 행은 기관이 아니라 평가 한 건이다. 그대로 목록에 뿌리면
 * 같은 기관이 회차별로 두 번 나온다. 집계(yoyang_regions)도 같은 규칙으로
 * 계산하므로 화면의 "기관 수"와 목록 줄 수가 어긋나지 않는다.
 */
export function latestPerCode(rows: Facility[]): Facility[] {
  const best = new Map<string, Facility>();
  for (const row of rows) {
    const prev = best.get(row.code);
    if (!prev || isNewer(row, prev)) best.set(row.code, row);
  }
  return [...best.values()];
}

/**
 * 어느 행이 더 최근인가.
 *
 * 평가일자가 같을 때 id 가 큰 쪽을 고른다. 이 규칙은
 * refresh_yoyang_aggregates() 의 `order by code, eval_date desc nulls last,
 * id desc` 와 반드시 같아야 한다. 다르면 화면에서 센 등급 분포와 집계
 * 테이블의 값이 한두 개씩 어긋난다.
 */
function isNewer(a: Facility, b: Facility): boolean {
  const da = a.eval_date ?? "";
  const db = b.eval_date ?? "";
  if (da !== db) return da > db;
  return a.id > b.id;
}

/**
 * 급여종류별 분포용. 한 기관이 여러 급여종류를 운영하면 각각 세야 하므로
 * (기관, 급여종류) 쌍마다 최근 평가 한 건을 남긴다.
 */
export function latestPerCodeAndService(rows: Facility[]): Facility[] {
  const best = new Map<string, Facility>();
  for (const row of rows) {
    const key = `${row.code}|${row.service_type ?? ""}`;
    const prev = best.get(key);
    if (!prev || isNewer(row, prev)) best.set(key, row);
  }
  return [...best.values()];
}

/** 등급별 건수 (A~E + 등급없음) */
export function gradeCounts(facilities: Facility[]): Record<string, number> {
  const counts: Record<string, number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    E: 0,
    none: 0,
  };
  for (const f of facilities) {
    if (f.grade && f.grade in counts) counts[f.grade] += 1;
    else counts.none += 1;
  }
  return counts;
}

/** 소수 첫째 자리까지. 값이 없으면 null. */
export function round1(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

/** 2024-05-31 → 2024.05 */
export function formatEvalDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}`;
}

/**
 * 지역 페이지에서 쓸 한 문장짜리 해석.
 *
 * 숫자만 나열하면 자동 생성으로 읽힌다. 전국 평균과의 차이를 말로 옮긴다.
 * 비교할 값이 없으면 빈 문자열을 돌려주고, 화면에서는 문장을 아예 뺀다.
 */
export function comparisonSentence(
  region: Region,
  stats: RegionStats | null,
  national: NationalStats | null,
): string {
  if (!stats || !national) return "";
  const mine = round1(stats.avg_total_score);
  const all = round1(national.avg_total_score);
  if (mine === null || all === null) return "";

  const diff = round1(mine - all)!;
  if (Math.abs(diff) < 0.5) {
    return `${region.name}의 평균 평가총점은 ${mine}점으로 전국 평균(${all}점)과 거의 같습니다.`;
  }
  const direction = diff > 0 ? "높습니다" : "낮습니다";
  return `${region.name}의 평균 평가총점은 ${mine}점으로 전국 평균(${all}점)보다 ${Math.abs(diff)}점 ${direction}.`;
}

/** 데이터가 있는 지역만 (사이트맵·허브에서 빈 페이지를 걸러낼 때) */
export function regionsWithData(stats: Map<string, RegionStats>): Region[] {
  return REGIONS.filter((r) => (stats.get(r.slug)?.facility_count ?? 0) > 0);
}
