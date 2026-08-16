/**
 * 사이트맵 생성 공통 모듈.
 *
 * 기관 페이지가 21,000개가 넘어서 한 파일에 다 담으면 생성도 느리고
 * 서치콘솔 제출도 실패한다. 그래서 **사이트맵 인덱스**로 쪼갠다.
 *
 *   /sitemap.xml                  인덱스 (아래 파일들을 가리킨다)
 *   /sitemap-pages.xml            홈·카테고리·안내·지역·가이드 (수백 개)
 *   /sitemap-facilities/1.xml     기관 1~5000
 *   /sitemap-facilities/2.xml     기관 5001~10000
 *   ...
 *
 * 규격상 한 파일에 URL 50,000개까지 넣을 수 있지만 여기서는 1,000개로 끊는다.
 * **Supabase(PostgREST)가 한 응답에 1,000행까지만 돌려주기 때문이다.**
 * 이보다 크게 잡으면 나머지가 조용히 잘려서, 사이트맵은 정상으로 보이는데
 * 실제로는 일부 URL 이 아예 제출되지 않는다. 이 값을 올리려면 먼저
 * Supabase 의 max-rows 설정부터 올려야 한다.
 */

import { supabaseAdmin } from "@/lib/supabase";
import { absoluteUrl } from "@/lib/seo";

export const FACILITY_CHUNK = 1000;

export interface SitemapEntry {
  path: string;
  /** Date 도 되고 DB 에서 온 문자열(2025-11-17)도 그대로 받는다 */
  lastModified?: Date | string | null;
  changeFrequency?: string;
  priority?: number;
}

/** XML 에 그대로 넣을 수 없는 문자를 바꾼다 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** <urlset> 문서 */
export function buildUrlSet(entries: SitemapEntry[]): string {
  const body = entries
    .map((entry) => {
      const lines = [`    <loc>${escapeXml(absoluteUrl(entry.path))}</loc>`];
      const last = toIsoDate(entry.lastModified);
      if (last) lines.push(`    <lastmod>${last}</lastmod>`);
      if (entry.changeFrequency) {
        lines.push(`    <changefreq>${entry.changeFrequency}</changefreq>`);
      }
      if (entry.priority !== undefined) {
        lines.push(`    <priority>${entry.priority}</priority>`);
      }
      return `  <url>\n${lines.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/** <sitemapindex> 문서 */
export function buildSitemapIndex(
  items: Array<{ path: string; lastModified?: Date | string | null }>,
): string {
  const body = items
    .map((item) => {
      const lines = [`    <loc>${escapeXml(absoluteUrl(item.path))}</loc>`];
      const last = toIsoDate(item.lastModified);
      if (last) lines.push(`    <lastmod>${last}</lastmod>`);
      return `  <sitemap>\n${lines.join("\n")}\n  </sitemap>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>
`;
}

export function xmlResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

/* ------------------------------ 기관 URL ------------------------------ */

export interface FacilityUrlRow {
  region_slug: string;
  slug: string;
  last_modified: string | null;
}

/** 중복을 걷어낸 기관 URL 총 개수 */
export async function countFacilityUrls(): Promise<number> {
  if (!supabaseAdmin) return 0;
  try {
    const { data, error } = await supabaseAdmin.rpc(
      "yoyang_facility_url_count",
    );
    if (error) {
      console.error("countFacilityUrls error", error.message);
      return 0;
    }
    return Number(data ?? 0);
  } catch (error) {
    console.error("countFacilityUrls exception", error);
    return 0;
  }
}

/** page 는 1부터 */
export async function listFacilityUrls(page: number): Promise<FacilityUrlRow[]> {
  if (!supabaseAdmin) return [];
  const offset = (Math.max(1, page) - 1) * FACILITY_CHUNK;

  try {
    const { data, error } = await supabaseAdmin.rpc("yoyang_facility_urls", {
      p_offset: offset,
      p_limit: FACILITY_CHUNK,
    });
    if (error) {
      console.error("listFacilityUrls error", error.message);
      return [];
    }
    return (data ?? []) as FacilityUrlRow[];
  } catch (error) {
    console.error("listFacilityUrls exception", error);
    return [];
  }
}

export function facilityChunkCount(total: number): number {
  return Math.max(1, Math.ceil(total / FACILITY_CHUNK));
}
