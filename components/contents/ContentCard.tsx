import { ContentSummary, findCategory, formatDate } from "@/lib/contents";

/** 썸네일이 없을 때 카테고리 이모지로 대체한다 */
function Thumb({ item }: { item: ContentSummary }) {
  const category = findCategory(item.category);
  if (item.thumbnail) {
    // 외부 이미지가 섞이므로 next/image 대신 img 를 쓴다
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.thumbnail} alt="" loading="lazy" />;
  }
  return <span aria-hidden>{category?.emoji ?? "📄"}</span>;
}

export function CategoryBadge({ category }: { category: string }) {
  const found = findCategory(category);
  if (!found) return null;
  return (
    <span className={`cat-badge cat-badge--${found.key}`}>{found.name}</span>
  );
}

/** 세로형 카드 (그리드·히어로) */
export function ContentCard({
  item,
  main = false,
}: {
  item: ContentSummary;
  main?: boolean;
}) {
  return (
    <a
      target="_self"
      href={`/${item.slug}`}
      className={`card${main ? " card--main" : ""}`}
    >
      <div className="card__img">
        <Thumb item={item} />
      </div>
      <div className="card__body">
        <CategoryBadge category={item.category} />
        <h3 className="card__title">{item.title}</h3>
        {item.excerpt && <p className="card__excerpt">{item.excerpt}</p>}
        <div className="card__meta">{formatDate(item.created_at)}</div>
      </div>
    </a>
  );
}

/** 가로형 리스트 항목 */
export function ContentRow({ item }: { item: ContentSummary }) {
  return (
    <a target="_self" href={`/${item.slug}`} className="post-row">
      <div className="post-row__img">
        <Thumb item={item} />
      </div>
      <div className="post-row__body">
        <CategoryBadge category={item.category} />
        <h3 className="card__title">{item.title}</h3>
        <div className="card__meta">{formatDate(item.created_at)}</div>
      </div>
    </a>
  );
}
