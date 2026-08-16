import { GRADE_LABEL, type Grade } from "@/lib/region-data";

/**
 * 평가등급 뱃지.
 *
 * 평가는 급여종류별 3년 주기라 모든 기관에 등급이 있는 것은 아니다.
 * 등급이 없는 기관은 빈칸으로 두지 않고 "미평가"로 표시한다.
 */
export default function GradeBadge({ grade }: { grade: Grade | null }) {
  if (!grade) {
    return (
      <span className="grade-badge grade-badge--none" title="평가 이력 없음">
        —
      </span>
    );
  }
  return (
    <span
      className={`grade-badge grade-badge--${grade}`}
      title={`${grade}등급 (${GRADE_LABEL[grade]})`}
    >
      {grade}
    </span>
  );
}
