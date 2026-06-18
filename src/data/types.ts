/** 연구(테크 트리 노드) 정의 — PLAN.md §4 참고 */
export interface ResearchDef {
  id: string;
  name: string;
  desc: string;
  /** 완료에 필요한 연구 포인트(RP) */
  cost: number;
  /** 선행 연구 id 목록 */
  requires: string[];
  unlocks: {
    /** 완료 시 월드에서 읽을 수 있게 되는 텍스트 태그 */
    worldTags: string[];
  };
  /** 다른 언어 연구에 주는 RP 보너스 (Phase 4에서 사용) */
  crossLanguageBonus?: Record<string, number>;
}

/** 문제 은행의 문제 1개 */
export interface ProblemItem {
  /** 대상 언어 표기 (정답 선택지) */
  target: string;
  /** 발음/읽기 */
  reading: string;
  /** 모국어 뜻 (문제 지문) */
  meaning: string;
  /** 정답 시 획득 RP */
  rp: number;
  /** 문장 조립 문제: 순서대로 배열할 단어 블록 (있으면 조립 모드로 출제) */
  blocks?: string[];
}

/** 연구 id → 문제 목록 */
export type ProblemBank = Record<string, ProblemItem[]>;

/** 상황극(시나리오)의 한 장면 */
export interface ScenarioStep {
  speaker: string;
  /** 일본어 원문 (TTS 재생용) */
  text: string;
  /** 한글 음차 — 플레이어에게 보이는 "들리는 소리" */
  phonetic: string;
  /** 눈치/상황 힌트 */
  hint?: string;
  /** 한국어 유사 단어 노트 */
  cognateNote?: string;
  choices: {
    label: string;
    correct: boolean;
    /** 오답 시 보여줄 반응 */
    fail?: string;
  }[];
}

/** 상황극 정의 — 오답 시 하트가 깎이고, 0이 되면 처음부터 */
export interface ScenarioDef {
  id: string;
  title: string;
  intro: string;
  success: string;
  hearts: number;
  steps: ScenarioStep[];
  /** 배경 씬 키 (src/assets/scenes/<scene>.png) — 없으면 표시 안 함 */
  scene?: string;
  /** 캐릭터 키 (src/assets/characters/<char>.png) — 없으면 표시 안 함 */
  char?: string;
}
