<div align="center">

<img src="public/favicon.svg" width="72" height="72" alt="Image to Excel 로고" />

# Image to Excel

**스캔·캡처 이미지에서 표를 찾고, 셀 단위로 읽어 `.xlsx`로 내보냅니다.**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-배포-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![Gemini](https://img.shields.io/badge/Gemini-table_extraction-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)

[기능](#-기능) · [워크플로](#-워크플로) · [빠른 시작](#-빠른-시작) · [환경 변수](#-환경-변수) · [배포](#-배포)

</div>

---

## 개요

`image-to-excel`은 **브라우저에서 표 영역을 검출**하고, **Gemini로 표 내용을 JSON 구조화**한 뒤 **검수·편집 후 Excel 파일로 다운로드**하는 단일 페이지 워크숍입니다.

| 구분 | 설명 |
| --- | --- |
| **표 검출** | [Microsoft Table Transformer](https://github.com/microsoft/table-transformer) (ONNX, 브라우저 로컬 실행) |
| **표 인식** | Google **Gemini** — 구조화 JSON (`rows[].cells[]`) |
| **API·인증** | Cloudflare Workers (`/api/*`), 세션 쿠키 + D1 사용자 계정 |
| **UI** | React 19, shadcn/ui (base-nova), Tailwind CSS 4, Motion |

> 표 검출 모델은 MIT 라이선스이며, Hugging Face 미러(`/hf` 프록시)로 모델을 받아옵니다. 상업적 이용 전 라이선스를 확인하세요.

---

## ✨ 기능

- **다중 이미지 큐** — 여러 파일을 올리고 파일별 진행 상태를 유지
- **표 검출 & BBox 편집** — 자동 박스 + 드래그·이름·영역(시트) 관리
- **Pan/Zoom 프리뷰** — 고해상도 원본에서 영역 확인
- **AI 표 추출** — 영역별 Gemini 호출, 셀 단위 미리보기·인라인 수정
- **Excel 내보내기** — `xlsx` 생성 및 다운로드
- **다크 모드** — 시스템 연동 + 수동 토글
- **접근성** — `prefers-reduced-motion` 존중

---

## 🔄 워크플로

```mermaid
flowchart LR
  A[이미지 업로드] --> B[표 검출]
  B --> C[영역 조정]
  C --> D[Gemini 추출]
  D --> E[검수·편집]
  E --> F[.xlsx 다운로드]
```

| 단계 | 화면 | 하는 일 |
| --- | --- | --- |
| **표 검출** | Detect | 모델 추론, BBox 확인·수정 |
| **엑셀 변환** | Convert | 영역 이미지로 셀 데이터 추출 |
| **검수 및 다운로드** | Review | 표 내용 확인 후 Excel 저장 |

---

## 🏗 아키텍처

```text
┌─────────────────────────────────────────────────────────┐
│  Browser (Vite SPA)                                     │
│  · Table Transformer (ONNX / transformers.js)           │
│  · Workshop UI · 프로젝트·이미지·표 데이터 (IndexedDB)  │
└───────────────────────────┬─────────────────────────────┘
                            │ /api/*  (dev: Vite proxy)
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker                                      │
│  · 로그인·세션(D1 users) · /api/gemini/* → Gemini       │
│  · /hf/* Hugging Face 프록시 · static assets (dist)     │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 빠른 시작

### 요구 사항

- **Node.js** 20+
- **npm** 10+
- [Google AI Studio](https://aistudio.google.com/apikey) **Gemini API 키**
- (배포 시) [Cloudflare](https://dash.cloudflare.com/) 계정 + `wrangler login`

### 설치 & 로컬 실행

```bash
git clone https://github.com/happy789515/image-to-excel.git
cd image-to-excel
npm install

cp .dev.vars.example .dev.vars
# .dev.vars 에 GEMINI_API_KEY, SESSION_SECRET 설정

# 로컬 D1 마이그레이션 후 로그인 계정 추가 (비밀번호는 stdin으로 입력)
npx wrangler d1 migrations apply DB --local
echo "your-password" | node scripts/manage-users.mjs add <username>

# 터미널 1 — API (8787, 로컬 D1 마이그레이션 자동 적용)
npm run dev:worker

# 터미널 2 — 프론트 (Vite, /api → worker 프록시)
npm run dev
```

브라우저에서 Vite가 안내하는 주소(보통 `http://localhost:5173`)로 접속한 뒤, 추가한 계정으로 로그인합니다.

첫 실행 시 **Table Transformer ONNX 모델** 다운로드로 부팅 화면이 잠시 표시될 수 있습니다.

### 자주 쓰는 스크립트

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 프론트엔드만 (HMR) |
| `npm run dev:worker` | 빌드 후 Wrangler 로컬 Worker + 정적 자산 |
| `npm run build` | 타입체크 + 프로덕션 번들 → `dist/` |
| `npm run lint` | ESLint |
| `npm run deploy` | 빌드 후 Cloudflare 배포 |
| `npm run verify:workers` | Workers 자산·dry-run 검증 |

---

## 🔐 환경 변수

로컬 Worker는 프로젝트 루트의 **`.dev.vars`** 를 사용합니다. `.dev.vars`는 git에 포함하지 마세요.

| 변수 | 필수 | 설명 |
| --- | ---: | --- |
| `GEMINI_API_KEY` | ✅ | Google Gemini API 키 |
| `SESSION_SECRET` | ✅ | 세션 쿠키 HMAC용 긴 랜덤 문자열 |
프로덕션에서는 Cloudflare 대시보드 또는 `wrangler secret put` 으로 동일 이름의 시크릿을 설정하세요.

헬스 체크: Worker 실행 후 `GET /api/health` → `auth.sessionSecret`, `auth.authDb` 설정 여부 확인.

기존 `AUTH_USERS` 계정을 D1로 옮기려면 `AUTH_USERS` 환경 변수를 설정한 뒤 `node scripts/manage-users.mjs seed [--remote]`를 한 번 실행하세요.

---

## ☁️ 배포

```bash
npm run deploy
```

`wrangler.jsonc` 가 `dist/` 를 SPA로 서빙하고, API 라우트는 Worker가 처리합니다. Worker는 `placement`(`gcp:asia-northeast3`, 서울)에 배치되고, Gemini 호출은 Durable Object `UsExit`(`apac-ne` 힌트)를 거쳐 나갑니다. 포크해서 배포할 때는 `d1_databases[].database_id`를 본인 D1 ID로 교체하세요. 배포 전에 Cloudflare 쪽에 `GEMINI_API_KEY`, `SESSION_SECRET` 시크릿을 넣고, `npx wrangler d1 migrations apply DB --remote` 로 마이그레이션을 적용한 뒤 `node scripts/manage-users.mjs add <username> --remote` 로 계정을 추가해야 합니다. 프로젝트 데이터는 서버에 저장되지 않으므로 R2 버킷은 필요하지 않습니다.

---

## 📁 프로젝트 구조

```text
image-to-excel/
├── src/              # React 앱 (워크숍, 검출, UI)
├── worker/           # Cloudflare Worker (auth, Gemini 프록시, HF 프록시)
├── public/           # favicon, web manifest
├── scripts/          # 배포 검증, 사용자 계정 관리
├── wrangler.jsonc
└── vite.config.ts    # dev 시 /api, /hf 프록시
```

---

## ⚠️ 주의

- 이미지 업로드는 **PNG / JPEG / WebP**, **15MB** 이하, 프로젝트당 **30장**까지 가능합니다.
- 프로젝트·이미지·표 데이터는 **이 브라우저의 IndexedDB**에만 저장됩니다. 기기나 브라우저를 바꾸면 보이지 않으며, 브라우저 데이터를 지우면 함께 삭제됩니다.
- Gemini 호출은 **로그인 세션**이 있어야 하며, API 키는 브라우저에 노출되지 않습니다.
- 표 검출은 기기 성능에 따라 초기 로딩·추론 시간이 길어질 수 있습니다.

---

## 🤝 기여

이슈·PR 환영합니다. 변경 전 `npm run lint` 와 `npm run build` 가 통과하는지 확인해 주세요.

---

<div align="center">

**이미지 한 장으로 표 복사·붙여넣기 대신, 구조화된 스프레드시트를.**

</div>