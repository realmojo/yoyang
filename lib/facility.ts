/**
 * 기관 상세 화면에 필요한 조회와 계산.
 *
 * 기관 한 곳이 여러 행일 수 있다. 급여종류를 여러 개 운영하거나(2,930곳)
 * 평가 회차가 여러 번 돌아온 경우(3,588곳)다. 상세 페이지는 이 행들을
 * 장기요양기관기호(code) 기준으로 하나로 묶어서 보여준다.
 *
 * 조회는 지역 목록(listFacilities)을 그대로 재사용한다. 이미 캐시되어 있고
 * 한 지역이 많아야 수백 건이라, 상세 페이지 때문에 질의를 더 만들 이유가 없다.
 * 지역 안에서의 순위도 이 목록으로 바로 계산된다.
 */

import {
  listFacilities,
  round1,
  serviceTypeLabel,
  SCORE_SYSTEMS,
  type EvalSystem,
  type Facility,
  type Grade,
  type NationalStats,
  type RegionStats,
  type ScoreSystem,
} from "@/lib/region-data";

/**
 * 슬러그 끝에 붙은 기관기호 숫자를 뽑아낸다.
 *
 * 이름 부분이 아니라 이 숫자로 기관을 찾는다. 그래서 다음 갱신에서 기관명이
 * 바뀌어 슬러그가 달라져도 예전 URL 이 그대로 열린다. (canonical 만 새 주소를
 * 가리키게 두면 검색엔진도 자연스럽게 따라온다)
 */
export function codeDigitsFromSlug(slug: string): string | null {
  const m = slug.match(/(\d{8,})$/);
  return m ? m[1] : null;
}

/** scripts/eval-common.mjs 의 facilitySlug 와 같은 규칙 */
export function facilitySlug(name: string, code: string): string {
  const digits = code.replace(/[^0-9]/g, "");
  const base = name
    .toLowerCase()
    .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base ? `${base}-${digits}` : digits;
}

/** 기관 한 곳의 평가 이력 한 건 */
export interface EvalRecord {
  serviceType: string;
  serviceLabel: string;
  round: number | null;
  date: string | null;
  grade: Grade | null;
  totalScore: number | null;
  system: EvalSystem | null;
  /** 영역별 점수. 체계에 따라 4개 또는 5개 */
  areas: Array<{ label: string; score: number | null }>;
}

export interface FacilityDetail {
  code: string;
  name: string;
  slug: string;
  regionSlug: string;
  sido: string;
  sigungu: string;
  /** 일반구를 시로 합치기 전의 구 이름 */
  sigunguDetail: string | null;
  founder: string | null;
  /** 운영 중인 급여종류 (표시용 이름) */
  serviceLabels: string[];
  /** 최신 평가 (평가일자 기준) */
  latest: EvalRecord;
  /** 평가 이력 전체. 최신순 */
  records: EvalRecord[];
  /** 지역 안에서의 총점 순위 */
  rank: number | null;
  rankTotal: number;
  /** 같은 급여종류 안에서의 지역 순위 */
  serviceRank: number | null;
  serviceRankTotal: number;
}

/** 기관의 대표 총점 — 가장 최근 평가의 총점 */
function bestScore(rows: Facility[]): number | null {
  const sorted = [...rows].sort(
    (a, b) => (b.eval_date ?? "").localeCompare(a.eval_date ?? ""),
  );
  return sorted.find((r) => r.total_score !== null)?.total_score ?? null;
}

function toEvalRecord(row: Facility): EvalRecord {
  const system = SCORE_SYSTEMS.find((s) => s.system === row.eval_system);
  const areas = (system?.fields ?? []).map((f) => ({
    label: f.label,
    score: round1(row[f.field] as number | null),
  }));

  return {
    serviceType: row.service_type ?? "",
    serviceLabel: serviceTypeLabel(row.service_type),
    round: row.eval_round,
    date: row.eval_date,
    grade: row.grade,
    totalScore: round1(row.total_score),
    system: row.eval_system,
    areas,
  };
}

