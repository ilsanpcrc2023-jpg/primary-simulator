# v7.0.3 인계장 — "성과 배분" → "성과 공유" UI 라벨 일괄 치환

**완료일**: 2026-05-03
**선행**: v7.0.2 (모바일 탭 라벨 short: `💰 SS` → `💰 성과배분`, commit `93536d7`)
**브랜치**: `feature/v7.0.3-rename-share-distribution` → `main` `--no-ff` 머지
**입력 자료**: 사용자 세션 지시 (2026-05-03) — Shared Saving 탭 amber 배너 스크린샷과 함께 "성과 배분 → 성과 공유"

---

## 0. 한 줄 요약

SS(Shared Saving) 한국어 명칭을 "성과 **배분**" → "성과 **공유**"로 일괄 치환. 탭 라벨(full·short)·TabSharedSaving 안내 배너·박스 헤더("성과 공유 비율"·"성과 공유 구성")·파이 차트 헤더·슬라이더 aria-label까지 사용자 노출 텍스트 전체를 정비. 코드 주석도 정합 차원에서 함께 치환. 영문 식별자(SS, ssClinicShare, sharedSaving 등)는 모두 보존하여 정책 표준 용어 "Shared Saving"의 학술/문서적 일관성은 유지. 단위 테스트 65/65 통과.

---

## 1. 변경 배경

> 사용자: "성과 배분 → 성과 공유"

스크린샷에서 가리킨 amber 배너:
> ⚠️ **성과 배분(Shared Saving)**은 일차의료 강화 후 입원·응급·요양병원 의료비 변화에 따른 성과 배분 섹션으로 앞선 수가 시뮬레이션 및 Track 선택에는 미반영 상태입니다.

핵심 결정:
- **"배분"의 일방향·하향 분배 뉘앙스** → **"공유"의 상호적·수평적 관계** 프레이밍으로 정비
- v6.9.1에서 "절감 → 변화·성과·체계 지원" 프레임 치환과 같은 결의 정책 메시지 톤 정비 (의료계 수용성)
- 영문 식별자(SS, sharedSaving, clinicShare 등)는 정책 표준 용어 "Shared Saving"의 학술 일관성 유지를 위해 보존

---

## 2. 변경 파일 (4개)

### 2.1 `src/App.jsx` — 탭 라벨

| 항목 | 이전 | 신규 |
|---|---|---|
| TABS[2].full | `"💰 성과 배분 (Shared Saving)"` | `"💰 성과 공유 (Shared Saving)"` |
| TABS[2].short | `"💰 성과배분"` | `"💰 성과공유"` |

### 2.2 `src/components/TabSharedSaving.jsx` — 사용자 노출 텍스트 전 치환 (replace_all)

치환된 표현 (일부):
- 안내 배너: "성과 배분(Shared Saving)은 ... 성과 배분 섹션" → "성과 공유(Shared Saving)은 ... 성과 공유 섹션"
- 박스 헤더: "성과 배분 비율" → "성과 공유 비율"
- 프리셋 버튼 라벨: "참여의원 성과 배분 100%" → "참여의원 성과 공유 100%"
- 슬라이더 aria-label: "성과 배분 비율 슬라이더" → "성과 공유 비율 슬라이더"
- 슬라이더 값 표기: "참여의원 성과 배분 {ssClinicShare}%" → "참여의원 성과 공유 {ssClinicShare}%"
- 막대 fill 라벨: "참여의원 성과 배분" → "참여의원 성과 공유"
- 파이 차트 헤더: "성과 배분" → "성과 공유"
- 파이 데이터 name: "참여의원 성과배분" → "참여의원 성과공유"
- 파이 범례 b: "참여의원 성과배분" → "참여의원 성과공유"
- 안내 박스 헤더: "💡 성과 배분 구성" → "💡 성과 공유 구성"
- 안내 박스 항목: "🟢 참여의원 성과배분" → "🟢 참여의원 성과공유"
- 안내 본문 끝: "환자군 관리 성과(...)에 대한 성과 배분." → "...성과 공유."
- 코드 주석(line 16): "현재 Track 기준 의원당 성과배분 (참고 시나리오)" → "...성과공유 (참고 시나리오)"

