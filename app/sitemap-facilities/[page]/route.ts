import {
  buildUrlSet,
  countFacilityUrls,
  facilityChunkCount,
  listFacilityUrls,
  xmlResponse,
  type SitemapEntry,
} from "@/lib/sitemap";

/**
 * 기관 URL 을 5,000개씩 끊어 담는 사이트맵.
 *
 *   /sitemap-facilities/1.xml
 *   /sitemap-facilities/2.xml  ...
 *
 * 경로에 `.xml` 이 붙어 있어야 검색엔진이 순순히 받아들이므로 파일명 전체를
 * 동적 구간으로 받고 여기서 숫자만 떼어낸다.
 *
 * 중복 제거는 DB 함수(yoyang_facility_urls)가 맡는다. 행 단위로 자르면 같은
 * 기관이 두 파일에 걸쳐 들어가기 때문이다.
 */
export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page: raw } = await params;
  const page = Number(raw.replace(/\.xml$/i, ""));

  if (!Number.isInteger(page) || page < 1) {
    return new Response("Not found", { status: 404 });
  }

  // 없는 번호를 요청하면 빈 사이트맵 대신 404 를 준다
  const total = await countFacilityUrls();
  if (total === 0 || page > facilityChunkCount(total)) {
    return new Response("Not found", { status: 404 });
  }

  const rows = await listFacilityUrls(page);

  const entries: SitemapEntry[] = rows.map((row) => ({
    path: `/${row.region_slug}/${row.slug}`,
    lastModified: row.last_modified,
    changeFrequency: "yearly",
    priority: 0.5,
  }));

  return xmlResponse(buildUrlSet(entries));
}
