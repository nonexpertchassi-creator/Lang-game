import type { ProblemBank, ProblemItem } from '../data/types';
import type { ResearchSystem } from '../systems/ResearchSystem';
import { speakJa } from '../systems/speech';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 🌙 자기 전 "오늘의 관문".
 * 완성한 연구의 단어에서 N문제를 내고, 다 맞혀야 통과(=다음 날).
 * 완성한 연구가 없으면 풀 게 없어 통과 불가 → 공부하러 가게 유도.
 */
export class CheckpointPanel {
  private root: HTMLElement;

  constructor(
    private rs: ResearchSystem,
    private bank: ProblemBank,
  ) {
    this.root = document.getElementById('panel-root')!;
  }

  open(count: number, onPass: () => void): void {
    const pool = this.rs.defs
      .filter((d) => this.rs.isCompleted(d.id))
      .flatMap((d) => this.bank[d.id] ?? []);

    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>🌙 오늘의 관문</h2>
          <button class="panel-close">✕</button>
        </div>
        <div class="panel-body"></div>
      </div>
    `;
    const body = overlay.querySelector('.panel-body') as HTMLElement;
    overlay.querySelector('.panel-close')!.addEventListener('click', () => overlay.remove());
    this.root.appendChild(overlay);

    // 풀 게 없으면 = 아직 공부가 부족 → 통과 불가
    if (pool.length < 4) {
      body.innerHTML = `
        <div class="quiz-complete">
          <div class="big" style="color:var(--accent)">😴 아직 잠이 안 온다…</div>
          <div class="sub">오늘 배운 게 너무 없어서 머릿속이 텅 비었다.<br>
          <b>🔬 연구를 하나 끝내고</b> 다시 자자. (✏️ 문제 풀기로 RP를 모으면 연구가 완성돼요)</div>
          <button class="quiz-next">알겠어</button>
        </div>
      `;
      body.querySelector('.quiz-next')!.addEventListener('click', () => overlay.remove());
      return;
    }

    const items = shuffle(pool).slice(0, count);
    let idx = 0;

    const renderQuestion = (): void => {
      const item = items[idx];
      const distractors: ProblemItem[] = [];
      const seen = new Set([item.meaning]);
      for (const p of shuffle(pool)) {
        if (p.target === item.target || seen.has(p.meaning)) continue;
        seen.add(p.meaning);
        distractors.push(p);
        if (distractors.length === 3) break;
      }
      const choices = shuffle([item, ...distractors]);

      body.innerHTML = `
        <div class="quiz-progress">오늘의 복습 ${idx + 1} / ${items.length}</div>
        <div class="quiz-question">「${item.meaning}」<br><small style="font-size:13px;color:#8a7f72">배운 일본어를 떠올려 고르세요</small></div>
        <div class="quiz-choices"></div>
        <div class="quiz-feedback"></div>
      `;
      const choicesEl = body.querySelector('.quiz-choices')!;
      const feedbackEl = body.querySelector('.quiz-feedback') as HTMLElement;
      let selected: ProblemItem | null = null;
      let answered = false;

      const submitBtn = document.createElement('button');
      submitBtn.className = 'quiz-next';
      submitBtn.textContent = '제출';
      submitBtn.disabled = true;

      for (const choice of choices) {
        const btn = document.createElement('button');
        btn.className = 'quiz-choice';
        btn.textContent = choice.target;
        btn.addEventListener('click', () => {
          if (answered) return;
          selected = choice;
          choicesEl.querySelectorAll('.quiz-choice').forEach((el) => el.classList.remove('selected'));
          btn.classList.add('selected');
          submitBtn.disabled = false;
          speakJa(choice.target);
        });
        choicesEl.appendChild(btn);
      }

      submitBtn.addEventListener('click', () => {
        if (answered || !selected) return;
        answered = true;
        submitBtn.remove();
        const correct = selected.target === item.target;
        choicesEl.querySelectorAll('.quiz-choice').forEach((el) => {
          if (el.classList.contains('selected')) el.classList.add(correct ? 'correct' : 'wrong');
          if (!correct && el.textContent === item.target) el.classList.add('correct');
        });
        feedbackEl.innerHTML = `<b>${item.target}</b> — ${item.reading} · ${item.meaning}`;
        if (correct) {
          idx++;
          const next = document.createElement('button');
          next.className = 'quiz-next';
          next.textContent = idx >= items.length ? '잠자리에 든다 😴' : '다음 →';
          next.addEventListener('click', () => (idx >= items.length ? pass() : renderQuestion()));
          body.appendChild(next);
        } else {
          fail();
        }
      });
      body.appendChild(submitBtn);
    };

    const pass = (): void => {
      body.innerHTML = `
        <div class="quiz-complete">
          <div class="big">😴 잘 자요!</div>
          <div class="sub">오늘 배운 걸 머릿속에 잘 넣었다.<br>내일은 또 무슨 일이 기다릴까…</div>
          <button class="quiz-next">다음 날로</button>
        </div>
      `;
      body.querySelector('.quiz-next')!.addEventListener('click', () => {
        overlay.remove();
        onPass();
      });
    };

    const fail = (): void => {
      const retry = document.createElement('button');
      retry.className = 'quiz-next';
      retry.textContent = '🔁 다시 도전';
      retry.addEventListener('click', () => {
        idx = 0;
        renderQuestion();
      });
      const study = document.createElement('button');
      study.className = 'quiz-next';
      study.style.background = '#6b6359';
      study.textContent = '🔬 더 공부하고 자기 (닫기)';
      study.addEventListener('click', () => overlay.remove());
      body.appendChild(retry);
      body.appendChild(study);
    };

    renderQuestion();
  }
}
