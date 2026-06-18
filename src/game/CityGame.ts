import type { ScenarioDef } from '../data/types';
import { flags } from '../systems/flags';
import { inventory } from '../systems/inventory';
import type { ResearchSystem } from '../systems/ResearchSystem';
import { speakJa } from '../systems/speech';
import { trip, type TripPhase } from '../systems/trip';
import type { CheckpointPanel } from '../ui/CheckpointPanel';
import type { ScenarioPanel } from '../ui/ScenarioPanel';

interface LocationAction {
  label: string;
  /** false면 버튼을 숨긴다 */
  visible?: () => boolean;
  run: () => void;
}

interface LocationDef {
  city: CityId;
  icon: string;
  name: string;
  desc: string;
  /** 배너 배경 (CSS gradient) */
  bg: string;
  actions: () => LocationAction[];
}

export type CityId = 'tokyo' | 'osaka' | 'yonago';

interface CityMeta {
  name: string;
  lv: number;
  entry: string;
  /** 첫 방문 시 재생할 도착 시나리오 (자유 둘러보기 도시) */
  arrival?: string;
}

export const CITIES: Record<CityId, CityMeta> = {
  tokyo: { name: '도쿄', lv: 0, entry: 'home' },
  osaka: { name: '오사카', lv: 1, entry: 'osaka-station', arrival: 'shinkansen-osaka' },
  yonago: { name: '요나고', lv: 2, entry: 'yonago-station', arrival: 'local-train-yonago' },
};

/**
 * 여행 게임 화면.
 * - 도쿄: 여행(trip) = 하루 흐름(낮→저녁→밤→아침…→귀국), 단계마다 선택지 = 다른 생활 일본어
 * - 오사카/요나고: 아직 "자유 둘러보기"(장소 그래프)
 */
export class CityGame {
  private screenEl: HTMLElement;
  private currentId = 'home';
  private locations: Record<string, LocationDef>;
  private mode: 'location' | 'flow' = 'location';
  /** 밤 가라오케는 하루 한 번 — 현재 밤이 며칟날인지로 구분 */
  private nightDay = -1;
  private karaokeDoneTonight = false;
  /** 📱 열기 (집 화면에서 사용) — main에서 연결 */
  onOpenPhone?: () => void;

  constructor(
    private rs: ResearchSystem,
    private scenarios: Record<string, ScenarioDef>,
    private scenarioPanel: ScenarioPanel,
    private checkpoint: CheckpointPanel,
  ) {
    this.screenEl = document.getElementById('screen-root')!;
    this.locations = this.buildLocations();
    // 연구 완료 → 간판이 읽히게 되므로 화면 갱신
    rs.on('completed', () => this.render());
  }

  start(): void {
    if (trip.current && trip.current.city === 'tokyo') {
      this.mode = 'flow';
      this.render();
    } else {
      this.goto('home');
    }
  }

  /** 박수를 정하고 여행 시작 */
  startTrip(city: CityId, nights: number): void {
    trip.start(city, nights);
    this.nightDay = -1;
    if (city === 'tokyo') {
      this.mode = 'flow';
      this.render();
    } else {
      this.travelTo(city);
    }
  }

  goto(id: string): void {
    this.mode = 'location';
    this.currentId = id;
    inventory.setLastLoc(id);
    this.render();
  }

  /** 📱 여행 앱에서 도시 이동 (자유 둘러보기 도시). 첫 방문이면 도착 시나리오부터. */
  travelTo(city: CityId): void {
    const meta = CITIES[city];
    const visitedFlag = `visited-${city}`;
    if (meta.arrival && !flags.get(visitedFlag)) {
      this.play(meta.arrival, () => {
        flags.set(visitedFlag);
        this.goto(meta.entry);
      });
    } else {
      this.goto(meta.entry);
    }
  }

  // ---------- 행동 헬퍼 ----------

  private play(id: string, onSuccess?: () => void): void {
    this.scenarioPanel.play(this.scenarios[id], () => {
      flags.set(`done-${id}`);
      onSuccess?.();
      this.render();
    });
  }

