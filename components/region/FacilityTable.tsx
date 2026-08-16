import GradeBadge from "@/components/region/GradeBadge";
import {
  formatEvalDate,
  serviceTypeLabel,
  type Facility,
} from "@/lib/region-data";

/**
 * 기관 목록 표.
 *
 * 평가일자를 반드시 함께 보여준다. 정기평가가 급여종류별 3년 주기로 돌기 때문에
 * 등급만 보여주면 몇 년 전 결과를 현재 상태로 오인하게 된다.
 */
export default function FacilityTable({
  facilities,
  showScore = true,
}: {
  facilities: Facility[];
  showScore?: boolean;
}) {
  if (facilities.length === 0) {
    return <p className="panel__desc">해당하는 기관이 없습니다.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="fac-table">
        <thead>
          <tr>
            <th scope="col">기관명</th>
            <th scope="col">등급</th>
            {showScore && (
              <th scope="col" className="is-num">
                총점
              </th>
            )}
            <th scope="col" className="is-num">
              평가일자
            </th>
          </tr>
        </thead>
        <tbody>
          {facilities.map((f) => (
            <tr key={f.id}>
              <td>
                <span className="fac-table__name">{f.name}</span>
                <span className="fac-table__meta">
                  {[
                    // 일반구를 시로 합쳤으므로 원래 구 이름을 여기서 되살린다
                    f.sigungu_detail,
                    serviceTypeLabel(f.service_type),
                    f.founder,
                  ]
                    .filter(Boolean)
                    .join(" · ") ||
                    " "}
                </span>
              </td>
              <td>
                <GradeBadge grade={f.grade} />
              </td>
              {showScore && (
                <td className="is-num">
                  {f.total_score === null ? "-" : f.total_score.toFixed(1)}
                </td>
              )}
              <td className="is-num">{formatEvalDate(f.eval_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
