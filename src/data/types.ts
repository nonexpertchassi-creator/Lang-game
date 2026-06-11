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
}

/** 연구 id → 문제 목록 */
export type ProblemBank = Record<string, ProblemItem[]>;