  /** 유료 상황극: 성공 시 지불. 잔액 부족이면 진입 불가 */
  private paidScenario(id: string, cost: number, broke: string, onSuccess?: () => void): void {
    if (inventory.yen < cost) {
      this.say(broke);
      return;
    }
    this.play(id, () => {
      inventory.spend(cost);
      onSuccess?.();
      this.render();
    });
  }

  /** 행동 결과 메시지를 화면 하단에 표시 */
  private say(html: string): void {
    const el = this.screenEl.querySelector('.location-feedback');
    if (el) el.innerHTML = html;
  }

  /** 간판/안내문: 문자 연구를 완료해야 읽을 수 있다 */
  private sign(label: string, tag: string, jp: string, phonetic: string, meaning: string): LocationAction {
    return {
      label,
      run: () => {
        if (this.rs.isTagUnlocked(tag)) {
          speakJa(jp);
          this.say(`🪧 <b>${jp}</b> — ${phonetic} · ${meaning}`);
        } else {
          const need = this.rs.researchForTag(tag);
          this.say(`🪧 <b>???</b> — 무슨 글자인지 읽을 수 없다…${need ? ` <span style="color:var(--accent)">(🔬 「${need.name}」 연구 필요)</span>` : ''}`);
        }
      },
    };
  }

  // ---------- 도쿄: 하루 흐름 엔진 ----------

  /** 단계 전환 */
  private advance(p: TripPhase): void {
    trip.setPhase(p);
    this.render();
  }

  /** 흐름용 선택지: 상황극 → (지불) → 기록 → 다음 단계 */
  private choice(icon: string, label: string, id: string, cost: number, broke: string, next: () => void): LocationAction {
    return {
      label: `${icon} ${label}`,
      run: () => {
        const ok = (): void => {
          trip.recordActivity(this.scenarios[id].title);
          next();
        };
        if (cost > 0) this.paidScenario(id, cost, broke, ok);
        else this.play(id, ok);
      },
    };
  }

