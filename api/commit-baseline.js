// v6.6: 공식 baseline 등록 — 관리자 버튼 클릭 시 호출되는 서버리스 엔드포인트.
// src/data/presets/official_baseline.json을 GitHub Contents API로 갱신 → Vercel 재배포.
// 필요 환경변수 (Vercel 대시보드 → Project Settings → Environment Variables):
//   GITHUB_PAT       (필수) GitHub Personal Access Token, repo contents:write 스코프
//   GITHUB_REPO      (선택) 기본 shleefm/primary-simulator
//   GITHUB_BRANCH    (선택) 기본 main
//   ADMIN_PWD        (선택) 미설정 시 인증 없음. 설정 시 요청 본문의 password와 일치해야 함

const DEFAULT_REPO = "shleefm/primary-simulator";
const DEFAULT_BRANCH = "main";
const FILE_PATH = "src/data/presets/official_baseline.json";

function validateBase(base) {
  if (!Array.isArray(base) || base.length !== 4) return "base는 4개 환자군 배열이어야 합니다.";
  for (let i = 0; i < 4; i++) {
    const b = base[i];
    if (!b || typeof b.N !== "number" || typeof b.M1 !== "number" || typeof b.L !== "number") {
      return `base[${i}]는 {N:number, M1:number, L:number} 형태여야 합니다.`;
    }
    if (b.N <= 0 || b.M1 < 0 || b.L < 0 || b.L > 1) {
      return `base[${i}] 값 범위 오류 (N>0, M1≥0, 0≤L≤1 필요).`;
    }
  }
  return null;
}

function validateP(P) {
  if (!Array.isArray(P) || P.length !== 4) return "P는 4개 환자군 기본수가 배열이어야 합니다.";
  for (let i = 0; i < 4; i++) {
    if (typeof P[i] !== "number" || P[i] < 0) return `P[${i}]는 0 이상 숫자여야 합니다.`;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 메서드만 허용됩니다." });
  }

  const token = process.env.GITHUB_PAT;
  if (!token) {
    return res.status(503).json({
      error: "서버에 GITHUB_PAT 환경변수가 설정되지 않았습니다.",
      hint: "Vercel 대시보드 → Project Settings → Environment Variables에서 GITHUB_PAT (repo contents:write 스코프) 설정 후 재배포하세요.",
    });
  }

  const adminPwd = process.env.ADMIN_PWD;
  const body = req.body || {};
  if (adminPwd && body.password !== adminPwd) {
    return res.status(401).json({ error: "관리자 비밀번호가 일치하지 않습니다." });
  }

  const { base, P, M_clinics, dataLabel } = body;
  const baseErr = validateBase(base);
  if (baseErr) return res.status(400).json({ error: baseErr });
  const pErr = validateP(P);
  if (pErr) return res.status(400).json({ error: pErr });
  // v6.9.4: M_clinics·dataLabel은 선택 입력. 들어오면 검증 후 저장, 누락이면 기본값 사용.
  const safeMClinics = (typeof M_clinics === "number" && M_clinics > 0) ? Math.round(M_clinics) : 10;
  const sumN = base.reduce((s, b) => s + b.N, 0);
  const safeLabel = (typeof dataLabel === "string" && dataLabel.trim().length > 0)
    ? dataLabel.trim().slice(0, 200)
    : `데이터 baseline (${safeMClinics}기관 · ${sumN.toLocaleString("en-US")}명)`;

  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;

  const payload = {
    version: "6.9.4",
    updated_at: new Date().toISOString().slice(0, 10),
    updated_by: "admin (simulator UI button)",
    note: "시뮬레이터 '공식 baseline으로 등록' 버튼을 통해 갱신된 파일. 편집 시 주의 — 시뮬레이터가 앱 시작 시 이 파일을 읽어 모든 사용자의 디폴트를 결정합니다.",
    M_clinics: safeMClinics,
    dataLabel: safeLabel,
    base,
    P,
  };
  const content = Buffer.from(JSON.stringify(payload, null, 2) + "\n", "utf-8").toString("base64");

  const apiBase = `https://api.github.com/repos/${repo}/contents/${FILE_PATH}`;
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "primary-simulator-baseline-committer",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // 1) 기존 파일 SHA 조회 (update 시 필수)
  let sha = null;
  try {
    const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders });
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData?.sha || null;
    } else if (getRes.status !== 404) {
      const txt = await getRes.text();
      return res.status(502).json({
        error: `기존 파일 조회 실패 (HTTP ${getRes.status})`,
        details: txt.slice(0, 400),
      });
    }
    // 404면 sha=null로 두고 새 파일 생성
  } catch (err) {
    return res.status(502).json({ error: "GitHub API 연결 실패 (GET): " + err.message });
  }

  // 2) PUT으로 파일 업로드/갱신
  const commitBody = {
    message: `chore(baseline): official baseline 갱신 ${payload.updated_at}`,
    content,
    branch,
    committer: {
      name: "Primary Simulator",
      email: "59140997+shleefm@users.noreply.github.com",
    },
  };
  if (sha) commitBody.sha = sha;

  try {
    const putRes = await fetch(apiBase, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(commitBody),
    });
    if (!putRes.ok) {
      const txt = await putRes.text();
      return res.status(502).json({
        error: `커밋 실패 (HTTP ${putRes.status})`,
        details: txt.slice(0, 600),
      });
    }
    const putData = await putRes.json();
    return res.status(200).json({
      success: true,
      message: "✅ 공식 baseline 갱신 완료. Vercel 재배포가 자동 시작됩니다 (1~2분).",
      commit_sha: putData?.commit?.sha || null,
      commit_url: putData?.commit?.html_url || null,
      content_url: putData?.content?.html_url || null,
      branch,
    });
  } catch (err) {
    return res.status(502).json({ error: "GitHub API 연결 실패 (PUT): " + err.message });
  }
}
