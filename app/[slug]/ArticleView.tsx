import {
  findCategory,
  formatDate,
  increaseContentView,
  listRelated,
  type Content,
} from "@/lib/contents";
import { renderPostContent, htmlToPlainText } from "@/lib/post-html";
import { absoluteUrl, breadcrumbJsonLd, faqJsonLd, SITE } from "@/lib/seo";
import Adsense from "@/components/Adsense";
import { AD_SLOTS } from "@/lib/ads";

/** 본문 h2/h3 에 id 를 붙이고 목차 항목을 뽑아낸다 */
function buildToc(html: string) {
  const items: { id: string; text: string; depth: number }[] = [];
  let index = 0;

  const withIds = html.replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag: string, attrs: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (!text) return match;
      index += 1;
      const id = `toc-${index}`;
      items.push({ id, text, depth: tag.toLowerCase() === "h2" ? 2 : 3 });
      if (/\sid=/.test(attrs)) return match;
      return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
    },
  );

  return { html: withIds, items };
}

/**
 * h2 를 기준으로 본문을 자른다.
 * 첫 h2 단락이 끝나는 자리에 CTA 버튼을 한 번 더 넣기 위한 분할이다.
 */
function splitByHeading(html: string): string[] {
  const parts = html.split(/(?=<h2[\s>])/i).filter((p) => p.trim().length > 0);
  return parts.length > 0 ? parts : [html];
}

function CtaButton({ text, url }: { text: string; url: string }) {
  // 내부 경로(/지역 등)에는 nofollow 를 붙이지 않는다. 붙이면 사이트 안에서
  // 링크 가치가 흐르지 않는다. 바깥으로 나가는 링크에만 붙인다.
  const isExternal = /^https?:\/\//i.test(url);

  return (
    <div className="cta-block">
      <a
        className="cta-btn"
        href={url}
        target="_self"
        rel={isExternal ? "nofollow noopener noreferrer" : undefined}
      >
        {text}
      </a>
    </div>
  );
}

