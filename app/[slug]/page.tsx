import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CATEGORIES,
  findCategory,
  getContent,
  type CategorySlug,
} from "@/lib/contents";
import {
  findRegion,
  REGION_HUB_SLUG,
  REGIONS,
  type Region,
} from "@/lib/regions";
import { getRegionStats, round1 } from "@/lib/region-data";
import { buildMetadata, SITE } from "@/lib/seo";
import { decodeSlug } from "@/lib/slug";
import { htmlToPlainText } from "@/lib/post-html";
import RegionHubView from "./RegionHubView";
import RegionView from "./RegionView";
import CategoryView from "./CategoryView";
import GradeView from "./GradeView";
import CostView from "./CostView";
import ArticleView from "./ArticleView";

/**
 * 한 라우트가 네 종류의 화면을 맡는다.
 *
 *   /지역          → 지역 허브        (REGION_HUB_SLUG)
 *   /서울-강남구    → 지역 상세        (lib/regions.ts 의 REGIONS)
 *   /등급          → 가이드 카테고리   (lib/contents.ts 의 CATEGORIES)
 *   /{글 slug}     → 가이드 글        (yoyang_contents)
 *
 * 경로를 한 단계로 유지하면 URL 이 짧고, 나중에 가이드 글을 지역명으로 뽑아
 * 쓰더라도 구조를 바꾸지 않아도 된다. 대신 슬러그가 겹치지 않게 관리해야 한다
 * (지역·카테고리 슬러그와 같은 이름으로 글을 넣으면 글이 가려진다).
 */

// keywordegg 와 동일하게 매 요청 렌더링한다. 광고를 매번 새로 요청받고,
// 조회수 증가를 캐시된 렌더에서 흘리지 않기 위한 선택이다.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

/**
 * 따로 짠 카테고리 화면의 메타데이터.
 *
 * /등급 과 /비용 은 글 목록이 아니라 독립된 문서라서, 카테고리 설명을 그대로
 * 쓰면 화면 내용과 어긋난다.
 */
const CATEGORY_META: Record<
  string,
  { title: string; description: string; keywords: string[] }
> = {
  등급: {
    title: `장기요양기관 평가등급 A~E 읽는 법 | ${SITE.name}`,
    description:
      "공단이 매기는 평가등급 A~E가 무엇을 재는지, 전국 등급 분포는 어떤지, A등급 비율이 높은 지역은 어디인지 공개 데이터로 정리했습니다.",
    keywords: [
      "장기요양기관 평가등급",
      "요양원 등급",
      "A등급 요양원",
      "평가등급 기준",
      "요양시설 평가",
    ],
  },
  비용: {
    title: `요양 비용은 어떻게 정해지나 — 급여와 비급여 | ${SITE.name}`,
    description:
      "요양원 비용이 기관마다 다른 이유를 급여와 비급여로 나눠 설명합니다. 상담 전에 물어볼 네 가지와 부담을 줄이는 제도까지 정리했습니다.",
    keywords: [
      "요양원 비용",
      "장기요양 본인부담금",
      "비급여",
      "식사재료비",
      "상급침실 이용료",
    ],
  },
};

/* ------------------------------ 메타데이터 ------------------------------ */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeSlug((await params).slug);

  if (slug === REGION_HUB_SLUG) {
    return buildMetadata({
      path: `/${REGION_HUB_SLUG}`,
      title: `지역별 장기요양기관 평가 결과 | ${SITE.name}`,
      description:
        "전국 시군구별 장기요양기관 평가등급과 평가일자를 한눈에 봅니다. 시도를 골라 우리 동네 요양원·재가기관 평가 결과를 확인하세요.",
      keywords: ["지역별 요양원", "시군구 장기요양기관", "요양원 평가등급"],
    });
  }

  const region = findRegion(slug);
  if (region) return regionMetadata(region);

  const category = findCategory(slug);
  if (category) {
    const custom = CATEGORY_META[category.slug];
    return buildMetadata({
      path: `/${category.slug}`,
      title: custom?.title ?? `${category.name} | ${SITE.name}`,
      description: custom?.description ?? category.description,
      keywords: custom?.keywords ?? [category.name, "장기요양", SITE.name],
    });
  }

  const content = await getContent(slug);
  if (!content) return {};

  const summary =
    content.excerpt?.trim() || htmlToPlainText(content.content).slice(0, 150);

  return buildMetadata({
    path: `/${content.slug}`,
    title: `${content.title} | ${SITE.name}`,
    description: summary,
    keywords: [...content.tags, findCategory(content.category)?.name ?? ""],
    type: "article",
    image: content.thumbnail ?? undefined,
  });
}

async function regionMetadata(region: Region): Promise<Metadata> {
  const stats = await getRegionStats(region.slug);
  const count = stats?.facility_count ?? 0;

  // 아직 데이터가 없는 지역은 색인시키지 않는다.
  // 빈 페이지가 대량으로 색인되면 사이트 전체 품질 평가가 깎이고,
  // 애드센스 심사에서도 '가치 없는 콘텐츠'로 걸린다.
  if (count === 0) {
    return {
      ...buildMetadata({
        path: `/${region.slug}`,
        title: `${region.name} 장기요양기관 평가 결과 | ${SITE.name}`,
        description: `${region.name}의 장기요양기관 평가 결과를 정리하는 중입니다.`,
      }),
      robots: { index: false, follow: true },
    };
  }

  const avg = round1(stats?.avg_total_score);
  const description = `${region.name}의 장기요양기관 ${count}곳의 평가등급·총점·평가일자를 정리했습니다. A등급 ${stats?.grade_a ?? 0}곳${avg !== null ? `, 평균 평가총점 ${avg}점` : ""}.`;

  return buildMetadata({
    path: `/${region.slug}`,
    title: `${region.name} 요양원·장기요양기관 평가등급 | ${SITE.name}`,
    description,
    keywords: [
      `${region.name} 요양원`,
      `${region.name} 요양시설`,
      `${region.sigungu || region.sido} 장기요양기관`,
      "평가등급",
    ],
  });
}

/* -------------------------------- 화면 -------------------------------- */

export default async function SlugPage({ params, searchParams }: Props) {
  const slug = decodeSlug((await params).slug);

  if (slug === REGION_HUB_SLUG) return <RegionHubView />;

  const region = findRegion(slug);
  if (region) return <RegionView region={region} />;

  const category = findCategory(slug);
  if (category) {
    // 등급·비용은 글 목록이 아니라 주제에 맞춰 따로 짠 화면을 쓴다.
    // 나머지 카테고리는 기본 목록 화면 그대로다.
    if (category.slug === "등급") return <GradeView category={category} />;
    if (category.slug === "비용") return <CostView category={category} />;

    const { page } = await searchParams;
    return (
      <CategoryView
        category={category}
        page={Math.max(1, Number(page ?? 1) || 1)}
      />
    );
  }

  const content = await getContent(slug);
  if (!content) notFound();

  return <ArticleView content={content} />;
}

/** 고정 경로(허브·카테고리·지역)는 미리 알려준다 */
export function generateStaticParams(): { slug: string }[] {
  return [
    { slug: REGION_HUB_SLUG },
    ...CATEGORIES.map((c) => ({ slug: c.slug as CategorySlug as string })),
    ...REGIONS.map((r) => ({ slug: r.slug })),
  ];
}
