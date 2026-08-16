import {
  buildSitemapIndex,
  countFacilityUrls,
  facilityChunkCount,
  xmlResponse,
} from "@/lib/sitemap";

/**
 * 사이트맵 인덱스.
 *
 * 기관 페이지가 21,000개가 넘어 한 파일로는 제출이 되지 않는다.
 * 여기서는 목록만 가리키고 실제 URL 은 아래 파일들이 담는다.
 *
 * robots.txt 도 이 주소 하나만 알려주면 된다. 검색엔진이 인덱스를 따라
 * 나머지를 알아서 가져간다.
 */
export const revalidate = 3600;

export async function GET() {
  const total = await countFacilityUrls();
  const chunks = total > 0 ? facilityChunkCount(total) : 0;
  const now = new Date();

  const items = [
    { path: "/sitemap-pages.xml", lastModified: now },
    ...Array.from({ length: chunks }, (_, i) => ({
      path: `/sitemap-facilities/${i + 1}.xml`,
      lastModified: now,
    })),
  ];

  return xmlResponse(buildSitemapIndex(items));
}
