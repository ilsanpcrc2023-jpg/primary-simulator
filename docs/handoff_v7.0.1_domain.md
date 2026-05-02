# v7.0.1 인계장 — 공식 도메인 `primarysimulator.kr` 정식 연결

**완료일**: 2026-05-02
**선행**: v7.0 (정치 리스크 차단 + 의원 모드 단순화 + 포괄관리 지표 C 도입 + 모드 토글 재배치, merge `04bf6d8`)
**브랜치**: `main` 직접 (사용자 명시 승인 — "main 브랜치에 푸시")
**입력 자료**: 사용자 세션 지시 (2026-05-02) — Vercel에 `primarysimulator.kr` 정식 연결 완료 후 도메인 통일 4개 작업

---

## 0. 한 줄 요약

`primarysimulator.kr`이 Vercel 정식 도메인으로 연결됨에 따라, 사용자 노출용 URL을 신 도메인으로 통일. **index.html 메타 태그 4건**(canonical 신규 · og:url · og:image · twitter:image), **public/og-image.svg 푸터 텍스트**(SNS 링크 미리보기 카드에 박혀 노출), **README.md 도메인 안내**를 신 도메인으로 교체. 개발자 문서(CLAUDE.md/docs/handoff_*.md)와 내부 식별자(vercel.json/api/package.json — GitHub repo·npm 패키지명)는 그대로 보존.

---

## 1. 변경 배경

> "primarysimulator.kr 도메인이 Vercel에 정식 연결되었습니다. 공식 도메인을 primarysimulator.kr로 통일하는 작업을 부탁합니다."

핵심 결정:
- **공식 도메인 = `https://primarysimulator.kr`** (vercel.app은 백업/개발 URL로 격하)
- 사용자 노출용 URL만 교체. 빌드 설정·내부 식별자는 보존.
- 검색 엔진 SEO 정합성을 위해 `<link rel="canonical">` 신설 (기존에 누락).

---

## 2. 변경 파일 (3개)

### 2.1 `index.html` — `<head>` 메타 태그 정리

| 항목 | 이전 | 신규 |
|---|---|---|
| `<link rel="canonical">` | (없음) | `https://primarysimulator.kr` (신설) |
| `<meta property="og:url">` | `https://primary-simulator.vercel.app/` | `https://primarysimulator.kr` |
| `<meta property="og:image">` | `https://primary-simulator.vercel.app/og-image.png` | `https://primarysimulator.kr/og-image.png` |
| `<meta name="twitter:image">` | `https://primary-simulator.vercel.app/og-image.png` | `https://primarysimulator.kr/og-image.png` |

- og:title / og:description / og:type / twitter:card는 이미 존재하므로 추가하지 않음 (사용자 지시 "없으면 함께 추가" 조건부).
- 검증: dev 서버(port 5173)에서 `fetch('/index.html')`로 본문 확인 → canonical/og:url/og:image/twitter:image 4건 정상 삽입, `primary-simulator.vercel.app` 잔여 0건.

### 2.2 `public/og-image.svg` — 푸터 텍스트 동기화

```diff
-  <text ...>primary-simulator.vercel.app</text>
+  <text ...>primarysimulator.kr</text>
```

- og-image는 SNS·KakaoTalk·Slack 등 링크 공유 시 미리보기 카드에 노출되므로 사용자 노출 표면.
- ⚠️ **og-image.png 빌드 필요**: 현 저장소는 SVG 원본만 있고 og-image.png 산출물의 빌드 파이프라인이 명시 안 됨. SVG → PNG 변환은 별도 도구(예: rsvg-convert, sharp, Inkscape) 필요. 현재 PNG가 vercel.app 텍스트 기준이면 다음 세션에서 PNG 갱신 작업 권장.

### 2.3 `README.md` — 공식 도메인 안내 2줄 추가

```markdown
국민건강보험 일산병원 일차의료개발센터

- **공식 도메인**: https://primarysimulator.kr
- 백업/개발 URL: https://primary-simulator.vercel.app
```

- README는 의도적으로 미니멀하게 유지 (기존 22줄 → 24줄).

---

## 3. 의도적으로 손대지 않은 곳 (사용자 지시 — "내부 URL은 건드리지 말 것")

| 파일 | 사유 |
|---|---|
| `vercel.json` | 빌드 설정 (사용자 지시 명시) |
| `api/commit-baseline.js` | `shleefm/primary-simulator`는 GitHub Contents API용 repo 식별자 (URL 아님) |
| `package.json` / `package-lock.json` | npm 패키지명 (URL 아님) |
| `CLAUDE.md` | 개발자 instruction 파일 — `## 배포 워크플로` 섹션의 production URL은 v7.0.1 명시로 함께 갱신 (예외) |
| `docs/handoff_v6.md` 등 과거 인계장 | 버전 시점 historical 기록 보존 (시간 기점 회귀 방지) |
| `docs/handoff_excel_template.md` | 분석가용 외부 작업 가이드 — 기존 URL 표기 유지(다음 세션 별도 검토 후보) |

---

## 4. 커밋 흐름

| Hash | 주제 |
|---|---|
| `d1ab7dc` | feat: 공식 도메인 primarysimulator.kr 적용 (README/index.html/og-image.svg) |
| (이번) | docs(v7.0.1): 인계장 작성 + CLAUDE.md 배포 URL 갱신 + 버전 태그 이력 v7.0.1 추가 |

main 직접 푸시 (사용자 명시 승인) → Vercel 자동 재배포 → https://primarysimulator.kr/ 반영 확인됨.

---

## 5. 알려진 제한 / 다음 세션 후보

1. **og-image.png 갱신**: SVG 원본은 신 도메인으로 갱신했으나, 배포물 og-image.png가 SVG에서 자동 빌드되지 않으면 SNS 미리보기에 옛 vercel.app 푸터가 그대로 노출됨. 다음 세션에서 PNG 빌드 파이프라인 점검 또는 수동 갱신 필요.
2. **`docs/handoff_excel_template.md` URL**: 분석가용 외부 가이드. 차기 분석가 배포 시 신 도메인으로 정비 권장.
3. **사이트맵·robots.txt·검색 콘솔 등록**: SEO 측면에서 canonical 설정만으로는 검색엔진 색인 전환이 즉시 일어나지 않음. Google Search Console에서 도메인 변경 신청 또는 sitemap.xml 작성 검토.
4. **vercel.json `redirects`**: vercel.app 서브도메인 접속 시 신 도메인으로 301 리다이렉트 설정 검토 (Vercel 대시보드 또는 vercel.json `redirects` 블록).
5. **태그 부여 여부**: v7.0.1을 git tag로 부여할지는 운영 정책 사안 (v7.x 패치 시리즈 관리 방식). 이번 세션은 main 푸시까지만 완료.

---

## 6. 메모리 갱신

- `MEMORY.md` 인덱스: v7.0 항목 후행 한 줄에 "공식 도메인 primarysimulator.kr 정식 연결 (v7.0.1, 2026-05-02)" 추가 검토.
- `project_v6_state.md`: production URL을 vercel.app → primarysimulator.kr로 갱신, v7.0.1 후속 작업 메모 추가.