  private renderFlow(): void {
    const t = trip.current!;
    const phase = trip.phase;
    const last = trip.isLastDay;
    const dayNo = t.day;

    let icon = '';
    let name = '';
    let desc = '';
    let bg = '';
    let prompt = '';
    let phaseLabel = '';
    const actions: LocationAction[] = [];

    if (phase === 'morning') {
      icon = '☀️'; name = `${dayNo}일차 아침`; phaseLabel = '☀️ 아침';
      bg = 'linear-gradient(160deg,#ffe0a0,#fff6e2)';
      desc = '침대에서 눈을 떴다. 오늘의 첫 끼, 어디서 먹을까?';
      prompt = '조식을 고르세요 — 선택마다 다른 생활 일본어를 배워요';
      const next = (): void => (last ? this.advance('depart') : this.advance('day'));
      actions.push(
        this.choice('🍳', '호텔 조식 뷔페', 'hotel-breakfast', 0, '', next),
        this.choice('🏪', '편의점에서 간단히 (¥400)', 'konbini-breakfast', 400, '💸 편의점 살 돈도 없다…', next),
        this.choice('☕', '킷사텐 모닝세트 (¥600)', 'kissaten-breakfast', 600, '💸 킷사텐 갈 돈이 없다…', next),
      );
    } else if (phase === 'day') {
      icon = '🗺'; name = `${dayNo}일차 — 도쿄`; phaseLabel = '☀️ 낮';
      bg = 'linear-gradient(160deg,#8fc7ec,#e3f0fb)';
      desc = '날씨가 좋다. 오늘은 어디로 가볼까?';
      prompt = '오늘의 행선지 (하나만 — 다음 여행에 다른 곳도!)';
      const next = (): void => this.advance('evening');
      actions.push(
        this.choice('⛩', '아사쿠사 — 절과 관광', 'asakusa-photo', 0, '', next),
        this.choice('☕', '시부야 — 카페 (¥500)', 'cafe-order', 500, '💸 커피 한 잔 값이 없다…', next),
        this.sign('🪧 거리 간판을 읽어본다', 'kanji', '駅', '에키', '역'),
      );
    } else if (phase === 'evening') {
      icon = '🌆'; name = `${dayNo}일차 저녁`; phaseLabel = '🌆 저녁';
      bg = 'linear-gradient(160deg,#f29d5a,#fbe0c5)';
      desc = '해가 진다. 슬슬 배가 고프다.';
      prompt = '저녁 메뉴 — 가게마다 주문법이 달라요';
      const next = (): void => this.advance('night');
      actions.push(
        this.choice('🍜', '라멘집 (¥900)', 'ramen-order', 900, '💸 라멘 한 그릇 값도 없다…', next),
        this.choice('🍢', '이자카야 (¥2,000)', 'izakaya', 2000, '💸 이자카야는 부담된다…', next),
        this.choice('🍣', '회전초밥 (¥1,500)', 'sushi-go', 1500, '💸 초밥 먹을 돈이 없다…', next),
      );
    } else if (phase === 'night') {
      icon = '🌙'; name = `${dayNo}일차 밤`; phaseLabel = '🌙 밤';
      bg = 'linear-gradient(160deg,#3b4a7a,#7e8bc0)';
      desc = '네온이 빛나는 도쿄의 밤.';
      prompt = last ? '내일은 귀국. 도쿄에서의 마지막 밤이다.' : '오늘 하루를 마무리하자.';
      if (this.nightDay !== dayNo) {
        this.nightDay = dayNo;
        this.karaokeDoneTonight = false;
      }
      if (!this.karaokeDoneTonight) {
        actions.push({
          label: '🎤 가라오케 한 탕 (¥1,500)',
          run: () =>
            this.paidScenario('karaoke', 1500, '💸 가라오케 갈 돈이 없다… 길에서 흥얼거린다.', () => {
              trip.recordActivity(this.scenarios['karaoke'].title);
              this.karaokeDoneTonight = true;
              this.render();
            }),
        });
      }
      actions.push({
        label: '🛏 호텔로 돌아가 잔다',
        run: () => {
          // 🌙 오늘의 관문: 통과해야 다음 날 (도시 레벨만큼 빡세짐)
          const count = CITIES[t.city as CityId].lv + 1;
          this.checkpoint.open(count, () => {
            trip.sleep();
            this.render();
          });
        },
      });
    } else {
      // depart
      icon = '✈️'; name = '귀국일'; phaseLabel = '✈️ 귀국';
      bg = 'linear-gradient(160deg,#9ec9ee,#e7f2fb)';
      desc = '즐거웠던 도쿄와 작별할 시간. 공항으로 향한다.';
      actions.push({ label: '✈️ 공항으로 — 출국한다', run: () => this.depart() });
    }

    const bag = inventory.items.length ? inventory.items.join(', ') : '비어 있음';
    this.screenEl.innerHTML = `
      <div class="location">
        <div class="location-banner" style="background:${bg}"><span>${icon}</span></div>
        <h1 class="location-name">${name} <span class="city-lv">도쿄 ${t.nights}박 ${t.nights + 1}일</span></h1>
        <p class="location-desc">${desc}</p>
        <div class="status-bar">💴 ¥${inventory.yen.toLocaleString()} · 🎒 ${bag} · 🗓 ${dayNo}/${trip.totalDays} ${phaseLabel}</div>
        ${prompt ? `<p class="flow-prompt">${prompt}</p>` : ''}
        <div class="action-list"></div>
        <div class="location-feedback"></div>
      </div>
    `;
    this.appendActions(actions);
  }

