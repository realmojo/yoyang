#!/usr/bin/env node
/**
 * 가이드 글을 data/guides/*.json 에서 읽어 yoyang_contents 에 넣는다.
 *
 *   npm run seed:guides              전체 반영
 *   npm run seed:guides -- --dry-run 넣지 않고 검사만
 *
 * 글을 DB 에서 직접 고치는 대신 저장소에 두는 이유는 두 가지다.
 *   1) 변경 이력이 남는다 (금액·제도 설명이 바뀌면 언제 왜 바꿨는지 추적된다)
 *   2) slug 충돌을 적재 전에 잡을 수 있다
 *
 * slug 이 지역·카테고리와 겹치면 그 글은 영원히 열리지 않는다.
 * (app/[slug]/page.tsx 가 지역 → 카테고리 → 글 순으로 찾기 때문)
 * 그래서 넣기 전에 반드시 확인한다.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import { ROOT } from "./eval-common.mjs";

dotenv.config({ path: path.join(ROOT, ".env.local") });

const GUIDES_DIR = path.join(ROOT, "data/guides");

/** lib/contents.ts 의 CATEGORIES 와 맞춰야 한다 */
const CATEGORIES = ["등급", "비용", "시설"];

/** lib/regions.ts 의 REGION_HUB_SLUG */
const HUB_SLUG = "지역";

/** data/regions.json 으로 지역 슬러그를 만든다 (eval-common.mjs 와 같은 규칙) */
function knownRegionSlugs() {
  const data = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/regions.json"), "utf8"),
  );
  const slugs = new Set();
  for (const sido of data.sidos) {
    const children = data.sigungu[sido.short] ?? [];
    if (children.length === 0) {
      slugs.add(sido.short);
      continue;
    }
    for (const g of children) slugs.add(`${sido.short}-${g}`);
  }
  return slugs;
}

function loadGuides() {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(GUIDES_DIR, file), "utf8");
      try {
        return { file, ...JSON.parse(raw) };
      } catch (error) {
        throw new Error(`${file} 파싱 실패: ${error.message}`);
      }
    });
}

/** 본문에서 태그를 뺀 순수 글자 수 (분량 기준 확인용) */
function textLength(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

function validate(guide, reserved) {
  const errors = [];
  const warnings = [];

  for (const field of ["slug", "category", "title", "content"]) {
    if (!guide[field]) errors.push(`${field} 가 비어 있습니다`);
  }
  if (!guide.slug) return { errors, warnings };

  if (!CATEGORIES.includes(guide.category)) {
    errors.push(`category 는 ${CATEGORIES.join(" / ")} 중 하나여야 합니다`);
  }
  if (reserved.has(guide.slug)) {
    errors.push(
      `slug "${guide.slug}" 이 지역/카테고리 경로와 겹칩니다. 이 글은 열리지 않습니다`,
    );
  }
  if (/\s/.test(guide.slug)) {
    errors.push("slug 에 공백이 들어갈 수 없습니다");
  }

  // template.md 의 작성 기준. 어겨도 넣기는 하되 알려준다.
  const len = textLength(guide.content ?? "");
  if (len < 1200) warnings.push(`본문 ${len}자 — 권장 최소 1,200자`);

  const h2 = (guide.content?.match(/<h2[\s>]/gi) ?? []).length;
  if (h2 < 4 || h2 > 6) warnings.push(`h2 ${h2}개 — 권장 4~6개`);

  const titleLen = (guide.title ?? "").length;
  if (titleLen < 30 || titleLen > 45) {
    warnings.push(`제목 ${titleLen}자 — 권장 30~45자`);
  }

  const excerptLen = (guide.excerpt ?? "").length;
  if (excerptLen && (excerptLen < 130 || excerptLen > 160)) {
    warnings.push(`소개글 ${excerptLen}자 — 권장 130~160자`);
  }

  if ((guide.faq ?? []).length === 0) warnings.push("faq 가 없습니다");

  return { errors, warnings };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const guides = loadGuides();
  if (guides.length === 0) {
    console.error("data/guides 에 json 이 없습니다.");
    process.exit(1);
  }

  const reserved = knownRegionSlugs();
  reserved.add(HUB_SLUG);
  for (const c of CATEGORIES) reserved.add(c);

  let failed = false;
  const rows = [];

  for (const guide of guides) {
    const { errors, warnings } = validate(guide, reserved);

    console.log(`\n${guide.file}`);
    console.log(`  ${guide.title ?? "(제목 없음)"}`);
    console.log(`  /${guide.slug}  ·  ${guide.category}`);

    for (const w of warnings) console.log(`  ⚠ ${w}`);
    for (const e of errors) {
      console.log(`  ✗ ${e}`);
      failed = true;
    }
    if (errors.length === 0 && warnings.length === 0) {
      console.log("  ✓ 기준 통과");
    }

    rows.push({
      slug: guide.slug,
      category: guide.category,
      title: guide.title,
      excerpt: guide.excerpt ?? null,
      content: guide.content,
      thumbnail: guide.thumbnail ?? null,
      tags: guide.tags ?? [],
      cta_text: guide.cta_text ?? null,
      cta_url: guide.cta_url ?? null,
      faq: guide.faq ?? [],
    });
  }

  if (failed) {
    console.error("\n오류가 있어 중단합니다.");
    process.exit(1);
  }

  if (dryRun) {
    console.log("\n--dry-run: 넣지 않고 끝냅니다.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "\n.env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 확인하세요.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // created_at 은 건드리지 않는다. 글을 고쳐 다시 넣어도 등록일이 밀리지 않게.
  const { error } = await supabase
    .from("yoyang_contents")
    .upsert(rows, { onConflict: "slug" });

  if (error) {
    console.error(`\n적재 실패: ${error.message}`);
    process.exit(1);
  }

  console.log(`\n${rows.length}편 반영 완료`);
}

main().catch((error) => {
  console.error(`\n${error.message ?? error}`);
  process.exit(1);
});
