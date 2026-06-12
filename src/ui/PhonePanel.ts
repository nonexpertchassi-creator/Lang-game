import type { CityGame, CityId } from '../game/CityGame';
import { CITIES } from '../game/CityGame';
import { flags } from '../systems/flags';
import type { ResearchSystem } from '../systems/ResearchSystem';
import { trip } from '../systems/trip';

interface CityCard {
  id: CityId;
  icon: string;
  desc: string;
  /** 해금에 필요한 완료 연구 수 */
  reqResearch: number;
  /** 여행(박수 선택+엔딩) 시스템 적용 여부 */
  tripReady: boolean;
}

// 도시 = 난이도. 관광지일수록 외국어가 통해서 쉽고, 시골일수록 일본어가 필수다.
const JAPAN_CITIES: CityCard[] = [
  { id: 'tokyo', icon: '🗼', desc: '외국인 친화 · 영어/한국어 안내 많음', reqResearch: 0, tripReady: true },
  { id: 'osaka', icon: '🏯', desc: '현지인의 거리 · 영어 힌트가 사라진다', reqResearch: 4, tripReady: false },
  { id: 'yonago', icon: '🌾', desc: '한적한 시골 · 일본어 없이는 생존 불가', reqResearch: 7, tripReady: false },
];

const NIGHT_OPTIONS = [
  { nights: 1, label: '1박 2일', desc: '짧고 굵게 — 활동 2~3개' },
  { nights: 2, label: '2박 3일', desc: '여유롭게 — 활동 4~5개' },
  { nights: 3, label: '3박 4일', desc: '도쿄를 샅샅이 — 활동 6개+' },
];

/** 📱 스마트폰: 여행 앱으로 도시(난이도)와 일정을 선택해 떠난다 */
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
    const overlay = this.makeOverlay('✈️ 여행 — 일본');
    const body = overlay.querySelector('.panel-body') as HTMLElement;
    const done = this.rs.completedCount;
    const active = trip.current;

    // 여행 중엔 일정에 집중 — 다른 여행은 귀국 후에
    if (active) {
      body.innerHTML = `
        <div class="research-card active-card">
          <div class="row"><span class="name">🗼 ${CITIES[active.city as CityId].name} 여행 중!</span>
          <span class="cost">${active.day}/${trip.totalDays}일차</span></div>
          <div class="desc">다른 여행은 이번 여행을 마치고(✈️ 출국) 떠날 수 있다.</div>
        </div>
      `;
      const back = document.createElement('button');
      back.className = 'select-btn';
      back.textContent = '↩️ 여행으로 돌아가기';
      back.addEventListener('click', () => overlay.remove());
      body.querySelector('.research-card')!.appendChild(back);
      return;
    }

    for (const card of JAPAN_CITIES) {
      const meta = CITIES[card.id];
      const unlocked = done >= card.reqResearch;
      const ended = flags.get(`ended-${card.id}`);

      const el = document.createElement('div');
      el.className = `research-card city-card${unlocked ? '' : ' locked'}`;
      el.innerHTML = `
        <div class="row">
          <span class="name">${card.icon} ${meta.name} <span class="city-lv">Lv${meta.lv}</span></span>
          ${ended ? '<span class="cost">🏁 여행 완료</span>' : ''}
        </div>
        <div class="desc">${card.desc}</div>
      `;

      if (!unlocked) {
        el.insertAdjacentHTML(
          'beforeend',
          `<div class="req">🔒 연구 ${card.reqResearch}개 완료 시 해금 (현재 ${done}개)</div>`,
        );
      } else if (card.tripReady) {
        const btn = document.createElement('button');
        btn.className = 'select-btn';
        btn.textContent = `${card.icon} ${meta.name} 여행 떠나기`;
        btn.addEventListener('click', () => {
          overlay.remove();
          this.openTripSetup((nights) => this.city.startTrip(card.id, nights));
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
      } else {
        const btn = document.createElement('button');
        btn.className = 'select-btn';
        btn.style.background = '#6b6359';
        btn.textContent = `${card.icon} 자유 둘러보기 (여행 일정은 준비 중)`;
        btn.addEventListener('click', () => {
          overlay.remove();
          this.city.travelTo(card.id);
        });
        el.appendChild(btn);
      }
      body.appendChild(el);
    }

    body.insertAdjacentHTML(
      'beforeend',
      `<p class="save-note" style="margin-top:8px">오래 머물수록 더 많이 겪고, 더 많이 배운다.<br>도시 여행을 완주하면 엔딩과 여행 등급이!</p>`,
    );
  }

  /** 박수(여행 길이) 선택 — 길수록 활동(학습)도 엔딩도 풍성해진다 */
  openTripSetup(onStart: (nights: number) => void): void {
    const overlay = this.makeOverlay('🗓 며칠 머물까?');
    const body = overlay.querySelector('.panel-body') as HTMLElement;

    for (const opt of NIGHT_OPTIONS) {
      const el = document.createElement('div');
      el.className = 'research-card';
      el.innerHTML = `
        <div class="row"><span class="name">${opt.label}</span></div>
        <div class="desc">${opt.desc}</div>
      `;
      const btn = document.createElement('button');
      btn.className = 'select-btn';
      btn.textContent = '이 일정으로 출발 ✈️';
      btn.addEventListener('click', () => {
        overlay.remove();
        onStart(opt.nights);
      });
      el.appendChild(btn);
      body.appendChild(el);
    }
    body.insertAdjacentHTML(
      'beforeend',
      `<p class="save-note" style="margin-top:8px">하루에 활동(상황극) 2개를 하면 밤이 된다.<br>호텔에서 자면 다음 날 — 마지막 날엔 출국!</p>`,
    );
  }

  private makeOverlay(title: string): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel phone">
        <div class="panel-head">
          <h2>${title}</h2>
          <button class="panel-close">✕</button>
        </div>
        <div class="panel-body"></div>
      </div>
    `;
    overlay.querySelector('.panel-close')!.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    this.root.appendChild(overlay);
    return overlay;
  }
}
