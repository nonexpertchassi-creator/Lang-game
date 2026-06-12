/** 지갑(엔화) + 가방(아이템) + 마지막 위치 — localStorage 저장 */
const KEY = 'linguatrip-inv-v1';

interface InvState {
  yen: number;
  items: string[];
  lastLoc?: string;
}

function load(): InvState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<InvState>;
      return { yen: p.yen ?? 20000, items: p.items ?? [], lastLoc: p.lastLoc };
    }
  } catch {
    // 손상 시 새로 시작
  }
  return { yen: 20000, items: [] };
}

let state = load();

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장 불가 환경 무시
  }
}

export const inventory = {
  get yen(): number {
    return state.yen;
  },
  /** 지불 시도 — 잔액 부족이면 false */
  spend(amount: number): boolean {
    if (state.yen < amount) return false;
    state.yen -= amount;
    save();
    return true;
  },
  has(item: string): boolean {
    return state.items.includes(item);
  },
  add(item: string): void {
    if (!state.items.includes(item)) {
      state.items.push(item);
      save();
    }
  },
  get items(): readonly string[] {
    return state.items;
  },
  get lastLoc(): string | undefined {
    return state.lastLoc;
  },
  setLastLoc(id: string): void {
    state.lastLoc = id;
    save();
  },
  reset(): void {
    state = { yen: 20000, items: [] };
    save();
  },
};
