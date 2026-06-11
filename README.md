# 🌍 LinguaTrip (가칭)

도트 세계를 자유롭게 여행하며, 문명(Civilization)식 **연구 트리**로 외국어를 배우는 웹 게임.
첫 여행지는 일본 🇯🇵 — 기획 전체는 [PLAN.md](./PLAN.md) 참고.

## 핵심 루프

```
[월드] 자유 여행 → ??? 간판/대화 조우(학습 동기)
[연구] 연구 선택 → 문제 풀이로 RP 적립 → 연구 완료 → 간판이 읽히기 시작!
```

## 실행 방법

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 타입체크 + 프로덕션 빌드 (dist/)
```

## 조작

- 이동: 방향키 / WASD (모바일: 화면 D-패드)
- 조사: 스페이스 / E (모바일: 조사 버튼)
- 상단 HUD: 🔬 연구 선택 · ✏️ 문제 풀기

## 구조

```
src/
  main.ts                 # 부트스트랩 (Phaser + DOM UI 연결)
  scenes/WorldScene.ts    # 도트 마을, 그리드 이동, ??? 간판 시스템
  systems/ResearchSystem.ts # 연구 트리 상태/RP/저장 (localStorage)
  ui/                     # HUD, 연구 패널, 퀴즈 패널, 터치 컨트롤 (DOM)
  data/ja/research.json   # 일본어 연구 트리 정의
  data/ja/problems.json   # 연구별 문제 은행
```

도트 그래픽은 외부 에셋 없이 코드로 생성합니다 (프로토타입 단계).

## 배포

`main` 브랜치에 푸시하면 GitHub Actions가 GitHub Pages로 자동 배포합니다
(저장소 Settings → Pages → Source를 **GitHub Actions**로 설정 필요).
