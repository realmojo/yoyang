import { SITE_LINKS } from "@/lib/menu";
import { CATEGORIES, CONTENTS_TABLE } from "@/lib/contents";
import { REGION_HUB_SLUG } from "@/lib/regions";
import { getAllRegionStats, regionsWithData } from "@/lib/region-data";
import { supabaseAdmin } from "@/lib/supabase";
import { buildUrlSet, xmlResponse, type SitemapEntry } from "@/lib/sitemap";

/**
 * 기관을 뺀 나머지 전부 — 홈, 지역 허브, 카테고리, 안내 페이지, 지역 상세,
 * 가이드 글. 다 합쳐도 수백 개라 한 파일로 충분하다.
 */
export const revalidate = 3600;

const OVERRIDES: Record<string, { changeFrequency: string; priority: number }> =
  {
    "/": { changeFrequency: "daily", priority: 1 },
    [`/${REGION_HUB_SLUG}`]: { changeFrequency: "weekly", priority: 0.9 },
    "/about": { changeFrequency: "monthly", priority: 0.5 },
    "/contact": { changeFrequency: "monthly", priority: 0.5 },
    "/privacy": { changeFrequency: "yearly", priority: 0.3 },
    "/terms": { changeFrequency: "yearly", priority: 0.3 },
  };

const DEFAULT = { changeFrequency: "weekly", priority: 0.8 };

/**
 * 지역 페이지.
 *
 * 데이터가 아직 없는 지역은 넣지 않는다. 빈 페이지를 대량으로 제출하면
 * 크롤링 예산만 쓰고 사이트 품질 평가에도 좋지 않다.
 * (해당 페이지들은 generateMetadata 에서 noindex 로도 막아 둔다)
 */
async function regionEntries(): Promise<SitemapEntry[]> {
  const stats = await getAllRegionStats();

  return regionsWithData(stats).map((region) => ({
    path: `/${region.slug}`,
    lastModified: stats.get(region.slug)?.updated_at ?? null,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
}

/** 가이드 글 */
async function contentEntries(): Promise<SitemapEntry[]> {
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from(CONTENTS_TABLE)
      .select("slug, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error || !data) return [];

    return (data as { slug: string; created_at: string }[]).map((row) => ({
      path: `/${row.slug}`,
      lastModified: row.created_at,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const now = new Date();

  const paths = Array.from(
    new Set([
      "/",
      `/${REGION_HUB_SLUG}`,
      ...CATEGORIES.map((c) => `/${c.slug}`),
      ...SITE_LINKS.map((l) => l.href),
    ]),
  );

  const staticEntries: SitemapEntry[] = paths.map((path) => {
    const { changeFrequency, priority } = OVERRIDES[path] ?? DEFAULT;
    return { path, lastModified: now, changeFrequency, priority };
  });

  const entries = [
    ...staticEntries,
    ...(await regionEntries()),
    ...(await contentEntries()),
  ];

  return xmlResponse(buildUrlSet(entries));
}