  /** ✈️ 출국 — 여행 종료, 도쿄 엔딩 리포트 */
  private depart(): void {
    const final = trip.end();
    if (!final) return;
    flags.set(`ended-${final.city}`);

    const unique = [...new Set(final.log)];
    const n = unique.length;
    const grade = n >= 7 ? 'S' : n >= 5 ? 'A' : n >= 3 ? 'B' : 'C';
    const logHtml = unique.length
      ? unique.map((t) => `<li>${t}</li>`).join('')
      : '<li>…호텔 밖을 거의 나가지 않았다. 그것도 여행이지.</li>';

    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>✈️ 귀국 — 도쿄 여행 끝</h2></div>
        <div class="panel-body">
          <div class="quiz-complete">
            <div class="big">🗼 도쿄 ${final.nights}박 ${final.nights + 1}일</div>
            <div class="ending-story">
              창밖으로 도쿄가 멀어진다.<br>
              아무것도 못 알아듣던 첫날의 내가, 조금은 다른 사람이 되어 돌아간다.
            </div>
            <div class="trip-report">
              <div class="trip-grade">여행 등급 <b>${grade}</b></div>
              <ul class="trip-log">${logHtml}</ul>
              <div class="ending-stats">
                🔬 연구 ${this.rs.completedCount}/${this.rs.defs.length}
                · 💴 남은 여비 ¥${inventory.yen.toLocaleString()}
              </div>
            </div>
            <div class="sub" style="margin-top:12px">
              더 길게 머물수록, 더 많이 겪고 더 많이 배운다.<br>
              다음엔 며칠 더 머물러 볼까? 다른 가게도 가보고!
            </div>
            <button class="quiz-next">집으로</button>
          </div>
        </div>
      </div>
    `;
    overlay.querySelector('.quiz-next')!.addEventListener('click', () => {
      overlay.remove();
      this.goto('home');
    });
    document.getElementById('panel-root')!.appendChild(overlay);
  }

  // ---------- 자유 둘러보기 장소 (집 / 오사카 / 요나고) ----------

  private buildLocations(): Record<string, LocationDef> {
    return {
      home: {
        city: 'tokyo', icon: '🏠', name: '집 (한국)',
        desc: '여행에서 돌아온 내 방. 책상 위 일본어 노트가 눈에 들어온다. 다음엔 어디로 떠날까?',
        bg: 'linear-gradient(160deg,#6e8cc8,#dde7f8)',
        actions: () => [
          { label: '✈️ 휴대폰을 열어 여행을 계획한다', run: () => this.onOpenPhone?.() },
          { label: '📓 일본어 노트를 펼친다 (연구·문제는 언제든 가능)', run: () => this.say('🔬 상단의 연구/문제 풀기 버튼으로 언제든 공부할 수 있다. 다음 여행이 쉬워진다!') },
        ],
      },

      // ===== 오사카 Lv1 (자유 둘러보기) =====
      'osaka-station': {
        city: 'osaka', icon: '🚉', name: '신오사카역',
        desc: '쉴 새 없이 오가는 사람들. 안내판에서 영어가 줄었다. 말소리가 어딘가 다르다…?',
        bg: 'linear-gradient(160deg,#a08ce0,#e6ddf6)',
        actions: () => [
          { label: '🌆 도톤보리로 나간다', run: () => this.goto('dotonbori') },
          this.sign('🪧 출구 표지판을 읽어본다', 'kanji', '出口', '데구치', '출구'),
          { label: '📱 (도쿄로 돌아가려면 휴대폰 여행 앱을 쓰자)', run: () => this.say('📱 상단의 휴대폰 버튼으로 도시를 이동할 수 있다.') },
        ],
      },

      dotonbori: {
        city: 'osaka', icon: '🌆', name: '도톤보리',
        desc: '거대한 게 간판, 글리코 러너, 타코야키 냄새. 오사카의 심장. 여긴 영어 힌트가 없다.',
        bg: 'linear-gradient(160deg,#e0608a,#f9d8e4)',
        actions: () => [
          { label: '🐙 타코야키를 사 먹는다 (¥600)', run: () => this.paidScenario('takoyaki', 600, '💸 타코야키 살 돈이 없다… 냄새만 맡는다.') },
          { label: '💊 드럭스토어에서 심부름 약을 산다 (¥1,500)', run: () => this.paidScenario('drugstore', 1500, '💸 약 살 돈이 부족하다…') },
          { label: '🏯 오사카성을 찾아간다 (입장료 ¥600)', run: () => this.paidScenario('osaka-castle', 600, '💸 입장료가 없다…') },
          this.sign('🪧 포장마차 천막의 글자를 읽어본다', 'hiragana', 'たこやき', '타코야키', '타코야키(문어빵)'),
          { label: '↩️ 신오사카역으로 돌아간다', run: () => this.goto('osaka-station') },
        ],
      },

      // ===== 요나고 Lv2 (자유 둘러보기) =====
      'yonago-station': {
        city: 'yonago', icon: '🌾', name: '요나고역 앞',
        desc: '한적한 시골 역. 들리는 건 매미 소리뿐. 영어는… 어디에도 없다.',
        bg: 'linear-gradient(160deg,#88b86e,#eef5dc)',
        actions: () => [
          { label: '🚌 온천행 버스를 탄다 (¥200)', run: () => this.paidScenario('yonago-bus', 200, '💸 버스비 200엔이 없다…', () => this.goto('ryokan')) },
          this.sign('🪧 역 이름판을 읽어본다', 'hiragana', 'よなご', '요나고', '요나고 (지명)'),
          { label: '🦀 거대한 게 동상을 구경한다', run: () => this.say('🦀 요나고 근처 사카이미나토는 게로 유명하다. 동상이 위풍당당하다.') },
        ],
      },

      ryokan: {
        city: 'yonago', icon: '♨️', name: '온천 료칸',
        desc: '나무 향이 나는 오래된 료칸. 주인 할머니의 환대가 기다린다.',
        bg: 'linear-gradient(160deg,#c98f5e,#f5e6d3)',
        actions: () => [
          { label: '🙇 체크인한다', visible: () => !flags.get('done-ryokan-checkin'), run: () => this.play('ryokan-checkin') },
          { label: '♨️ 온천에 몸을 담근다', visible: () => flags.get('done-ryokan-checkin'), run: () => this.say('♨️ 후우… 여행의 피로가 녹아내린다. (밤 10시까지라고 하셨다)') },
          { label: '🏮 저녁, 마을 축제에 나가본다', visible: () => flags.get('done-ryokan-checkin'), run: () => this.goto('village') },
          this.sign('🪧 현관의 안내문을 읽어본다', 'kanji', '入口', '이리구치', '입구'),
          { label: '↩️ 역 앞으로 돌아간다', run: () => this.goto('yonago-station') },
        ],
      },

      village: {
        city: 'yonago', icon: '🏮', name: '마을 축제 (마츠리)',
        desc: '등불이 줄지어 빛나고, 북소리가 울린다. 유카타 차림의 사람들. 오늘 밤이 최종 시험이다.',
        bg: 'linear-gradient(160deg,#4a3f78,#8d7fc0)',
        actions: () => [
          { label: '🎆 축제 속으로 들어간다 — 최종 시험', visible: () => !flags.get('done-matsuri'), run: () => this.play('matsuri') },
          { label: '🎆 불꽃놀이를 다시 본다', visible: () => flags.get('done-matsuri'), run: () => this.say('🎆 그날 밤의 불꽃은 잊을 수 없다.') },
          { label: '↩️ 료칸으로 돌아간다', run: () => this.goto('ryokan') },
        ],
      },
    };
  }

  // ---------- 렌더링 ----------

  private render(): void {
    if (this.mode === 'flow' && trip.current) {
      this.renderFlow();
    } else {
      this.renderLocation();
    }
  }

  private renderLocation(): void {
    const loc = this.locations[this.currentId] ?? this.locations['home'];
    const meta = CITIES[loc.city];
    const isHome = this.currentId === 'home';
    const bag = inventory.items.length ? inventory.items.join(', ') : '비어 있음';
    const badge = isHome ? '🇰🇷 휴식' : `${meta.name} Lv${meta.lv}`;

    this.screenEl.innerHTML = `
      <div class="location">
        <div class="location-banner" style="background:${loc.bg}"><span>${loc.icon}</span></div>
        <h1 class="location-name">${loc.name} <span class="city-lv">${badge}</span></h1>
        <p class="location-desc">${loc.desc}</p>
        <div class="status-bar">💴 ¥${inventory.yen.toLocaleString()} · 🎒 ${bag}</div>
        <div class="action-list"></div>
        <div class="location-feedback"></div>
      </div>
    `;
    this.appendActions(loc.actions());
  }

  private appendActions(actions: LocationAction[]): void {
    const list = this.screenEl.querySelector('.action-list')!;
    for (const action of actions) {
      if (action.visible && !action.visible()) continue;
      const btn = document.createElement('button');
      btn.className = 'action-btn-row';
      btn.textContent = action.label;
      btn.addEventListener('click', () => action.run());
      list.appendChild(btn);
    }
  }
}
