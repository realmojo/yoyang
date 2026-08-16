import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import { CONTENTS_TABLE, type ContentSummary } from "@/lib/contents";
import { REGIONS, REGION_HUB_SLUG } from "@/lib/regions";
import { buildMetadata, SITE } from "@/lib/seo";
import { ContentCard } from "@/components/contents/ContentCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...buildMetadata({
    path: "/search",
    title: `검색 | ${SITE.name}`,
    description: "지역과 가이드 글을 검색합니다.",
  }),
  robots: { index: false, follow: true },
};

const COLUMNS =
  "id, slug, category, title, excerpt, thumbnail, tags, views, created_at";

async function searchContents(q: string): Promise<ContentSummary[]> {
  if (!supabaseAdmin || !q) return [];

  // 특수문자가 or() 문법을 깨지 않도록 걸러낸다
  const safe = q.replace(/[%,()]/g, " ").trim();
  if (!safe) return [];

  const { data, error } = await supabaseAdmin
    .from(CONTENTS_TABLE)
    .select(COLUMNS)
    .or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("search error", error.message);
    return [];
  }
  return (data ?? []) as unknown as ContentSummary[];
}

/** 지역명은 DB 를 거치지 않고 목록에서 바로 찾는다 */
function searchRegions(q: string) {
  const key = q.replace(/\s+/g, "");
  if (!key) return [];
  return REGIONS.filter(
    (r) => r.name.replace(/\s+/g, "").includes(key) || r.sigungu.includes(key),
  ).slice(0, 20);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const keyword = (q ?? "").trim();
  const [items, regions] = await Promise.all([
    searchContents(keyword),
    Promise.resolve(searchRegions(keyword)),
  ]);

  const total = items.length + regions.length;

  return (
    <>
      <div className="page-head">
        <h1>
          <span aria-hidden>🔍</span>
          검색
        </h1>
        <p>
          {keyword
            ? `"${keyword}" 검색 결과 ${total}건`
            : "지역명이나 궁금한 내용을 입력해주세요."}
        </p>
      </div>

      {regions.length > 0 && (
        <section className="sido-block">
          <h2 className="sido-block__title">
            <span aria-hidden>📍</span>
            지역
            <span className="sido-block__count">{regions.length}곳</span>
          </h2>
          <div className="region-chips">
            {regions.map((r) => (
              <a target="_self" key={r.slug} href={`/${r.slug}`}>
                {r.name}
              </a>
            ))}
          </div>
        </section>
      )}

      {keyword && total === 0 ? (
        <div className="empty-box">
          검색 결과가 없습니다.
          <br />
          <a
            target="_self"
            href={`/${REGION_HUB_SLUG}`}
            style={{ textDecoration: "underline" }}
          >
            지역 목록에서 찾아보기
          </a>
        </div>
      ) : (
        items.length > 0 && (
          <div className="post-grid" style={{ marginTop: 20 }}>
            {items.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )
      )}
    </>
  );
}
