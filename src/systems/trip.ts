/** 여행(Trip) 상태: 도시 + 몇 박 + 며칠째 + 오늘 한 활동 — localStorage 저장 */
const KEY = 'linguatrip-trip-v1';

/** 하루에 가능한 활동(상황극) 수 — 다 쓰면 밤이 된다 */
const ACTS_PER_DAY = 2;

export interface TripState {
  city: string;
  /** 몇 박 (1박2일 = 1) */
  nights: number;
  /** 현재 일차 (1부터) */
  day: number;
  /** 오늘 완료한 활동 수 */
  actsToday: number;
  /** 이번 여행에서 완료한 상황극 제목들 */
  log: string[];
}

function load(): TripState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as TripState;
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
    state = { city, nights, day: 1, actsToday: 0, log: [] };
    save();
  },
  /** 전체 일수 (1박2일 → 2) */
  get totalDays(): number {
    return state ? state.nights + 1 : 0;
  },
  get isLastDay(): boolean {
    return !!state && state.day >= state.nights + 1;
  },
  /** 오늘 활동을 다 써서 밤이 되었는가 */
  get isEvening(): boolean {
    return !!state && state.actsToday >= ACTS_PER_DAY;
  },
  recordActivity(title: string): void {
    if (!state) return;
    state.actsToday++;
    state.log.push(title);
    save();
  },
  sleep(): void {
    if (!state) return;
    state.day++;
    state.actsToday = 0;
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