export default async function ArticleView({ content }: { content: Content }) {
  await increaseContentView(content.id);

  const category = findCategory(content.category);
  const related = await listRelated(content, 6);
  const body = renderPostContent(content.content);
  const { html, items: toc } =
    body.kind === "html" ? buildToc(body.html) : { html: "", items: [] };

  const hasCta = Boolean(content.cta_text && content.cta_url);
  const faq = Array.isArray(content.faq) ? content.faq : [];

  // 제목 아래 소개글. 요약이 없으면 본문 앞부분을 150자로 잘라 쓴다.
  const lead =
    content.excerpt?.trim() ||
    `${htmlToPlainText(content.content).slice(0, 150)}…`;

  const description = content.excerpt?.trim() || lead;

  // 첫 h2 단락이 끝나는 자리에 CTA 를 한 번 더 넣는다
  const chunks = body.kind === "html" ? splitByHeading(html) : [];
  const h2Indexes = chunks
    .map((c, i) => (/^<h2[\s>]/i.test(c.trim()) ? i : -1))
    .filter((i) => i >= 0);
  const firstH2 = h2Indexes[0] ?? -1;
  const secondH2 = h2Indexes[1] ?? -1;

  // 목차에는 본문 h2/h3 뒤에 '자주 묻는 질문'도 함께 넣는다
  const tocItems =
    faq.length > 0
      ? [...toc, { id: "toc-faq", text: "자주 묻는 질문", depth: 2 }]
      : toc;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: content.title,
    description,
    articleSection: category?.name,
    keywords: content.tags.join(", "),
    url: absoluteUrl(`/${content.slug}`),
    datePublished: content.created_at,
    image: content.thumbnail ? [content.thumbnail] : undefined,
    author: { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name },
  };

  const crumbs = breadcrumbJsonLd([
    { name: "홈", path: "/" },
    { name: category?.name ?? "가이드", path: `/${content.category}` },
    { name: content.title, path: `/${content.slug}` },
  ]);

  return (
    <div className="single-wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      {faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              faqJsonLd(faq.map((f) => ({ question: f.q, answer: f.a }))),
            ),
          }}
        />
      )}

      <article className="single-article">
        <div className="single-article__inner">
          <header className="entry-header">
            <h1 className="entry-title">{content.title}</h1>
            <div className="entry-header__bottom">
              <div className="entry-meta">
                <span>{SITE.name}</span>
                <span className="entry-meta__sep" />
                <time dateTime={content.created_at}>
                  {formatDate(content.created_at)}
                </time>
              </div>
              {category && (
                <a
                  target="_self"
                  href={`/${category.slug}`}
                  className={`entry-cat cat-badge cat-badge--${category.key}`}
                >
                  {category.name}
                </a>
              )}
            </div>
          </header>

          <div className="entry-content">
            {/* 광고 → 소개글 → CTA → 광고 → 목차 → 본문 → FAQ */}
            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.top} />
            </div>

            <p className="entry-lead">{lead}</p>

            {hasCta && (
              <CtaButton text={content.cta_text!} url={content.cta_url!} />
            )}

            <div className="ad-slot">
              <Adsense slotId={AD_SLOTS.middle} />
            </div>

            {tocItems.length >= 2 && (
              <nav className="toc" aria-label="목차">
                <p className="toc__title">📑 목차</p>
                <ol className="toc__list">
                  {tocItems.map((item) => (
                    <li key={item.id} data-depth={item.depth}>
                      <a href={`#${item.id}`}>{item.text}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            {body.kind === "html" ? (
              chunks.map((chunk, index) => {
                // 두 번째 h2 는 제목과 본문 사이에 광고가 들어간다
                const split =
                  index === secondH2
                    ? chunk.match(/^(<h2[\s\S]*?<\/h2>)([\s\S]*)$/i)
                    : null;

                return (
                  <div key={index}>
                    {split ? (
                      <>
                        <div dangerouslySetInnerHTML={{ __html: split[1] }} />
                        <div className="ad-slot">
                          <Adsense slotId={AD_SLOTS.bottom} />
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: split[2] }} />
                      </>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: chunk }} />
                    )}

                    {hasCta && index === firstH2 && (
                      <CtaButton
                        text={content.cta_text!}
                        url={content.cta_url!}
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <>
                {body.lines.map((line, index) => (
                  <p key={index}>{line || " "}</p>
                ))}
              </>
            )}

            {faq.length > 0 && (
              <section className="faq">
                <h2 className="faq__title" id="toc-faq">
                  자주 묻는 질문
                </h2>
                {faq.map((item, index) => (
                  <div className="faq__item" key={index}>
                    <h3 className="faq__q">{item.q}</h3>
                    <div className="faq__a">
                      <p>{item.a}</p>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </div>

          {content.tags.length > 0 && (
            <div className="entry-tags">
              {content.tags.map((tag) => (
                <a
                  target="_self"
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                >
                  #{tag}
                </a>
              ))}
            </div>
          )}

          {related.length > 0 && (
            <section className="related">
              <h2 className="related__title">함께 보면 좋은 글</h2>
              <div className="related__grid">
                {related.map((item) => (
                  <a
                    target="_self"
                    key={item.id}
                    href={`/${item.slug}`}
                    className="related__item"
                  >
                    <div className="related__thumb">
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden>
                          {findCategory(item.category)?.emoji ?? "📄"}
                        </span>
                      )}
                    </div>
                    <p className="related__name">{item.title}</p>
                  </a>
                ))}
              </div>
            </section>
          )}

          <footer className="entry-footer">
            <span>
              카테고리:{" "}
              <a target="_self" href={`/${content.category}`}>
                {category?.name}
              </a>
            </span>
            <span>등록일 {formatDate(content.created_at)}</span>
          </footer>
        </div>
      </article>
    </div>
  );
}
