/**
 * 가이드 글 본문 HTML 처리.
 *
 * 본문은 yoyang_contents 테이블에 HTML 로 직접 넣는다. DB 에 넣는 사람이
 * 우리라도 출력 시점에 허용목록으로 정화한다 — 붙여넣기로 섞여 들어온
 * script/iframe/onclick 이 그대로 렌더링되는 사고를 막기 위해서다.
 *
 * 태그 없이 평문만 넣은 글은 줄바꿈을 살린 텍스트로 보여준다.
 */

import sanitizeHtml from "sanitize-html";

/** 본문에 허용하는 태그. script/style/iframe/form 계열은 전부 제거된다. */
const ALLOWED_TAGS = [
  "p", "br", "hr", "div", "span",
  "h2", "h3", "h4", "h5",
  "b", "strong", "i", "em", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
  "blockquote", "pre", "code",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "a", "img", "figure", "figcaption",
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    // target/rel 은 transformTags 에서 채워 넣는다. 허용목록에 없으면 다시
    // 지워지므로 여기에도 반드시 적어둬야 한다.
    // style 은 아래 allowedStyles 로 값까지 검증된다(본문 안 버튼용)
    a: ["href", "title", "target", "rel", "style"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    // 표 레이아웃에 필요한 속성만 남긴다
    table: ["style"],
    col: ["width", "span", "style"],
    colgroup: ["span"],
    td: ["colspan", "rowspan", "style"],
    th: ["colspan", "rowspan", "scope", "style"],
    p: ["style"],
    div: ["style"],
    span: ["style"],
    li: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
    h5: ["style"],
  },
  // javascript:, vbscript:, data: 링크 차단
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  // style 속성은 값까지 검사해서 안전한 속성만 통과시킨다
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/],
      "font-style": [/^(normal|italic)$/],
      "text-decoration": [/^(none|underline|line-through)$/],
      color: [/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
      "background-color": [
        /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i,
        /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/,
      ],
      "font-size": [/^\d{1,2}(\.\d+)?(px|pt|em|rem|%)$/],
      width: [/^\d{1,3}(\.\d+)?(px|%|em|rem)$/],
      // 본문 안 버튼용. url()·expression() 이 들어갈 수 없는 형태만 허용한다.
      display: [/^(block|inline-block)$/],
      padding: [/^\d{1,3}(px|em|rem)( \d{1,3}(px|em|rem)){0,3}$/],
      margin: [/^\d{1,3}(px|em|rem)( \d{1,3}(px|em|rem)){0,3}$/, /^\d{1,3}(px|em|rem) (0|auto)$/],
      "border-radius": [/^\d{1,2}(px|em|rem|%)$/],
      "line-height": [/^\d(\.\d+)?$/, /^\d{1,3}(px|em|rem|%)$/],
    },
  },
  transformTags: {
    // 본문 링크는 같은 탭으로 이동시킨다.
    // 새 탭(_blank)으로 열면 현재 페이지가 그대로 남아 페이지 전환이 일어나지
    // 않고, 그러면 애드센스 전면광고(vignette)가 끼어들 자리가 없다.
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: "_self",
        rel: "noopener",
      },
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: "lazy" },
    }),
  },
  // 허용되지 않은 태그는 태그만 지우고 안쪽 글자는 남긴다.
  // 단 script/style/textarea/option 은 내용까지 통째로 버린다(sanitize-html 기본값).
  disallowedTagsMode: "discard",
};

/** 태그처럼 보이는 문자열이 있는지. 있으면 HTML 본문으로 취급한다. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][a-z0-9]*(\s[^<>]*)?\/?>/i.test(value);
}

/** 허용목록 기준으로 본문 HTML 을 정화한다. */
export function sanitizePostHtml(value: string): string {
  return sanitizeHtml(value, OPTIONS);
}

/** HTML 특수문자를 안전한 글자로 바꾼다 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 평문을 HTML 로 바꾼다. 빈 줄로 나뉜 덩어리는 <p>, 한 줄 줄바꿈은 <br> 이 된다.
 * 태그를 쓰지 않고 그냥 글만 쓴 사람도 같은 형태로 저장되게 하기 위한 변환이다.
 */
export function plainTextToHtml(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

/**
 * 저장할 본문을 HTML 로 만든다.
 * 태그가 섞여 있으면 허용목록으로 정화하고, 태그 없이 쓴 평문은 <p>·<br> 로
 * 감싸서 언제나 HTML 형태로 저장한다.
 */
export function preparePostContent(value: string): string {
  return looksLikeHtml(value)
    ? sanitizePostHtml(value).trim()
    : plainTextToHtml(value);
}

/** 정화 후 실제로 보여줄 내용이 남았는지 (태그만 넣고 저장하는 것을 막는다) */
export function hasVisibleContent(value: string): boolean {
  if (!looksLikeHtml(value)) return value.trim().length > 0;
  const html = sanitizePostHtml(value);
  if (/<(img|hr|table)\b/i.test(html)) return true;
  return htmlToPlainText(html).length > 0;
}

/** 본문에서 글자만 뽑아낸다. 메타 설명·JSON-LD 용. */
export function htmlToPlainText(value: string): string {
  if (!looksLikeHtml(value)) return value.replace(/\s+/g, " ").trim();

  const spaced = value
    .replace(/<\/(p|div|li|dd|dt|h[2-6]|blockquote|tr|figcaption)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " ");

  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RenderedContent {
  /** "html" 이면 dangerouslySetInnerHTML, "text" 면 줄 단위로 그린다 */
  kind: "html" | "text";
  html: string;
  lines: string[];
}

/**
 * 화면에 그릴 형태로 본문을 변환한다.
 * 태그가 없는 예전 평문 글은 줄바꿈을 살린 텍스트로, 태그가 있으면 정화한
 * HTML 로 돌려준다.
 */
export function renderPostContent(value: string): RenderedContent {
  if (!looksLikeHtml(value)) {
    return { kind: "text", html: "", lines: value.split("\n") };
  }
  return { kind: "html", html: sanitizePostHtml(value), lines: [] };
}
