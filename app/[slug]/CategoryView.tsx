import { listContents, PER_PAGE, type Category } from "@/lib/contents";
import { ContentCard } from "@/components/contents/ContentCard";
import Adsense from "@/components/Adsense";
import { AD_SLOTS } from "@/lib/ads";

/** 가이드 카테고리 목록 `/등급`, `/비용`, `/시설`, `/재가` */
export default async function CategoryView({
  category,
  page,
}: {
  category: Category;
  page: number;
}) {
  const { items, total, totalPages } = await listContents({
    category: category.slug,
    page,
    perPage: PER_PAGE,
  });

  return (
    <>
      <div className="page-head">
        <h1>
          <span aria-hidden>{category.emoji}</span>
          {category.name}
        </h1>
        <p>{category.description}</p>
      </div>

      {items.length === 0 ? (
        <div className="empty-box">
          아직 {category.name} 카테고리에 등록된 글이 없습니다.
        </div>
      ) : (
        <>
          <div className="post-grid">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="pager" aria-label="페이지 이동">
              {page > 1 && (
                <a target="_self" href={`/${category.slug}?page=${page - 1}`}>
                  이전
                </a>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) =>
                n === page ? (
                  <span key={n} className="is-current">
                    {n}
                  </span>
                ) : (
                  <a
                    target="_self"
                    key={n}
                    href={`/${category.slug}?page=${n}`}
                  >
                    {n}
                  </a>
                ),
              )}
              {page < totalPages && (
                <a target="_self" href={`/${category.slug}?page=${page + 1}`}>
                  다음
                </a>
              )}
            </nav>
          )}

          <p
            style={{
              marginTop: 18,
              textAlign: "center",
              fontSize: 12,
              color: "#7a8073",
            }}
          >
            전체 {total}건
          </p>
        </>
      )}

      <div className="ad-slot">
        <Adsense slotId={AD_SLOTS.bottom} />
      </div>
    </>
  );
}
