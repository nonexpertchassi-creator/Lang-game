import type { ResearchDef } from '../data/types';

const SAVE_KEY = 'linguatrip-save-v1';

interface SaveState {
  completed: string[];
  active: string | null;
  rp: Record<string, number>;
}

type EventName = 'changed' | 'completed';

/**
 * 문명식 연구 시스템.
 * - 한 번에 하나의 연구만 활성화
 * - 문제 정답 = RP 적립, cost 도달 시 완료
 * - 완료 시 unlocks.worldTags 가 월드에서 읽을 수 있게 됨
 */
export class ResearchSystem {
  readonly defs: ResearchDef[];
  private state: SaveState;
  private listeners: Record<EventName, ((id: string) => void)[]> = {
    changed: [],
    completed: [],
  };

  constructor(defs: ResearchDef[]) {
    this.defs = defs;
    this.state = this.load();
  }

  get(id: string): ResearchDef | undefined {
    return this.defs.find((d) => d.id === id);
  }

  get activeId(): string | null {
    return this.state.active;
  }

  isCompleted(id: string): boolean {
    return this.state.completed.includes(id);
  }

  /** 선행 연구를 모두 마쳐 시작할 수 있는 상태인가 */
  isAvailable(id: string): boolean {
    const def = this.get(id);
    if (!def || this.isCompleted(id)) return false;
    return def.requires.every((r) => this.isCompleted(r));
  }

  /** 이 월드 태그의 텍스트를 읽을 수 있는가 */
  isTagUnlocked(tag: string): boolean {
    return this.defs.some(
      (d) => this.isCompleted(d.id) && d.unlocks.worldTags.includes(tag),
    );
  }

  /** 태그를 해금해 주는 연구 (잠긴 간판의 힌트 표시용) */
  researchForTag(tag: string): ResearchDef | undefined {
    return this.defs.find((d) => d.unlocks.worldTags.includes(tag));
  }

  progress(id: string): { current: number; cost: number } {
    const def = this.get(id);
    return { current: this.state.rp[id] ?? 0, cost: def?.cost ?? 0 };
  }

  setActive(id: string): boolean {
    if (!this.isAvailable(id)) return false;
    this.state.active = id;
    this.save();
    this.emit('changed', id);
    return true;
  }

  /**
   * 활성 연구에 RP를 적립한다.
   * @returns 이번 적립으로 연구가 완료되면 완료된 연구 id
   */
  addRP(amount: number): string | null {
    const id = this.state.active;
    if (!id) return null;
    const def = this.get(id);
    if (!def) return null;

    this.state.rp[id] = (this.state.rp[id] ?? 0) + amount;
    let completedId: string | null = null;
    if (this.state.rp[id] >= def.cost) {
      this.state.rp[id] = def.cost;
      this.state.completed.push(id);
      this.state.active = null;
      completedId = id;
    }
    this.save();
    this.emit('changed', id);
    if (completedId) this.emit('completed', completedId);
    return completedId;
  }

  on(event: EventName, fn: (id: string) => void): void {
    this.listeners[event].push(fn);
  }

  private emit(event: EventName, id: string): void {
    for (const fn of this.listeners[event]) fn(id);
  }

  private save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch {
      // 시크릿 모드 등 저장 불가 환경은 무시 (진행만 안 남음)
    }
  }

  private load(): SaveState {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveState>;
        return {
          completed: parsed.completed ?? [],
          active: parsed.active ?? null,
          rp: parsed.rp ?? {},
        };
      }
    } catch {
      // 손상된 저장 데이터는 새로 시작
    }
    return { completed: [], active: null, rp: {} };
  }
}