/**
 * 지역 안에서 기관 하나를 찾아 상세 정보로 만든다.
 * 없으면 null.
 */
export async function getFacilityDetail(
  regionSlug: string,
  slug: string,
): Promise<FacilityDetail | null> {
  const digits = codeDigitsFromSlug(slug);
  if (!digits) return null;

  const all = await listFacilities(regionSlug);
  if (all.length === 0) return null;

  const rows = all.filter((r) => r.code.replace(/[^0-9]/g, "") === digits);
  if (rows.length === 0) return null;

  // 최신 평가가 먼저 오도록
  const sorted = [...rows].sort((a, b) =>
    (b.eval_date ?? "").localeCompare(a.eval_date ?? ""),
  );
  const head = sorted[0];
  const records = sorted.map(toEvalRecord);

  return {
    code: head.code,
    name: head.name,
    slug: facilitySlug(head.name, head.code),
    regionSlug,
    sido: head.sido,
    sigungu: head.sigungu,
    sigunguDetail: head.sigungu_detail,
    founder: head.founder,
    serviceLabels: Array.from(
      new Set(sorted.map((r) => serviceTypeLabel(r.service_type))),
    ),
    latest: records[0],
    records,
    ...computeRanks(all, head),
  };
}

/**
 * 지역 안에서의 순위.
 *
 * 기관 단위로 세야 하므로 code 로 먼저 묶는다. 행 단위로 세면 급여종류를
 * 여러 개 운영하는 기관이 여러 번 계산된다.
 */
function computeRanks(all: Facility[], target: Facility) {
  const byCode = new Map<string, Facility[]>();
  for (const row of all) {
    const list = byCode.get(row.code) ?? [];
    list.push(row);
    byCode.set(row.code, list);
  }

  const scored = [...byCode.entries()]
    .map(([code, rows]) => ({ code, score: bestScore(rows) }))
    .filter((x) => x.score !== null)
    .sort((a, b) => b.score! - a.score!);

  const rankIndex = scored.findIndex((x) => x.code === target.code);

  // 같은 급여종류 안에서의 순위
  const sameService = all.filter((r) => r.service_type === target.service_type);
  const serviceScored = sameService
    .filter((r) => r.total_score !== null)
    .sort((a, b) => b.total_score! - a.total_score!);
  const serviceIndex = serviceScored.findIndex((r) => r.code === target.code);

  return {
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    rankTotal: scored.length,
    serviceRank: serviceIndex >= 0 ? serviceIndex + 1 : null,
    serviceRankTotal: serviceScored.length,
  };
}

