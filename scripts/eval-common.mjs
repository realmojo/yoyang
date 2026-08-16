/**
 * 평가 결과 적재 공통 모듈.
 *
 * 데이터를 어디서 가져오든(오픈API / CSV) 여기를 거쳐 같은 형태로 정리된 뒤
 * yoyang_facilities 에 들어간다. 원본 형식이 달라져도 매핑 규칙은 한 곳이다.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

/* --------------------------- 지역 슬러그 규칙 --------------------------- */
/* lib/regions.ts 와 같은 규칙이다. 한쪽만 고치면 슬러그가 어긋난다. */

const regionData = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/regions.json"), "utf8"),
);

const SIDOS = regionData.sidos;
const SIGUNGU = regionData.sigungu;
const SIDO_ALIASES = regionData.sidoAliases;

export function regionSlug(sidoShort, sigungu) {
  const g = (sigungu ?? "").replace(/\s+/g, "");
  return g ? `${sidoShort}-${g}` : sidoShort;
}

export function toSidoShort(raw) {
  const value = (raw ?? "").trim();
  const exact = SIDOS.find((s) => s.name === value || s.short === value);
  if (exact) return exact.short;
  return SIDO_ALIASES[value] ?? null;
}

/**
 * 일반구를 시로 합친다. "성남시 분당구" → "성남시"
 *
 * 원본이 시 단위와 일반구 단위를 섞어 쓴다(화성시 64건 vs 일반구 231건,
 * 천안시 7건 vs 구 280건). 구 단위로 쪼개면 시 단위 행이 갈 곳을 잃으므로
 * 시로 접고, 원래 구 이름은 sigungu_detail 로 남긴다.
 *
 * 규칙 하나로 처리해서 나중에 일반구가 늘어나도(화성시가 2025년에 그랬다)
 * 목록을 고치지 않아도 되게 한다.
 */
export function rollupSigungu(raw) {
  const value = String(raw ?? "").trim();
  const m = value.match(/^(.*?시)\s*(\S+구)$/);
  if (!m) return { sigungu: value.replace(/\s+/g, ""), detail: null };
  return { sigungu: m[1].replace(/\s+/g, ""), detail: m[2] };
}

/**
 * 기관 상세 URL 슬러그. lib/facility.ts 의 facilitySlug 와 같은 규칙이다.
 *
 * "{정리한 이름}-{기관기호 숫자}" 형태다. 기관기호를 항상 붙여서 같은 이름이
 * 겹쳐도(같은 시군구 안에 266쌍 있다) 부딪히지 않게 한다.
 *
 * 기관명에는 (주), A+, 따옴표, 괄호 안 부설 안내 같은 것이 섞여 있어서
 * 한글·영숫자만 남기고 나머지는 하이픈으로 바꾼다.
 */
export function facilitySlug(name, code) {
  const digits = String(code ?? "").replace(/[^0-9]/g, "");
  const base = String(name ?? "")
    .toLowerCase()
    .replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

  return base ? `${base}-${digits}` : digits;
}

/** 알고 있는 슬러그 전체 (검증용) */
export const KNOWN_SLUGS = new Set();
for (const sido of SIDOS) {
  const children = SIGUNGU[sido.short] ?? [];
  if (children.length === 0) {
    KNOWN_SLUGS.add(regionSlug(sido.short, ""));
    continue;
  }
  for (const g of children) KNOWN_SLUGS.add(regionSlug(sido.short, g));
}

/* ------------------------------ 필드 매핑 ------------------------------ */

/**
 * 원본 필드 이름 후보. 앞에 있는 것부터 찾는다.
 *
 * 공공데이터포털의 파일데이터 오픈API 는 보통 CSV 헤더(한글)를 그대로 JSON 키로
 * 쓴다. 다만 그건 데이터셋마다 다르므로 로마자 표기 후보도 함께 둔다.
 * 여기에 없는 이름으로 내려오면 --probe 로 실제 키를 확인한 뒤 추가할 것.
 */
