import type { ResearchSystem } from '../systems/ResearchSystem';

/** 좌상단 HUD: 진행 중인 연구 + 연구/문제 풀기 버튼 */
export class Hud {
  private root: HTMLElement;
  private nameEl!: HTMLElement;
  private barEl!: HTMLElement;
  private rpEl!: HTMLElement;
  private quizBtn!: HTMLButtonElement;
  private researchBtn!: HTMLButtonElement;

  constructor(
    private rs: ResearchSystem,
    onOpenResearch: () => void,
    onOpenQuiz: () => void,
    onOpenSave: () => void,
    onOpenPhone: () => void,
  ) {
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = `
      <div class="hud-research">
        <div class="label">진행 중인 연구</div>
        <div class="name"></div>
        <div class="bar"><div></div></div>
        <div class="rp-text"></div>
      </div>
      <button class="hud-btn" id="btn-research">🔬 연구</button>
      <button class="hud-btn secondary" id="btn-quiz">✏️ 문제 풀기</button>
      <button class="hud-btn neutral" id="btn-phone">📱</button>
      <button class="hud-btn neutral" id="btn-save">💾</button>
    `;
    this.nameEl = this.root.querySelector('.name')!;
    this.barEl = this.root.querySelector('.bar > div')!;
    this.rpEl = this.root.querySelector('.rp-text')!;
    this.researchBtn = this.root.querySelector('#btn-research')!;
    this.quizBtn = this.root.querySelector('#btn-quiz')!;

    this.researchBtn.addEventListener('click', onOpenResearch);
    this.quizBtn.addEventListener('click', onOpenQuiz);
    this.root.querySelector('#btn-save')!.addEventListener('click', onOpenSave);
    this.root.querySelector('#btn-phone')!.addEventListener('click', onOpenPhone);

    rs.on('changed', () => this.refresh());
    this.refresh();
  }

  refresh(): void {
    const id = this.rs.activeId;
    if (!id) {
      this.nameEl.textContent = '없음 — 연구를 선택하세요';
      this.barEl.style.width = '0%';
      this.rpEl.textContent = '';
      this.quizBtn.disabled = true;
      this.researchBtn.classList.add('pulse');
      return;
    }
    const def = this.rs.get(id)!;
    const { current, cost } = this.rs.progress(id);
    this.nameEl.textContent = def.name;
    this.barEl.style.width = `${Math.round((current / cost) * 100)}%`;
    this.rpEl.textContent = `${current} / ${cost} RP`;
    this.quizBtn.disabled = false;
    this.researchBtn.classList.remove('pulse');
  }
}
