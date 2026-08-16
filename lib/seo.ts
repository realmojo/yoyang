import type { Metadata } from "next";

/** 사이트 전역 SEO 설정 */
export const SITE = {
  name: "요양정보",
  nameEn: "Yoyang",
  url: "https://yoyang.keywordegg.com",
  locale: "ko_KR",
  /** app/opengraph-image.tsx 가 생성하는 1200x630 대표 이미지 */
  ogImage: "/opengraph-image",
  description:
    "전국 시군구별 장기요양기관 평가 결과와 장기요양등급·비용 정보를 공개 데이터로 정리해 전합니다.",
} as const;

export function absoluteUrl(path: string): string {
  if (!path || path === "/") return SITE.url;
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  // 한글 슬러그를 쓰므로 canonical·사이트맵에는 퍼센트 인코딩된 형태를 넣는다.
  // 인코딩하지 않으면 검색엔진이 넘긴 URL 과 문자열이 달라 중복으로 볼 수 있다.
  return `${SITE.url}${withSlash.split("/").map(encodeURIComponent).join("/")}`;
}

export interface BuildMetadataInput {
  /** 사이트 루트 기준 경로. 예: "/서울-강남구" */
  path: string;
  /** <title> 전문 */
  title: string;
  description: string;
  keywords?: string[];
  /** 미지정 시 title/description 을 그대로 사용 */
  ogTitle?: string;
  ogDescription?: string;
  type?: "website" | "article";
  /** 페이지별 소셜 공유 이미지. 미지정 시 사이트 기본 OG 이미지 */
  image?: string;
}

/**
 * 모든 페이지가 공유하는 메타데이터를 생성한다.
 *
 * Next.js 는 하위 세그먼트가 openGraph 를 정의하면 상위 openGraph 를 병합하지
 * 않고 통째로 대체한다. 그래서 페이지마다 openGraph 를 직접 쓰면 siteName,
 * locale, images 가 조용히 사라진다. 이 헬퍼로 항상 완전한 세트를 채운다.
 */
export function buildMetadata({
  path,
  title,
  description,
  keywords,
  ogTitle,
  ogDescription,
  type = "website",
  image,
}: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const socialTitle = ogTitle ?? title;
  const socialDescription = ogDescription ?? description;
  const socialImage = image ?? SITE.ogImage;

  return {
    title,
    description,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      title: socialTitle,
      description: socialDescription,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      type,
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: `${SITE.name} - ${socialTitle}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      images: [socialImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

/** 이동 경로 JSON-LD (schema.org BreadcrumbList) */
export function breadcrumbJsonLd(trail: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** 자주 묻는 질문 JSON-LD (schema.org FAQPage) */
export function faqJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "ko-KR",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/**
 * 지역 페이지용 데이터셋 JSON-LD.
 *
 * 지역 페이지는 글이 아니라 공개 데이터를 집계해 보여주는 화면이므로
 * Article 이 아니라 Dataset 으로 표기한다. 출처(공공데이터포털)를 함께 남긴다.
 */
export function regionDatasetJsonLd({
  name,
  path,
  description,
  dateModified,
}: {
  name: string;
  path: string;
  description: string;
  dateModified?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url: absoluteUrl(path),
    inLanguage: "ko-KR",
    ...(dateModified ? { dateModified } : {}),
    creator: {
      "@type": "Organization",
      name: "국민건강보험공단",
    },
    isBasedOn:
      "https://www.data.go.kr/data/15104801/fileData.do",
    license: "https://www.kogl.or.kr/info/license.do",
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
  };
}
