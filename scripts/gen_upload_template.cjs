// 시뮬레이터 업로드 + 연구보고서 테이블 겸용 엑셀 생성
// 단일 시트, 15열 (원자료 4 + 파생 4 + 산출 6 + 환자군 라벨 1), 합계 행 포함
const XLSX = require('xlsx');
const path = require('path');

const rows = [
  // 환자군, N, T, C, M (원자료)
  { g: '1군', N: 11956, T: 5289464220, C: 3708639860, M: 750846470, F: 10000 },
  { g: '2군', N: 13778, T: 8558157720, C: 5602773370, M: 1158490130, F: 20000 },
  { g: '3군', N: 18089, T: 20627094420, C: 12146547670, M: 2499026390, F: 30000 },
  { g: '4군', N: 25781, T: 88338108030, C: 26403984090, M: 6021419440, F: 40000 },
];

const headers = [
  '환자군', 'N', 'T', 'C', 'M',
  'HCC 평균', '의원비중', 'L', 'M1',
  'B', 'F', 'P', '공단지급', '본인부담', '1인당 의원수입'
];

const ws = {};
const wsRows = [];

// Row 1 (index 0): headers
headers.forEach((h, c) => {
  ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h };
});

// Rows 2-5: data (r = 1..4, excel row = 2..5)
rows.forEach((d, idx) => {
  const r = idx + 1;
  const excelR = r + 1; // 1-based
  const rA = (col) => `${col}${excelR}`;

  const hcc = d.T / d.N;
  const cr = d.C / d.T;
  const L = (d.C - d.M) / d.C;
  const M1 = d.M / d.N;
  const B = Math.round(hcc * cr);
  const P = B + d.F;
  const gongdan = Math.round(B * (1 - L) + d.F);
  const bonin = Math.round(M1 * 0.3);
  const income = gongdan + bonin;

  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 's', v: d.g };
  ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', v: d.N };
  ws[XLSX.utils.encode_cell({ r, c: 2 })] = { t: 'n', v: d.T };
  ws[XLSX.utils.encode_cell({ r, c: 3 })] = { t: 'n', v: d.C };
  ws[XLSX.utils.encode_cell({ r, c: 4 })] = { t: 'n', v: d.M };
  // 파생 (수식 + 캐시값)
  ws[XLSX.utils.encode_cell({ r, c: 5 })] = { t: 'n', f: `${rA('C')}/${rA('B')}`, v: hcc };
  ws[XLSX.utils.encode_cell({ r, c: 6 })] = { t: 'n', f: `${rA('D')}/${rA('C')}`, v: cr };
  ws[XLSX.utils.encode_cell({ r, c: 7 })] = { t: 'n', f: `(${rA('D')}-${rA('E')})/${rA('D')}`, v: L };
  ws[XLSX.utils.encode_cell({ r, c: 8 })] = { t: 'n', f: `${rA('E')}/${rA('B')}`, v: M1 };
  // 산출
  ws[XLSX.utils.encode_cell({ r, c: 9 })] = { t: 'n', f: `ROUND(${rA('F')}*${rA('G')},0)`, v: B };
  ws[XLSX.utils.encode_cell({ r, c: 10 })] = { t: 'n', v: d.F };
  ws[XLSX.utils.encode_cell({ r, c: 11 })] = { t: 'n', f: `${rA('J')}+${rA('K')}`, v: P };
  ws[XLSX.utils.encode_cell({ r, c: 12 })] = { t: 'n', f: `ROUND(${rA('J')}*(1-${rA('H')})+${rA('K')},0)`, v: gongdan };
  ws[XLSX.utils.encode_cell({ r, c: 13 })] = { t: 'n', f: `ROUND(${rA('I')}*0.3,0)`, v: bonin };
  ws[XLSX.utils.encode_cell({ r, c: 14 })] = { t: 'n', f: `${rA('M')}+${rA('N')}`, v: income };
});