export const FIELD_MAP = {
  code: ["장기요양기관기호", "장기요양기관코드", "기관기호", "ltcAdminSym"],
  name: ["장기요양기관명", "기관명", "adminNm"],
  service_type: ["급여종류", "급여종류명", "salaryKindNm"],
  founder: ["설립주체", "설립구분", "fondNm"],
  sido: ["관할시도명", "시도명", "시도", "siDoNm"],
  sigungu: ["관할시군구명", "시군구명", "시군구", "siGunGuNm"],
  eval_type: ["평가구분", "평가구분명", "evlDivNm"],
  eval_date: ["평가일자", "평가일", "evlDe"],
  grade: ["평가등급", "등급", "evlGrd"],
  total_score: ["평가총점", "총점", "evlTotScr"],
  // 2021·2023·2024년 정기평가의 5개 영역
  score_operation: ["기관운영"],
  score_safety: ["환경및안전", "환경 및 안전"],
  score_rights: ["수급자권리보장"],
  score_process: ["급여제공과정"],
  score_result: ["급여제공결과"],
  // 2025년 정기평가의 4개 영역. 지표 체계가 바뀌어 별도 컬럼으로 내려온다
  score_2025_operation: ["기관운영(2025)"],
  score_2025_respect: ["수급자존중(2025)"],
  score_2025_service: ["서비스제공(2025)"],
  score_2025_result: ["서비스결과(2025)"],
};

/** 영역 점수 컬럼을 체계별로 묶어 둔다 (eval_system 판정에 쓴다) */
const SCORE_FIELDS_2021 = [
  "score_operation",
  "score_safety",
  "score_rights",
  "score_process",
  "score_result",
];
const SCORE_FIELDS_2025 = [
  "score_2025_operation",
  "score_2025_respect",
  "score_2025_service",
  "score_2025_result",
];

/** 지역·기관을 식별할 수 없으면 진행할 이유가 없다 */
export const REQUIRED_FIELDS = ["code", "name", "sido", "sigungu"];

const squash = (s) => String(s ?? "").replace(/\s+/g, "");

/**
 * 원본의 실제 키 이름을 우리 필드 이름에 짝지어 둔다.
 * 반환값의 found 는 { 우리이름: 원본키 } 형태다.
 */
export function resolveFields(keys) {
  const found = {};
  const missing = [];

  for (const [field, candidates] of Object.entries(FIELD_MAP)) {
    const hit = keys.find((k) =>
      candidates.some((c) => squash(k) === squash(c)),
    );
    if (hit) found[field] = hit;
    else missing.push(field);
  }

  return { found, missing };
}

/* ------------------------------ 값 정리 ------------------------------ */

