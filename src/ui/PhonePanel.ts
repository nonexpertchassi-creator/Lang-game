import type { CityGame, CityId } from '../game/CityGame';
import { CITIES } from '../game/CityGame';
import { flags } from '../systems/flags';
import type { ResearchSystem } from '../systems/ResearchSystem';

interface CityCard {
  id: CityId;
  icon: string;
  desc: string;
  /** 해금에 필요한 완료 연구 수 */
  reqResearch: number;
}

// 도시 = 난이도. 관광지일수록 외국어가 통해서 쉽고, 시골일수록 일본어가 필수다.
const JAPAN_CITIES: CityCard[] = [
  { id: 'tokyo', icon: '🗼', desc: '외국인 친화 · 영어/한국어 안내 많음', reqResearch: 0 },
  { id: 'osaka', icon: '🏯', desc: '현지인의 거리 · 영어 힌트가 사라진다', reqResearch: 4 },
  { id: 'yonago', icon: '🌾', desc: '한적한 시골 · 일본어 없이는 생존 불가', reqResearch: 7 },
];

/** 📱 스마트폰: 여행 앱으로 도시(난이도)를 선택해 이동한다 */
export class PhonePanel {
  private root: HTMLElement;

  constructor(
    private rs: ResearchSystem,
    private city: CityGame,
    private onReplayImmigration: () => void,
  ) {
    this.root = document.getElementById('panel-root')!;
  }

  open(): void {
    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    const master = flags.get('japan-master');
    overlay.innerHTML = `
      <div class="panel phone">
        <div class="panel-head">
          <h2>✈️ 여행 — 일본 ${master ? '<span class="city-lv" style="background:var(--green)">🎌 마스터!</span>' : ''}</h2>
          <button class="panel-close">✕</button>
        </div>
        <div class="panel-body"></div>
      </div>
    `;
    const body = overlay.querySelector('.panel-body') as HTMLElement;
    const done = this.rs.completedCount;

    for (const card of JAPAN_CITIES) {
      const meta = CITIES[card.id];
      const unlocked = done >= card.reqResearch;
      const stamp = this.city.stampProgress(card.id);

      const el = document.createElement('div');
      el.className = `research-card city-card${unlocked ? '' : ' locked'}`;
      el.innerHTML = `
        <div class="row">
          <span class="name">${card.icon} ${meta.name} <span class="city-lv">Lv${meta.lv}</span></span>
          <span class="cost">🎖 ${stamp.done}/${stamp.total}</span>
        </div>
        <div class="desc">${card.desc}</div>
      `;

      if (!unlocked) {
        el.insertAdjacentHTML(
          'beforeend',
          `<div class="req">🔒 연구 ${card.reqResearch}개 완료 시 해금 (현재 ${done}개)</div>`,
        );
      } else {
        const btn = document.createElement('button');
        btn.className = 'select-btn';
        btn.textContent = `${card.icon} ${meta.name}로 이동`;
        btn.addEventListener('click', () => {
          overlay.remove();
          this.city.travelTo(card.id);
        });
        el.appendChild(btn);

        if (card.id === 'tokyo') {
          const replay = document.createElement('button');
          replay.className = 'select-btn';
          replay.style.background = '#6b6359';
          replay.textContent = '🛂 입국 심사 다시 해보기';
          replay.addEventListener('click', () => {
            overlay.remove();
            this.onReplayImmigration();
          });
          el.appendChild(replay);
        }
      }
      body.appendChild(el);
    }

    body.insertAdjacentHTML(
      'beforeend',
      `<p class="save-note" style="margin-top:8px">도시의 🎖 핵심 상황을 모두 통과하면 스탬프!<br>스탬프 3개를 모으면… 🎌</p>`,
    );

    overlay.querySelector('.panel-close')!.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    this.root.appendChild(overlay);
  }
}
