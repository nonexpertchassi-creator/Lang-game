/** 여행(Trip) 상태: 도시 + 몇 박 + 며칠째 + 하루 단계 + 한 일들 — localStorage 저장 */
const KEY = 'linguatrip-trip-v1';

/** 하루의 단계: 낮 활동 → 저녁 → 밤 → (자고) 아침 → … 마지막 날 귀국 */
export type TripPhase = 'day' | 'evening' | 'night' | 'morning' | 'depart';

export interface TripState {
  city: string;
  /** 몇 박 (1박2일 = 1) */
  nights: number;
  /** 현재 일차 (1부터) */
  day: number;
  /** 오늘의 단계 */
  phase: TripPhase;
  /** 이번 여행에서 완료한 상황극 제목들 */
  log: string[];
}

function load(): TripState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<TripState>;
      return {
        city: s.city ?? 'tokyo',
        nights: s.nights ?? 1,
        day: s.day ?? 1,
        phase: s.phase ?? 'day',
        log: s.log ?? [],
      };
    }
  } catch {
    // 손상 시 여행 없음
  }
  return null;
}

let state: TripState | null = load();

function save(): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // 저장 불가 환경 무시
  }
}

export const trip = {
  get current(): TripState | null {
    return state;
  },
  start(city: string, nights: number): void {
    // 1일차는 도착일 — 한낮(day)부터 시작
    state = { city, nights, day: 1, phase: 'day', log: [] };
    save();
  },
  /** 전체 일수 (1박2일 → 2) */
  get totalDays(): number {
    return state ? state.nights + 1 : 0;
  },
  get isLastDay(): boolean {
    return !!state && state.day >= state.nights + 1;
  },
  get phase(): TripPhase {
    return state?.phase ?? 'day';
  },
  setPhase(p: TripPhase): void {
    if (!state) return;
    state.phase = p;
    save();
  },
  recordActivity(title: string): void {
    if (!state) return;
    state.log.push(title);
    save();
  },
  /** 밤 → 다음 날 아침 */
  sleep(): void {
    if (!state) return;
    state.day++;
    state.phase = 'morning';
    save();
  },
  /** 여행 종료 — 최종 상태를 돌려주고 비운다 */
  end(): TripState | null {
    const final = state;
    state = null;
    save();
    return final;
  },
  reset(): void {
    state = null;
    save();
  },
};

