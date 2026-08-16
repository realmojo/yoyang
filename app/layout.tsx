import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SITE, buildMetadata } from "@/lib/seo";
import { AD_CLIENT } from "@/lib/ads";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

const title = "요양정보 - 시군구별 장기요양기관 평가 결과";
const description =
  "전국 시군구별 장기요양기관 평가등급과 평가일자를 공개 데이터로 정리했습니다. 장기요양등급 신청, 비용 구조, 시설 선택 기준까지 함께 안내합니다.";

/**
 * 검색엔진 소유확인 코드와 분석 도구 ID.
 *
 * 서브도메인은 별도 속성이라 keywordegg 의 값을 그대로 쓸 수 없다.
 * 서치콘솔·네이버 서치어드바이저에 yoyang.keywordegg.com 을 등록한 뒤
 * 환경변수로 넣는다. 비어 있으면 해당 태그·스크립트를 아예 넣지 않는다.
 */
const GOOGLE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ?? "";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

export const metadata: Metadata = {
  ...buildMetadata({
    path: "/",
    title,
    description,
    keywords: [
      "요양원",
      "장기요양기관",
      "요양시설 평가등급",
      "장기요양등급",
      "요양원 비용",
      "재가급여",
      "노인장기요양보험",
      "요양원 찾기",
    ],
  }),
  metadataBase: new URL(SITE.url),
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "health",
  formatDetection: { telephone: false, email: false, address: false },
  verification: {
    ...(GOOGLE_VERIFICATION ? { google: GOOGLE_VERIFICATION } : {}),
    other: {
      "google-adsense-account": AD_CLIENT,
    },
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  name: SITE.name,
  alternateName: SITE.nameEn,
  url: SITE.url,
  inLanguage: "ko-KR",
  description,
  publisher: { "@id": `${SITE.url}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE.url}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE.url}/#organization`,
  name: SITE.name,
  alternateName: SITE.nameEn,
  url: SITE.url,
  description,
  logo: {
    "@type": "ImageObject",
    url: `${SITE.url}/opengraph-image`,
    width: 1200,
    height: 630,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script
          id="json-ld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          id="json-ld-organization"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd),
          }}
        />
      </head>
      <body>
        <SiteHeader />
        <main className="site-main">{children}</main>
        <SiteFooter />

        {/* 아래 스크립트들은 next/script 의 afterInteractive 로 돌린다.
            <head> 에 원시 <script> 로 두면 HTML 파싱 도중 실행되는데, 자동광고가
            하이드레이션보다 먼저 <ins> 를 본문에 꽂으면 서버 HTML 과 어긋나
            React #418(hydration mismatch) 이 간헐적으로 발생한다.
            afterInteractive 는 하이드레이션 이후에 실행되어 그 경합이 없다. */}
        <Script
          id="google-adsense"
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`}
        />

        {GA_ID && (
          <>
            <Script
              id="gtag-src"
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
