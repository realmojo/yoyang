#!/usr/bin/env node
/**
 * 장기요양기관 평가 결과 → Supabase 적재.
 *
 * 원본: 공공데이터포털 15104801 「국민건강보험공단_장기요양기관 평가 결과」
 *       https://www.data.go.kr/data/15104801/fileData.do
 *       갱신 연 1회 · 무료 · 이용허락범위 제한 없음(상업적 이용 가능)
 *
 * 기본 경로는 **오픈API** 다. 파일을 손으로 내려받아 두면 갱신 때마다 사람이
 * 개입해야 하고, 로그인 없이 받은 파일이 0바이트로 떨어지는 함정도 있다.
 *
 * ────────────────────────────────────────────────────────────────────────
 *  준비 (한 번만)
 * ────────────────────────────────────────────────────────────────────────
 *   1. data.go.kr 에서 15104801 활용신청 (파일데이터 오픈API, 자동승인)
 *   2. 마이페이지 > 인증키에서 **일반 인증키(Decoding)** 복사
 *   3. 데이터셋 상세의 "오픈 API" 탭에서 요청 URL 을 복사
 *      (serviceKey·page·perPage 는 빼고 엔드포인트까지만)
 *   4. .env.local 에 넣는다
 *        DATA_GO_KR_SERVICE_KEY=...
 *        YOYANG_EVAL_API_URL=https://api.odcloud.kr/api/15104801/v1/uddi:...
 *
 * ────────────────────────────────────────────────────────────────────────
 *  사용
 * ────────────────────────────────────────────────────────────────────────
 *   npm run probe:eval              1페이지만 받아 응답 구조를 눈으로 확인
 *   npm run import:eval             API 로 전체 적재 + 집계 갱신
 *   npm run import:eval -- --dry-run        적재하지 않고 결과만 본다
 *   npm run import:eval -- --pages 3        앞 3페이지만 (시험용)
 *   npm run import:eval:csv -- data/raw/x.csv   내려받은 CSV 로 적재
 *
 * **처음 돌릴 때는 반드시 --probe 부터.** 응답의 실제 키 이름이 FIELD_MAP 의
 * 후보와 다르면 그 자리에서 멈추고 본 키를 전부 찍어준다. 추측으로 채우지 말 것.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  ROOT,
  REQUIRED_FIELDS,
  resolveFields,
  normalizeRows,
  dedupeByKey,
  loadIntoSupabase,
  refreshAggregates,
  reportUnknownRegions,
} from "./eval-common.mjs";

dotenv.config({ path: path.join(ROOT, ".env.local") });

/* ------------------------------ 인자 파싱 ------------------------------ */

function parseArgs(argv) {
  const opts = {
    probe: false,
    dryRun: false,
    csv: null,
    pages: null,
    perPage: Number(process.env.YOYANG_EVAL_PER_PAGE ?? 1000),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--probe") opts.probe = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--csv") opts.csv = argv[++i];
    else if (arg === "--pages") opts.pages = Number(argv[++i]);
    else if (arg === "--per-page") opts.perPage = Number(argv[++i]);
    else if (!arg.startsWith("--") && !opts.csv && arg.endsWith(".csv")) {
      // `npm run import:eval:csv -- data/raw/x.csv` 형태를 그대로 받는다
      opts.csv = arg;
    }
  }

  return opts;
}

/* ------------------------------ 오픈API ------------------------------ */

/**
 * 요청 URL 을 만든다.
 *
 * 인증키에는 함정이 하나 있다. 포털은 Encoding 키와 Decoding 키를 둘 다 주는데,
 * 이미 인코딩된 키를 다시 인코딩하면 `%2B` 가 `%252B` 가 되어
 * SERVICE_KEY_IS_NOT_REGISTERED_ERROR 가 난다.
 * 키에 `%` 가 들어 있으면 인코딩된 키로 보고 그대로 붙인다.
 */