// Row 6 (index 5): 합계/가중평균
{
  const r = 5;
  const excelR = 6;
  const range = `2:5`;
  const sumN = rows.reduce((s, x) => s + x.N, 0);
  const sumT = rows.reduce((s, x) => s + x.T, 0);
  const sumC = rows.reduce((s, x) => s + x.C, 0);
  const sumM = rows.reduce((s, x) => s + x.M, 0);
  const wHcc = sumT / sumN;
  const wCr = sumC / sumT;
  const wL = (sumC - sumM) / sumC;
  const wM1 = sumM / sumN;
  const wB = Math.round(wHcc * wCr);
  const sumWF = rows.reduce((s, x) => s + x.N * x.F, 0);
  const wF = Math.round(sumWF / sumN);
  const wP = wB + wF;
  const wGongdan = Math.round(wB * (1 - wL) + wF);
  const wBonin = Math.round(wM1 * 0.3);
  const wIncome = wGongdan + wBonin;

  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 's', v: '합계' };
  ws[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', f: `SUM(B2:B5)`, v: sumN };
  ws[XLSX.utils.encode_cell({ r, c: 2 })] = { t: 'n', f: `SUM(C2:C5)`, v: sumT };
  ws[XLSX.utils.encode_cell({ r, c: 3 })] = { t: 'n', f: `SUM(D2:D5)`, v: sumC };
  ws[XLSX.utils.encode_cell({ r, c: 4 })] = { t: 'n', f: `SUM(E2:E5)`, v: sumM };
  ws[XLSX.utils.encode_cell({ r, c: 5 })] = { t: 'n', f: `C${excelR}/B${excelR}`, v: wHcc };
  ws[XLSX.utils.encode_cell({ r, c: 6 })] = { t: 'n', f: `D${excelR}/C${excelR}`, v: wCr };
  ws[XLSX.utils.encode_cell({ r, c: 7 })] = { t: 'n', f: `(D${excelR}-E${excelR})/D${excelR}`, v: wL };
  ws[XLSX.utils.encode_cell({ r, c: 8 })] = { t: 'n', f: `E${excelR}/B${excelR}`, v: wM1 };
  ws[XLSX.utils.encode_cell({ r, c: 9 })] = { t: 'n', f: `ROUND(F${excelR}*G${excelR},0)`, v: wB };
  ws[XLSX.utils.encode_cell({ r, c: 10 })] = { t: 'n', f: `ROUND(SUMPRODUCT(B2:B5,K2:K5)/B${excelR},0)`, v: wF };
  ws[XLSX.utils.encode_cell({ r, c: 11 })] = { t: 'n', f: `J${excelR}+K${excelR}`, v: wP };
  ws[XLSX.utils.encode_cell({ r, c: 12 })] = { t: 'n', f: `ROUND(J${excelR}*(1-H${excelR})+K${excelR},0)`, v: wGongdan };
  ws[XLSX.utils.encode_cell({ r, c: 13 })] = { t: 'n', f: `ROUND(I${excelR}*0.3,0)`, v: wBonin };
  ws[XLSX.utils.encode_cell({ r, c: 14 })] = { t: 'n', f: `M${excelR}+N${excelR}`, v: wIncome };
}

ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 5, c: 14 } });
ws['!cols'] = [
  { wch: 8 },    // 환자군
  { wch: 10 },   // N
  { wch: 16 },   // T
  { wch: 16 },   // C
  { wch: 14 },   // M
  { wch: 12 },   // HCC 평균
  { wch: 10 },   // 의원비중
  { wch: 8 },    // L
  { wch: 10 },   // M1
  { wch: 12 },   // B
  { wch: 8 },    // F
  { wch: 12 },   // P
  { wch: 12 },   // 공단지급
  { wch: 10 },   // 본인부담
  { wch: 16 },   // 1인당 의원수입
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '시뮬레이터_업로드');

const outPath = path.resolve(__dirname, '..', 'docs', 'NHIS_HCC_시뮬레이터_업로드_v1.xlsx');
XLSX.writeFile(wb, outPath);
console.log('생성 완료:', outPath);
