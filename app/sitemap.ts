import { MetadataRoute } from "next";
import { SITE_LINKS } from "@/lib/menu";
import { CATEGORIES, CONTENTS_TABLE } from "@/lib/contents";
import { REGION_HUB_SLUG } from "@/lib/regions";
import {
  FACILITIES_TABLE,
  getAllRegionStats,
  regionsWithData,
} from "@/lib/region-data";
import { absoluteUrl } from "@/lib/seo";
import { supabaseAdmin } from "@/lib/supabase";

export const revalidate = 3600;

const OVERRIDES: Record<
  string,
  {
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }
> = {
  "/": { changeFrequency: "daily", priority: 1 },
  [`/${REGION_HUB_SLUG}`]: { changeFrequency: "weekly", priority: 0.9 },
  "/about": { changeFrequency: "monthly", priority: 0.5 },
  "/contact": { changeFrequency: "monthly", priority: 0.5 },
  "/privacy": { changeFrequency: "yearly", priority: 0.3 },
  "/terms": { changeFrequency: "yearly", priority: 0.3 },
};

const DEFAULT = { changeFrequency: "weekly" as const, priority: 0.8 };

/**
 * 지역 페이지.
 *
 * 데이터가 아직 없는 지역은 넣지 않는다. 빈 페이지를 대량으로 제출하면
 * 크롤링 예산만 쓰고 사이트 품질 평가에도 좋지 않다.
 * (해당 페이지들은 generateMetadata 에서 noindex 로도 막아 둔다)
 */
async function regionEntries(): Promise<MetadataRoute.Sitemap> {
  const stats = await getAllRegionStats();

  return regionsWithData(stats).map((region) => {
    const row = stats.get(region.slug);
    return {
      url: absoluteUrl(`/${region.slug}`),
      lastModified: row?.updated_at ? new Date(row.updated_at) : new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    };
  });
}

/**
 * 기관 상세 페이지.
 *
 * 21,000곳이 넘어서 사이트맵의 대부분을 차지한다. 사이트맵 한 파일의 상한은
 * URL 50,000개라 아직 한 파일에 들어가지만, 기관이 더 늘어나면 나눠야 한다.
 *
 * 기관 단위로 하나씩만 넣는다. 같은 기관이 급여종류·평가회차별로 여러 행이라
 * 그대로 넣으면 같은 URL 이 여러 번 들어간다.
 */
async function facilityEntries(): Promise<MetadataRoute.Sitemap> {
  if (!supabaseAdmin) return [];

  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  try {
    for (let from = 0; from < 60000; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from(FACILITIES_TABLE)
        .select("region_slug, slug, eval_date")
        .not("slug", "is", null)
        .order("id", { ascending: true })
        .range(from, from + 999);

      if (error || !data?.length) break;

      for (const row of data as {
        region_slug: string;
        slug: string;
        eval_date: string | null;
      }[]) {
        const url = `/${row.region_slug}/${row.slug}`;
        if (seen.has(url)) continue;
        seen.add(url);
        entries.push({
          url: absoluteUrl(url),
          lastModified: row.eval_date ? new Date(row.eval_date) : new Date(),
          changeFrequency: "yearly" as const,
          priority: 0.5,
        });
      }

      if (data.length < 1000) break;
    }
  } catch {
    return entries;
  }

  return entries;
}

/** 가이드 글 (Supabase 는 요청당 1000행이 상한이라 나눠서 받는다) */
async function contentEntries(): Promise<MetadataRoute.Sitemap> {
  if (!supabaseAdmin) return [];

  const rows: { slug: string; created_at: string }[] = [];
  try {
    for (let from = 0; from < 10000; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from(CONTENTS_TABLE)
        .select("slug, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + 999);

      if (error || !data?.length) break;
      rows.push(...(data as { slug: string; created_at: string }[]));
      if (data.length < 1000) break;
    }
  } catch {
    return [];
  }

  return rows.map((row) => ({
    url: absoluteUrl(`/${row.slug}`),
    lastModified: new Date(row.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const paths = Array.from(
    new Set([
      "/",
      `/${REGION_HUB_SLUG}`,
      ...CATEGORIES.map((c) => `/${c.slug}`),
      ...SITE_LINKS.map((l) => l.href),
    ]),
  );

  const staticEntries: MetadataRoute.Sitemap = paths.map((path) => {
    const { changeFrequency, priority } = OVERRIDES[path] ?? DEFAULT;
    return {
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency,
      priority,
    };
  });

  return [
    ...staticEntries,
    ...(await regionEntries()),
    ...(await contentEntries()),
    ...(await facilityEntries()),
  ];
}
