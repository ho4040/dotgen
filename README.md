# dotgen

이미지를 픽셀아트로 변환하는 도구 (React + Vite + 강타입 TypeScript).
**서버 없이 브라우저에서만 동작한다** — 이미지 처리(팔레트 생성·리사이즈·양자화)도,
분석한 팔레트 저장(브라우저 로컬 IndexedDB)도 전부 클라이언트에서 일어난다.
업로드한 이미지는 외부로 전송되지 않는다.

🔗 데모: https://ho4040.github.io/dotgen/

## 파이프라인

1. **업로드** — 이미지를 `ImageData`(RGBA)로 디코딩한다. (`src/lib/imageIO.ts`)
2. **팔레트 생성** — Oklab 색공간에서 k-means++ 클러스터링으로 지정한 색상 수만큼의
   팔레트를 만든다. 결정적 시드라 같은 입력은 같은 팔레트를 낸다. (`src/lib/kmeans.ts`)
3. **리사이즈(색 섞임 없음)** — `src/lib/resample.ts`
   - `point`: 출력 픽셀마다 원본 픽셀 하나를 그대로 복사. 샘플 좌표는
     `(out + 0.5) * scale + offset` (원본 픽셀 단위). **소수점 `offset`** 으로
     샘플 그리드를 원본 셀 중앙에 정렬해 경계에서의 색 혼합을 피한다.
   - `dominant`: 출력 픽셀의 원본 영역을 `N×N`으로 점 샘플링해 **최빈색**을 고른다(역시 혼합 없음).
4. **양자화** — 리사이즈 결과의 각 픽셀을 Oklab 거리 기준 가장 가까운 팔레트 색으로 매핑.
   리사이즈 → 양자화 순서라 **출력 픽셀은 항상 팔레트 색만** 사용한다. (`src/lib/quantize.ts`)
5. **투명 색상** — 팔레트에서 선택한 색 id는 알파 0으로 출력. 원본 알파가 임계값 미만인
   픽셀도 투명 처리.
6. **다운로드** — 결과를 PNG로 인코딩. nearest-neighbor 정수 배율 업스케일 지원. (`src/lib/imageIO.ts`)

무거운 단계(k-means·리사이즈·양자화)는 Web Worker(`src/lib/pipelineWorker.ts`)에서 실행한다.

## 구조

```
src/
  lib/            # 순수·강타입 이미지 처리 (DOM 외 의존성 없음에 가깝게)
    types.ts      # RGB/RGBA/Oklab/Palette/옵션 타입
    color.ts      # sRGB ↔ linear ↔ Oklab, 거리, 색 패킹
    kmeans.ts     # k-means++ 팔레트 생성
    resample.ts   # offset 기반 point / dominant 리사이즈
    quantize.ts   # 팔레트 양자화 + 투명 처리
    imageIO.ts    # 파일 디코드 / 캔버스 / PNG / 다운로드
    pipeline.ts   # resample → quantize 오케스트레이션
    pipelineWorker.ts # 위 파이프라인을 Web Worker에서 실행
    storageApi.ts # 팔레트 로컬 저장소 (IndexedDB)
  hooks/          # usePixelArt 외 기능별 훅(useMerge/useResample/...)
  components/     # CanvasView, ImageUploader, PaletteEditor, ResizeControls, DownloadBar, PaletteIO
  App.tsx
.github/workflows/deploy.yml  # main push 시 GitHub Pages 자동 배포
```

## 내부 팔레트 저장소 (브라우저 로컬)

분석 팔레트를 **IndexedDB**(`dotgen` DB)에 저장한다 — 메타데이터·색상·원본 PNG·썸네일 모두
브라우저 안에 들어간다. 팔레트 탭의 "내부 저장소" 섹션에서 저장/목록/불러오기(오버라이드)/삭제가
가능하다. 서버가 없으므로 **저장은 해당 브라우저·기기에 한정**되며 기기 간 공유는 되지 않는다.
공유가 필요하면 "분석 팔레트 저장(JSON)"으로 파일을 내보내 다른 곳에서 불러오면 된다.

## 개발

```bash
npm install
npm run dev      # vite 개발 서버
npm run build    # tsc -b (strict 타입체크) + vite build → dist/
npm run preview  # 빌드 결과 로컬 미리보기
npm run lint
```

`tsconfig.app.json`은 `strict` + `exactOptionalPropertyTypes` +
`noImplicitReturns` + `noImplicitOverride` + `noPropertyAccessFromIndexSignature` 등을
켜 두어 LSP가 최대한 많은 타입 정보를 제공하도록 했다.

## 배포 (GitHub Pages)

`main`에 push하면 `.github/workflows/deploy.yml`이 `npm run build` 후 `dist/`를 Pages에 게시한다.
저장소 이름이 `dotgen`이 아니면 `vite.config.ts`의 `base`를 `'/<repo-name>/'`로 맞춰야 한다.
(GitHub repo Settings → Pages → Source를 **GitHub Actions**로 설정해야 한다.)