### 2.3 `src/constants.js` — 코드 주석

```diff
- // PT · 성과배분 Track 지급률 (A/B/C, %) — 편집 가능, 초기화 시 복귀
+ // PT · 성과공유 Track 지급률 (A/B/C, %) — 편집 가능, 초기화 시 복귀
```

### 2.4 `src/hooks/useSimulator.js` — 코드 주석

```diff
- // 성과배분 Track 지급률 (A/B/C, %) — 편집 가능
+ // 성과공유 Track 지급률 (A/B/C, %) — 편집 가능
```

---

## 3. 의도적으로 손대지 않은 곳

| 식별자 | 사유 |
|---|---|
| `state.ssClinicShare`, `state.ssPctA/B/C`, `state.ssCostBase` 등 | 영문 변수명 — 정책 표준 용어 "Shared Saving" 보존 |
| `SS.clinicFromItem`, `SS.nhisFromItem`, `SS.acuteSaving` 등 | 메모 derived 키 — 학술/문서 일관성 |
| 컴포넌트명 `TabSharedSaving` | 파일 식별자 |
| `tracks[].ssAmt` | useSimulator memo 키 |
| 테스트 fixture (`calculator.test.js`) | "Shared Saving" 정책 표준 용어로 사용됨 |
| `CLAUDE.md` 도메인 모델 섹션의 "Shared Saving" 설명 | 학술 정의 영역 (UI 노출 텍스트와 분리) |
| `docs/handoff_v6.9.1.md` 등 과거 인계장 | 시점 historical 기록 보존 |

---

## 4. 검증

### 4.1 단위 테스트
```
Test Files  2 passed (2)
Tests       65 passed (65)
```

### 4.2 preview 검증 (Vite dev server)
- accessibility tree snapshot으로 SS 탭 전 텍스트 확인:
  - 탭 버튼: `💰 성과 공유 (Shared Saving)` ✓
  - 배너: `성과 공유(Shared Saving)은 ... 성과 공유 섹션` ✓
  - 박스 헤더: `성과 공유 비율`, `성과 공유` (파이 헤더), `💡 성과 공유 구성` ✓
  - 슬라이더 aria-label: `성과 공유 비율 슬라이더` ✓
  - 잔여 "성과 배분" 0건 (Grep 확인)
- 콘솔 에러 0건

---

## 5. 커밋 흐름

| Hash | 주제 |
|---|---|
| `4f2c3fd` | feat: 성과 배분 → 성과 공유 UI 라벨 일괄 치환 (feature 브랜치) |
| (이번) | docs(v7.0.3): 인계장 신설 + CLAUDE.md 버전 이력 갱신 + main `--no-ff` 머지 + 태그 v7.0.3 |

---

## 6. 알려진 제한 / 다음 세션 후보

1. **Track 탭 잔존 문구 점검**: TabTrack.jsx에는 "성과 배분"/"성과배분" 잔여 0건 확인 (사전 grep). 단, 다른 컴포넌트 라벨에서 SS 관련 추가 표현이 누락되었을 수 있으니 정책 검토 시 동시 점검.
2. **CLAUDE.md 도메인 모델 섹션의 "Shared Saving" 설명**: 학술 정의 영역으로 이번에 손대지 않음. 향후 정책 문서 정비 시 한국어 명칭 통일 검토 시 후보.
3. **버전 footer**: App.jsx 푸터는 `v7.0` 그대로 유지 (v7.0.1·v7.0.2와 동일 운영 — 패치는 footer 미반영).
4. **메모리 갱신**: `MEMORY.md` `project_v6_state.md`에 v7.0.3 한 줄 추가 검토 (현재는 v7.0.1까지만 명시).

---

## 7. 메모리 갱신 권장

- `MEMORY.md` 인덱스 한 줄: "v7.0.3 성과 배분 → 성과 공유 UI 일괄 치환 (2026-05-03)"
- `project_v6_state.md`: production URL과 함께 v7.0.3 짧은 메모 추가
