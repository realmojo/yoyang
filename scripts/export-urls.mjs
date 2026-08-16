#!/usr/bin/env node
/**
 * 사이트의 모든 URL 을 naver-indexing/urls.txt 로 뽑는다.
 *
 *   npm run export:urls
 *   npm run export:urls -- --out 다른/경로.txt
 *
 * 네이버 서치어드바이저 크롤링 요청 자동화(naver-indexing/index.js)가 이 파일을
 * 한 줄에 URL 하나씩 읽는다.
 *
 * 인코딩은 사이트맵·canonical 과 똑같이 맞춘다(경로 구간별 퍼센트 인코딩).
 * 한글 그대로 넣으면 같은 페이지인데 검색엔진에는 다른 문자열로 보일 수 있다.
 *
 * 순서는 중요한 것부터다. 자동화 스크립트가 매번 무작위로 뽑아 쓰긴 하지만,
 * 손으로 앞부분만 잘라 쓸 때 홈·지역이 먼저 오는 편이 낫다.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import { ROOT } from "./eval-common.mjs";

dotenv.config({ path: path.join(ROOT, ".env.local") });

const SITE = "https://yoyang.keywordegg.com";

/** lib/seo.ts 의 absoluteUrl 과 같은 규칙 */
function absoluteUrl(pathname) {
  if (!pathname || pathname === "/") return SITE;
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE}${withSlash.split("/").map(encodeURIComponent).join("/")}`;
}

/** lib/menu.ts · lib/contents.ts · lib/regions.ts 와 맞춰야 한다 */
const STATIC_PATHS = [
  "/",
  "/지역",
  "/등급",
  "/비용",
  "/시설",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

async function main() {
  const outArg = process.argv.indexOf("--out");
  const outFile =
    outArg >= 0 && process.argv[outArg + 1]
      ? path.resolve(process.argv[outArg + 1])
      : path.join(ROOT, "naver-indexing/urls.txt");

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

  const urls = [];
  const counts = {};

  // 1) 고정 페이지
  for (const p of STATIC_PATHS) urls.push(absoluteUrl(p));
  counts.static = STATIC_PATHS.length;

  // 2) 지역 — 데이터가 있는 곳만. 빈 페이지는 noindex 라 제출할 이유가 없다
  {
    const { data, error } = await supabase
      .from("yoyang_regions")
      .select("region_slug, facility_count")
      .gt("facility_count", 0)
      .limit(1000);

    if (error) throw new Error(`지역 조회 실패: ${error.message}`);
    for (const row of data ?? []) urls.push(absoluteUrl(`/${row.region_slug}`));
    counts.regions = data?.length ?? 0;
  }

  // 3) 가이드 글
  {
    const { data, error } = await supabase
      .from("yoyang_contents")
      .select("slug")
      .limit(1000);

    if (error) throw new Error(`가이드 조회 실패: ${error.message}`);
    for (const row of data ?? []) urls.push(absoluteUrl(`/${row.slug}`));
    counts.guides = data?.length ?? 0;
  }

  // 4) 기관 — 중복 제거는 DB 함수가 맡는다.
  //    Supabase 가 한 응답에 1,000행까지만 주므로 그 크기로 끊어 받는다.
  {
    const { data: totalRaw, error: countError } = await supabase.rpc(
      "yoyang_facility_url_count",
    );
    if (countError) throw new Error(`기관 수 조회 실패: ${countError.message}`);

    const total = Number(totalRaw ?? 0);
    const PAGE = 1000;
    let got = 0;

    for (let offset = 0; offset < total; offset += PAGE) {
      const { data, error } = await supabase.rpc("yoyang_facility_urls", {
        p_offset: offset,
        p_limit: PAGE,
      });
      if (error) throw new Error(`기관 조회 실패: ${error.message}`);
      if (!data?.length) break;

      for (const row of data) {
        urls.push(absoluteUrl(`/${row.region_slug}/${row.slug}`));
      }
      got += data.length;
      process.stderr.write(`\r  기관 ${got}/${total}`);
    }
    process.stderr.write("\n");
    counts.facilities = got;
  }

  // 혹시 모를 중복 제거 (순서는 유지)
  const unique = [...new Set(urls)];

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${unique.join("\n")}\n`, "utf8");

  console.log("");
  console.log(`고정 페이지 ${counts.static}`);
  console.log(`지역        ${counts.regions}`);
  console.log(`가이드      ${counts.guides}`);
  console.log(`기관        ${counts.facilities}`);
  console.log("─".repeat(28));
  console.log(`합계        ${unique.length}`);
  if (unique.length !== urls.length) {
    console.log(`(중복 ${urls.length - unique.length}건 제거)`);
  }
  console.log(`\n${outFile}`);
}

main().catch((error) => {
  console.error(`\n${error.message ?? error}`);
  process.exit(1);
});
