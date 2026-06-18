import { charUrl, sceneUrl } from '../assets/assets';
import type { ScenarioDef } from '../data/types';
import { speakJa, ttsAvailable } from '../systems/speech';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 상황극 플레이어: 못 알아듣는 일본어를 눈치로 헤쳐나간다.
 * 오답 = ❤️ -1, 0이 되면 처음부터 다시.
 */
export class ScenarioPanel {
  private root: HTMLElement;

  constructor() {
    this.root = document.getElementById('panel-root')!;
  }

  play(def: ScenarioDef, onSuccess?: () => void): void {
    let hearts = def.hearts;

    // 그림이 있으면 배경 씬/캐릭터를 얹는다 (없으면 폴백 — 표시 안 함)
    const scene = sceneUrl(def.scene);
    const char = charUrl(def.char);
    const sceneTag = scene ? `<div class="scenario-scene" style="background-image:url('${scene}')"></div>` : '';
    const charTag = char ? `<img class="scenario-char" src="${char}" alt="" />` : '';

    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>${def.title}</h2>
          <span class="scenario-hearts"></span>
        </div>
        <div class="panel-body"></div>
      </div>
    `;
    const body = overlay.querySelector('.panel-body') as HTMLElement;
    const heartsEl = overlay.querySelector('.scenario-hearts') as HTMLElement;
    this.root.appendChild(overlay);

    const drawHearts = (): void => {
      heartsEl.textContent = '❤️'.repeat(hearts) + '🖤'.repeat(def.hearts - hearts);
    };

    const showIntro = (): void => {
      hearts = def.hearts;
      drawHearts();
      body.innerHTML = `
        ${sceneTag}
        <p class="scenario-intro">${def.intro.replace(/\n/g, '<br>')}</p>
        <button class="quiz-next">시작하기 →</button>
      `;
      body.querySelector('.quiz-next')!.addEventListener('click', () => showStep(0));
    };

    const showFail = (): void => {
      body.innerHTML = `
        <div class="quiz-complete">
          <div class="big" style="color:var(--accent)">😢 쫓겨났다…</div>
          <div class="sub">하트를 모두 잃었다. 다시 줄을 서야 한다.</div>
          <button class="quiz-next">다시 도전</button>
        </div>
      `;
      body.querySelector('.quiz-next')!.addEventListener('click', showIntro);
    };

    const showSuccess = (): void => {
      body.innerHTML = `
        <div class="quiz-complete">
          <div class="big">🎉 통과!</div>
          <div class="sub">${def.success.replace(/\n/g, '<br>')}</div>
          <button class="quiz-next">여행 시작!</button>
        </div>
      `;
      body.querySelector('.quiz-next')!.addEventListener('click', () => {
        overlay.remove();
        onSuccess?.();
      });
    };

    const showStep = (i: number): void => {
      if (i >= def.steps.length) {
        showSuccess();
        return;
      }
      const step = def.steps[i];
      speakJa(step.text);

      body.innerHTML = `
        ${sceneTag}
        ${charTag}
        <div class="quiz-progress">${i + 1} / ${def.steps.length}</div>
        <div class="quiz-question">
          <span class="scenario-speaker">${step.speaker}</span><br>
          “${step.phonetic}”
          ${ttsAvailable() ? ' <button class="dialog-speak">🔊</button>' : ''}
        </div>
        ${step.hint ? `<div class="scenario-hint">${step.hint}</div>` : ''}
        ${step.cognateNote ? `<div class="cognate">${step.cognateNote}</div>` : ''}
        <div class="scenario-choices"></div>
        <div class="quiz-feedback"></div>
      `;
      body.querySelector('.dialog-speak')?.addEventListener('click', () => speakJa(step.text));

      const choicesEl = body.querySelector('.scenario-choices')!;
      const feedbackEl = body.querySelector('.quiz-feedback') as HTMLElement;
      let resolved = false;

      for (const choice of shuffle(step.choices)) {
        const btn = document.createElement('button');
        btn.className = 'quiz-choice';
        btn.textContent = choice.label;
        btn.addEventListener('click', () => {
          if (resolved) return;
          if (choice.correct) {
            resolved = true;
            btn.classList.add('correct');
            feedbackEl.textContent = '⭕';
            setTimeout(() => showStep(i + 1), 650);
          } else {
            btn.classList.add('wrong');
            btn.disabled = true;
            hearts--;
            drawHearts();
            feedbackEl.innerHTML = `${choice.fail ?? '틀렸다…'} <b style="color:var(--accent)">(-1 ❤️)</b>`;
            if (hearts <= 0) {
              resolved = true;
              setTimeout(showFail, 900);
            }
          }
        });
        choicesEl.appendChild(btn);
      }
    };

    showIntro();
  }
}
