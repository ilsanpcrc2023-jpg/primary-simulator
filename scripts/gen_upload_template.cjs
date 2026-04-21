// 시뮬레이터 업로드 템플릿 v2 — 단순 4열
// (환자군, N, M1, L) × 4행 + 합계 행
// v6.4 결정: 분석가는 외부 분석 엑셀로 도출한 N·M1·L 값만 본 템플릿에 채워 업로드.
//   B(환자군 기본수가)·F(일차의료 기능보정)는 시뮬레이터 정책 슬라이더로만 설정 (엑셀 비반영).
//   ref/cr/T/C 등 파생 컬럼은 본 템플릿에서 제외 — 라운드트립 일관성 + 입력 실수 가능성 최소화.
const XLSX = require('xlsx');
const path = require('path');

const rows = [
  // 파일럿 2023 데이터 기반 참조값 (N, M1, L)
  { g: '1군', N: 11956, M1: 62801, L: 0.7975 },
  { g: '2군', N: 13778, M1: 84083, L: 0.7934 },
  { g: '3군', N: 18089, M1: 138152, L: 0.7943 },
  { g: '4군', N: 25781, M1: 233560, L: 0.7722 },
];

const headers = ['환자군', 'N', 'M1', 'L'];

const ws = {};

headers.forEach((h, c) => {
  ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h };
});

rows.forEach((d, idx) => {
  const r = idx + 1;
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 's', v: d.g };
  ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', v: d.N };
  ws[XLSX.utils.encode_cell({ r, c: 2 })] = { t: 'n', v: d.M1 };
  ws[XLSX.utils.encode_cell({ r, c: 3 })] = { t: 'n', v: d.L };
});

// 합계/가중평균 행 (r=5)
{
  const r = 5;
  const er = r + 1;
  const sumN = rows.reduce((s, x) => s + x.N, 0);
  const wM1 = rows.reduce((s, x) => s + x.M1 * x.N, 0) / sumN;
  const wL = rows.reduce((s, x) => s + x.L * x.N, 0) / sumN;

  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 's', v: '합계/가중평균' };
  ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', f: 'SUM(B2:B5)', v: sumN };
  ws[XLSX.utils.encode_cell({ r, c: 2 })] = { t: 'n', f: `SUMPRODUCT(B2:B5,C2:C5)/B${er}`, v: wM1 };
  ws[XLSX.utils.encode_cell({ r, c: 3 })] = { t: 'n', f: `SUMPRODUCT(B2:B5,D2:D5)/B${er}`, v: wL };
}

ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 5, c: 3 } });
ws['!cols'] = [
  { wch: 14 },   // 환자군
  { wch: 12 },   // N
  { wch: 14 },   // M1 (1인당 의원외래비)
  { wch: 8 },    // L (타원이용비중, 0~1)
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '시뮬레이터_업로드');

const outPath = path.resolve(__dirname, '..', 'docs', 'NHIS_HCC_시뮬레이터_업로드_v2.xlsx');
XLSX.writeFile(wb, outPath);
console.log('생성 완료:', outPath);