export function toNumber(value) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "20240531", "2024-05-31", "2024.05.31" 을 모두 받아 YYYY-MM-DD 로 */
export function toDate(value) {
  if (!value) return null;
  const digits = String(value).replace(/[^0-9]/g, "");
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function toGrade(value) {
  if (!value) return null;
  const g = String(value).trim().toUpperCase().charAt(0);
  return ["A", "B", "C", "D", "E"].includes(g) ? g : null;
}

function nullable(value) {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : null;
}

/**
 * 원본 행 배열 → 테이블에 넣을 행 배열.
 *
 * 지역 목록(data/regions.json)에 없는 시군구는 넣지 않고 따로 모은다.
 * 조용히 삼키면 특정 지역 페이지가 통째로 비어버리기 때문이다.
 */
export function normalizeRows(rows, found) {
  const records = [];
  const unknownRegions = new Map();

  for (const row of rows) {
    const get = (field) => (found[field] ? row[found[field]] : null);

    const sidoRaw = String(get("sido") ?? "").trim();
    const sidoShort = toSidoShort(sidoRaw);
    const { sigungu, detail } = rollupSigungu(get("sigungu"));
    const slug = sidoShort ? regionSlug(sidoShort, sigungu) : null;

    if (!slug || !KNOWN_SLUGS.has(slug)) {
      const key =
        `${sidoRaw} ${String(get("sigungu") ?? "").trim()}`.trim() ||
        "(시도·시군구 비어 있음)";
      unknownRegions.set(key, (unknownRegions.get(key) ?? 0) + 1);
      continue;
    }

    const code = String(get("code") ?? "").trim();
    const name = String(get("name") ?? "").trim();
    if (!code || !name) continue;

    const evalDate = toDate(get("eval_date"));
    const scores = {};
    for (const field of [...SCORE_FIELDS_2021, ...SCORE_FIELDS_2025]) {
      scores[field] = toNumber(get(field));
    }

    // 두 지표 체계는 배타적이다. 채워진 쪽으로 판정한다.
    const has2025 = SCORE_FIELDS_2025.some((f) => scores[f] !== null);
    const has2021 = SCORE_FIELDS_2021.some((f) => scores[f] !== null);
    const evalSystem = has2025 ? "2025" : has2021 ? "2021" : null;

    // 평가구분("2025년 정기평가")에서 회차 연도를 뽑는다.
    // 평가일자는 실제 방문일이라 회차와 다를 수 있다(2021년 회차인데 2022년 방문).
    const evalType = nullable(get("eval_type"));
    const roundMatch = evalType?.match(/(19|20)\d{2}/);

    records.push({
      code,
      name,
      slug: facilitySlug(name, code),
      service_type: nullable(get("service_type")),
      founder: nullable(get("founder")),
      sido: sidoShort,
      sigungu,
      sigungu_detail: detail,
      region_slug: slug,
      eval_type: evalType,
      eval_date: evalDate,
      eval_year: evalDate ? Number(evalDate.slice(0, 4)) : null,
      eval_round: roundMatch ? Number(roundMatch[0]) : null,
      eval_system: evalSystem,
      grade: toGrade(get("grade")),
      total_score: toNumber(get("total_score")),
      ...scores,
    });
  }

  return { records, unknownRegions };
}

/**
 * upsert 키가 (code, service_type, eval_date) 라서, 한 번의 요청 안에 같은
 * 키가 두 번 들어 있으면 Postgres 가 "ON CONFLICT DO UPDATE command cannot
 * affect row a second time" 로 거절한다. 배치로 보내기 전에 걸러낸다.
 */
export function dedupeByKey(records) {
  const seen = new Map();
  for (const r of records) {
    seen.set(`${r.code}|${r.service_type ?? ""}|${r.eval_date ?? ""}`, r);
  }
  return [...seen.values()];
}

/* ------------------------------ 적재 ------------------------------ */

export async function loadIntoSupabase(supabase, records, { batch = 500 } = {}) {
  for (let i = 0; i < records.length; i += batch) {
    const chunk = records.slice(i, i + batch);
    const { error } = await supabase
      .from("yoyang_facilities")
      .upsert(chunk, { onConflict: "code,service_type,eval_date" });

    if (error) {
      throw new Error(
        `적재 실패 (${i}~${i + chunk.length}): ${error.message}`,
      );
    }
    console.log(
      `  적재 ${Math.min(i + batch, records.length)}/${records.length}`,
    );
  }
}

export async function refreshAggregates(supabase) {
  console.log("집계 갱신 중...");
  const { error } = await supabase.rpc("refresh_yoyang_aggregates");
  if (error) throw new Error(`집계 갱신 실패: ${error.message}`);
}

/** 건너뛴 지역명 보고 */
export function reportUnknownRegions(unknownRegions) {
  if (unknownRegions.size === 0) return;

  console.warn("\n⚠ 목록에 없는 지역명 — 이 행들은 적재되지 않았습니다.");
  console.warn("  data/regions.json 을 고친 뒤 다시 실행하세요.\n");
  for (const [name, count] of [...unknownRegions.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.warn(`   ${name} — ${count}건`);
  }
  console.warn("");
}