/** 같은 지역에서 급여종류가 겹치는 다른 기관 (하단 추천) */
export async function listSimilarFacilities(
  detail: FacilityDetail,
  limit = 6,
): Promise<Array<{ name: string; slug: string; grade: Grade | null; score: number | null; service: string }>> {
  const all = await listFacilities(detail.regionSlug);
  const targetServices = new Set(detail.records.map((r) => r.serviceType));

  const seen = new Set<string>([detail.code]);
  const out: Array<{
    name: string;
    slug: string;
    grade: Grade | null;
    score: number | null;
    service: string;
  }> = [];

  for (const row of all) {
    if (seen.has(row.code)) continue;
    if (!targetServices.has(row.service_type ?? "")) continue;
    seen.add(row.code);
    out.push({
      name: row.name,
      slug: facilitySlug(row.name, row.code),
      grade: row.grade,
      score: round1(row.total_score),
      service: serviceTypeLabel(row.service_type),
    });
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * 영역별로 지역 평균과 비교해 강한 곳·약한 곳을 뽑는다.
 *
 * 지역 페이지가 "지역 vs 전국"을 보여준다면 여기서는 "이 기관 vs 지역"을
 * 본다. 숫자만 늘어놓으면 자동 생성처럼 읽히므로 문장으로도 정리한다.
 */
export interface AreaComparison {
  system: ScoreSystem;
  rows: Array<{ label: string; mine: number; region: number | null; diff: number | null }>;
  sentence: string;
}

export function compareAreas(
  detail: FacilityDetail,
  stats: RegionStats | null,
  regionName: string,
): AreaComparison | null {
  const record = detail.latest;
  const system = SCORE_SYSTEMS.find((s) => s.system === record.system);
  if (!system) return null;

  const rows = system.fields
    .map((field) => {
      const mine = round1(
        record.areas.find((a) => a.label === field.label)?.score ?? null,
      );
      if (mine === null) return null;
      const region = round1((stats?.[field.avg] as number | null) ?? null);
      return {
        label: field.label,
        mine,
        region,
        diff: region === null ? null : round1(mine - region),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return null;

  const withDiff = rows.filter((r) => r.diff !== null);
  let sentence = "";

  if (withDiff.length > 0) {
    const strongest = [...withDiff].sort((a, b) => b.diff! - a.diff!)[0];
    const weakest = [...withDiff].sort((a, b) => a.diff! - b.diff!)[0];

    if (strongest.diff! > 0 && weakest.diff! < 0) {
      sentence = `${regionName} 평균과 견주면 ${strongest.label} 영역이 ${Math.abs(strongest.diff!)}점 높고, ${weakest.label} 영역이 ${Math.abs(weakest.diff!)}점 낮습니다.`;
    } else if (strongest.diff! > 0) {
      sentence = `영역별 점수가 모두 ${regionName} 평균 이상이며, 특히 ${strongest.label} 영역이 ${Math.abs(strongest.diff!)}점 높습니다.`;
    } else if (weakest.diff! < 0) {
      sentence = `영역별 점수가 ${regionName} 평균을 밑돌며, ${weakest.label} 영역의 차이가 ${Math.abs(weakest.diff!)}점으로 가장 큽니다.`;
    } else {
      sentence = `영역별 점수가 ${regionName} 평균과 거의 같습니다.`;
    }
  }

  return { system, rows, sentence };
}

/**
 * 앞말의 받침에 맞는 조사를 골라 붙인다. ("해피맘요양원은", "아가페실버센터는")
 *
 * 기관명이 그대로 문장에 들어가므로 "은(는)" 같은 표기를 쓰면 읽기 나쁘다.
 * 한글이 아닌 글자로 끝나면(영문·숫자·괄호) 판단할 수 없으므로 둘 다 적는다.
 */
export function withParticle(word: string, pair: "은는" | "이가"): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;

  if (!isHangulSyllable) {
    return pair === "은는" ? `${word}은(는)` : `${word}이(가)`;
  }

  const hasJongseong = (code - 0xac00) % 28 !== 0;
  if (pair === "은는") return `${word}${hasJongseong ? "은" : "는"}`;
  return `${word}${hasJongseong ? "이" : "가"}`;
}

/** 상단 요약 한 문장 */
export function summarySentence(
  detail: FacilityDetail,
  regionName: string,
  national: NationalStats | null,
): string {
  const { latest, rank, rankTotal } = detail;
  const parts: string[] = [];

  if (latest.grade) {
    parts.push(
      `${withParticle(detail.name, "은는")} ${formatEvalMonth(latest.date)} 평가에서 ${latest.grade}등급을 받았습니다.`,
    );
  } else {
    parts.push(`${detail.name}의 공개된 평가 등급이 없습니다.`);
  }

  if (latest.totalScore !== null && rank !== null && rankTotal > 1) {
    parts.push(
      `평가총점 ${latest.totalScore}점으로 ${regionName} 내 ${rankTotal}곳 가운데 ${rank}번째입니다.`,
    );
  }

  const natAvg = round1(national?.avg_total_score ?? null);
  if (latest.totalScore !== null && natAvg !== null) {
    const diff = round1(latest.totalScore - natAvg)!;
    if (Math.abs(diff) >= 0.5) {
      parts.push(
        `전국 평균(${natAvg}점)보다 ${Math.abs(diff)}점 ${diff > 0 ? "높습니다" : "낮습니다"}.`,
      );
    }
  }

  return parts.join(" ");
}

/** 2025-09-04 → 2025년 9월 */
export function formatEvalMonth(value: string | null): string {
  if (!value) return "평가일 미상";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}