function buildUrl(baseUrl, serviceKey, params) {
  const url = new URL(baseUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const alreadyEncoded = serviceKey.includes("%");
  if (alreadyEncoded) {
    const sep = url.search ? "&" : "?";
    return `${url.toString()}${sep}serviceKey=${serviceKey}`;
  }

  url.searchParams.set("serviceKey", serviceKey);
  return url.toString();
}

async function fetchPage(baseUrl, serviceKey, page, perPage) {
  const url = buildUrl(baseUrl, serviceKey, {
    page,
    perPage,
    returnType: "JSON",
    type: "JSON",
  });

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  const text = await res.text();

  // 공공데이터포털은 오류도 HTTP 200 + XML 로 돌려주는 경우가 많다
  if (!res.ok || text.trim().startsWith("<")) {
    throw new Error(
      [
        `API 요청 실패 (HTTP ${res.status}). 응답 원문:`,
        "",
        text.slice(0, 600),
        "",
        "자주 나오는 원인:",
        "  · SERVICE_KEY_IS_NOT_REGISTERED_ERROR → 활용신청 승인 전이거나 키가 틀림",
        "  · 인코딩 키를 넣고 다시 인코딩됨 → Decoding 키를 쓰세요",
        "  · 엔드포인트 URL 이 틀림 → 포털 '오픈 API' 탭에서 다시 복사",
      ].join("\n"),
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON 파싱 실패:\n${text.slice(0, 600)}`);
  }
}

/**
 * 응답에서 행 배열과 전체 건수를 꺼낸다.
 *
 * 포털 API 는 크게 두 가지 모양이다. 어느 쪽인지 단정하지 않고 둘 다 받는다.
 *   1) odcloud(파일데이터) : { page, perPage, totalCount, data: [...] }
 *   2) 표준 오픈API        : { response: { header, body: { items, totalCount } } }
 */
function extractRows(json) {
  if (Array.isArray(json?.data)) {
    return { rows: json.data, totalCount: Number(json.totalCount ?? 0) };
  }

  const body = json?.response?.body;
  if (body) {
    const header = json.response.header;
    if (header?.resultCode && String(header.resultCode) !== "00") {
      throw new Error(
        `API 오류 ${header.resultCode}: ${header.resultMsg ?? ""}`,
      );
    }
    const items = body.items?.item ?? body.items ?? [];
    return {
      rows: Array.isArray(items) ? items : [items].filter(Boolean),
      totalCount: Number(body.totalCount ?? 0),
    };
  }

  throw new Error(
    `응답에서 행 목록을 찾지 못했습니다. 최상위 키: ${Object.keys(json ?? {}).join(", ")}`,
  );
}

function requireApiConfig() {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  const baseUrl = process.env.YOYANG_EVAL_API_URL;

  if (!serviceKey || !baseUrl) {
    console.error(
      [
        ".env.local 에 아래 두 값이 필요합니다.",
        "",
        "  DATA_GO_KR_SERVICE_KEY=<마이페이지 > 인증키 > 일반 인증키(Decoding)>",
        "  YOYANG_EVAL_API_URL=<데이터셋 상세 '오픈 API' 탭의 요청 URL (파라미터 제외)>",
        "",
        "데이터셋: https://www.data.go.kr/data/15104801/fileData.do",
        "",
        "CSV 로 적재하려면: npm run import:eval:csv -- data/raw/파일.csv",
      ].join("\n"),
    );
    process.exit(1);
  }

  return { serviceKey, baseUrl };
}

/** 응답 구조만 확인하고 끝낸다 */
async function probe(perPage) {
  const { serviceKey, baseUrl } = requireApiConfig();

  console.log(`엔드포인트: ${baseUrl}`);
  const json = await fetchPage(baseUrl, serviceKey, 1, Math.min(perPage, 5));
  const { rows, totalCount } = extractRows(json);

  console.log(`\n전체 건수(totalCount): ${totalCount || "(응답에 없음)"}`);
  console.log(`이번 페이지 행 수: ${rows.length}`);

  if (rows.length === 0) {
    console.log("행이 비어 있습니다. 엔드포인트와 활용신청 상태를 확인하세요.");
    return;
  }

  const keys = Object.keys(rows[0]);
  console.log(`\n응답 필드 ${keys.length}개:`);
  for (const k of keys) console.log(`   ${k}`);

  const { found, missing } = resolveFields(keys);

  console.log("\n매핑 결과:");
  for (const [field, key] of Object.entries(found)) {
    console.log(`   ✓ ${field.padEnd(16)} ← ${key}`);
  }
  for (const field of missing) {
    const fatal = REQUIRED_FIELDS.includes(field);
    console.log(`   ${fatal ? "✗" : "·"} ${field.padEnd(16)} ← 못 찾음${fatal ? " (필수)" : ""}`);
  }

  console.log("\n첫 행 원본:");
  console.log(JSON.stringify(rows[0], null, 2));

  const fatal = missing.filter((f) => REQUIRED_FIELDS.includes(f));
  if (fatal.length > 0) {
    console.error(
      `\n✗ 필수 필드를 찾지 못했습니다: ${fatal.join(", ")}` +
        "\n  scripts/eval-common.mjs 의 FIELD_MAP 에 위 응답 필드 이름을 추가하세요.",
    );
    process.exit(1);
  }

  console.log("\n✓ 필수 필드가 모두 잡힙니다. 이제 npm run import:eval 을 돌리세요.");
}

/** 전체 페이지를 순서대로 받는다 */
async function fetchAll({ pages, perPage }) {
  const { serviceKey, baseUrl } = requireApiConfig();

  const all = [];
  let page = 1;
  let totalCount = 0;

  for (;;) {
    const json = await fetchPage(baseUrl, serviceKey, page, perPage);
    const { rows, totalCount: count } = extractRows(json);
    if (count) totalCount = count;

    all.push(...rows);
    console.log(
      `  받음 ${all.length}${totalCount ? `/${totalCount}` : ""} (page ${page})`,
    );

    if (rows.length === 0) break;
    if (totalCount && all.length >= totalCount) break;
    if (pages && page >= pages) break;
    // 안전장치: 응답에 totalCount 가 없는 API 가 끝없이 같은 행을 줄 때
    if (page > 1000) break;

    page += 1;
    await new Promise((r) => setTimeout(r, 150));
  }

  return all;
}

/* -------------------------------- CSV -------------------------------- */

/** CSV 는 보조 경로다. API 를 쓸 수 없을 때만 쓴다. */
async function readCsv(filePath) {
  const [{ parse }, iconv] = await Promise.all([
    import("csv-parse/sync"),
    import("iconv-lite").then((m) => m.default ?? m),
  ]);

  const buffer = fs.readFileSync(filePath);
  const hasBom = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;

  let text;
  if (hasBom) {
    text = buffer.toString("utf8").slice(1);
  } else {
    // 공공데이터 CSV 는 CP949 가 흔하다. 치환 문자가 적은 쪽을 고른다.
    const asCp949 = iconv.decode(buffer, "cp949");
    const asUtf8 = buffer.toString("utf8");
    const bad = (s) => (s.match(/�/g) ?? []).length;
    text = bad(asCp949) <= bad(asUtf8) ? asCp949 : asUtf8;
  }

  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
}

/* -------------------------------- 실행 -------------------------------- */

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.probe) {
    await probe(opts.perPage);
    return;
  }

  const rows = opts.csv
    ? await readCsv(path.resolve(opts.csv))
    : await fetchAll(opts);

  if (rows.length === 0) {
    console.error("받은 행이 없습니다.");
    process.exit(1);
  }

  const keys = Object.keys(rows[0]);
  const { found, missing } = resolveFields(keys);

  const fatal = missing.filter((f) => REQUIRED_FIELDS.includes(f));
  if (fatal.length > 0) {
    console.error(`필수 필드를 찾지 못했습니다: ${fatal.join(", ")}`);
    console.error(`원본 필드: ${keys.join(" | ")}`);
    console.error("scripts/eval-common.mjs 의 FIELD_MAP 을 확인하세요.");
    process.exit(1);
  }
  if (missing.length > 0) {
    // 2025년분은 영역별 지표 체계가 달라 여기 걸릴 수 있다 (new-t.MD §2)
    console.warn(`참고: 아래 필드가 없어 null 로 채웁니다 — ${missing.join(", ")}`);
  }

  const { records, unknownRegions } = normalizeRows(rows, found);
  const deduped = dedupeByKey(records);

  console.log(
    `\n원본 ${rows.length}건 → 적재 대상 ${deduped.length}건` +
      (records.length !== deduped.length
        ? ` (중복 키 ${records.length - deduped.length}건 정리)`
        : ""),
  );
  reportUnknownRegions(unknownRegions);

  if (opts.dryRun) {
    console.log("--dry-run: 적재하지 않고 끝냅니다.");
    console.log("\n첫 행 예시:");
    console.log(JSON.stringify(deduped[0], null, 2));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      ".env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 확인하세요.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await loadIntoSupabase(supabase, deduped);
  await refreshAggregates(supabase);

  console.log("완료");
}

main().catch((error) => {
  console.error(`\n${error.message ?? error}`);
  process.exit(1);
});
