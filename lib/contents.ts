/**
 * 전국 공통 가이드 글 정의와 조회.
 *
 * 지역 페이지(평가 데이터 집계)와 달리, 가이드는 사람이 쓴 글이다.
 * Supabase 의 yoyang_contents 테이블에 직접 넣고 사이트는 읽기 전용으로 보여준다.
 * 모든 조회는 서비스 롤 키를 쓰는 서버 컴포넌트에서만 실행된다.
 */

import { supabaseAdmin } from "@/lib/supabase";

export const CONTENTS_TABLE = "yoyang_contents";
export const PER_PAGE = 12;

/** 카테고리 슬러그는 URL 에 그대로 들어간다 (한글 슬러그 정책) */
export type CategorySlug = "등급" | "비용" | "시설";

export interface Category {
  slug: CategorySlug;
  /** CSS 클래스(cat-badge--{key})에 쓰는 영문 키 */
  key: "grade" | "cost" | "facility";
  name: string;
  description: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  {
    slug: "등급",
    key: "grade",
    name: "등급·신청",
    description:
      "장기요양등급 신청 절차, 등급 판정 기준, 갱신과 이의신청까지 순서대로 정리합니다.",
    emoji: "📋",
  },
  {
    slug: "비용",
    key: "cost",
    name: "비용·급여",
    description:
      "등급별 월 한도액, 본인부담률과 경감 제도, 비급여 항목의 구조를 설명합니다.",
    emoji: "💳",
  },
  {
    slug: "시설",
    key: "facility",
    name: "시설 선택",
    description:
      "시설에 모실지 집에서 받을지, 평가등급은 어떻게 읽는지, 계약 전에 확인할 것은 무엇인지 다룹니다.",
    emoji: "🏥",
  },
];

const CATEGORY_INDEX = new Map<string, Category>(
  CATEGORIES.map((c) => [c.slug, c]),
);

export function findCategory(slug: string): Category | null {
  return CATEGORY_INDEX.get(slug) ?? null;
}

export function categoryName(slug: string): string {
  return CATEGORY_INDEX.get(slug)?.name ?? slug;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Content {
  id: number;
  slug: string;
  category: CategorySlug;
  title: string;
  excerpt: string | null;
  content: string;
  thumbnail: string | null;
  tags: string[];
  views: number;
  /** 본문 상·하단 CTA 버튼 (문구·링크가 모두 있어야 노출) */
  cta_text: string | null;
  cta_url: string | null;
  faq: FaqItem[];
  created_at: string;
}

/** 목록에서는 본문을 빼서 전송량을 줄인다 */
const LIST_COLUMNS =
  "id, slug, category, title, excerpt, thumbnail, tags, views, created_at";
const DETAIL_COLUMNS = `${LIST_COLUMNS}, content, cta_text, cta_url, faq`;

export type ContentSummary = Omit<
  Content,
  "content" | "cta_text" | "cta_url" | "faq"
>;

export interface ListResult {
  items: ContentSummary[];
  total: number;
  page: number;
  totalPages: number;
}

const EMPTY: ListResult = { items: [], total: 0, page: 1, totalPages: 1 };

interface ListParams {
  category?: CategorySlug;
  page?: number;
  perPage?: number;
  /** 제외할 글 id (관련글에서 자기 자신 제외) */
  excludeId?: number;
}

/** 가이드 글 목록 (최신순) */
export async function listContents({
  category,
  page = 1,
  perPage = PER_PAGE,
  excludeId,
}: ListParams = {}): Promise<ListResult> {
  if (!supabaseAdmin) return EMPTY;

  const current = Math.max(1, page);

  try {
    let query = supabaseAdmin
      .from(CONTENTS_TABLE)
      .select(LIST_COLUMNS, { count: "exact" });

    if (category) query = query.eq("category", category);
    if (excludeId) query = query.neq("id", excludeId);

    const from = (current - 1) * perPage;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + perPage - 1);

    if (error) {
      console.error("listContents error", error.message);
      return EMPTY;
    }

    const total = count ?? 0;
    return {
      items: (data ?? []) as unknown as ContentSummary[],
      total,
      page: current,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  } catch (error) {
    console.error("listContents exception", error);
    return EMPTY;
  }
}

/** slug 로 글 한 건 */
export async function getContent(slug: string): Promise<Content | null> {
  if (!supabaseAdmin) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from(CONTENTS_TABLE)
      .select(DETAIL_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("getContent error", error.message);
      return null;
    }
    return (data as unknown as Content) ?? null;
  } catch (error) {
    console.error("getContent exception", error);
    return null;
  }
}

/** 같은 카테고리의 다른 글 (글 하단 관련글) */
export async function listRelated(
  content: Pick<Content, "id" | "category">,
  limit = 4,
): Promise<ContentSummary[]> {
  const { items } = await listContents({
    category: content.category,
    perPage: limit,
    excludeId: content.id,
  });
  return items;
}

/** 조회수 1 증가 (실패해도 화면에는 영향이 없도록 조용히 넘어간다) */
export async function increaseContentView(id: number): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.rpc("increment_yoyang_content_view", {
      content_id: id,
    });
  } catch {
    // RPC 가 없으면 무시한다
  }
}

/** 날짜를 2026.08.16 형태로 */
export function formatDate(value: string): string {
  const d = new Date(value);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
