import { flags } from '../systems/flags';
import { inventory } from '../systems/inventory';
import type { ResearchSystem } from '../systems/ResearchSystem';

/** 저장 관리 패널: 저장 코드 내보내기/불러오기, 초기화 */
export class SavePanel {
  private root: HTMLElement;

  constructor(private rs: ResearchSystem) {
    this.root = document.getElementById('panel-root')!;
  }

  open(): void {
    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>💾 저장 관리</h2>
          <button class="panel-close">✕</button>
        </div>
        <div class="panel-body">
          <p class="save-note">진행은 이 브라우저에 자동 저장됩니다.<br>
          기기를 바꾸거나 캐시를 지울 때를 대비해 <b>저장 코드</b>를 복사해 보관하세요.</p>

          <div class="save-section-title">내 저장 코드</div>
          <textarea class="save-textarea export-area" readonly></textarea>
          <button class="panel-btn copy-btn">📋 코드 복사</button>

          <div class="save-section-title">코드로 불러오기</div>
          <textarea class="save-textarea import-area" placeholder="저장 코드를 붙여넣으세요"></textarea>
          <button class="panel-btn import-btn">⬇️ 불러오기</button>

          <div class="save-msg"></div>

          <button class="panel-btn danger reset-btn">🗑 처음부터 시작 (초기화)</button>
        </div>
      </div>
    `;

    const exportArea = overlay.querySelector('.export-area') as HTMLTextAreaElement;
    const importArea = overlay.querySelector('.import-area') as HTMLTextAreaElement;
    const msgEl = overlay.querySelector('.save-msg') as HTMLElement;
    exportArea.value = this.rs.exportCode();

    overlay.querySelector('.copy-btn')!.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(exportArea.value);
        msgEl.textContent = '✅ 복사되었습니다! 메모장 등에 보관하세요.';
      } catch {
        exportArea.select();
        msgEl.textContent = '코드를 길게 눌러 직접 복사해 주세요.';
      }
    });

    overlay.querySelector('.import-btn')!.addEventListener('click', () => {
      if (!importArea.value.trim()) {
        msgEl.textContent = '붙여넣은 코드가 없습니다.';
        return;
      }
      if (this.rs.importCode(importArea.value)) {
        msgEl.textContent = '✅ 불러오기 완료! 진행 상황이 복원되었습니다.';
        exportArea.value = this.rs.exportCode();
        importArea.value = '';
      } else {
        msgEl.textContent = '❌ 올바르지 않은 저장 코드입니다.';
      }
    });

    overlay.querySelector('.reset-btn')!.addEventListener('click', () => {
      if (confirm('정말 모든 진행(연구·돈·아이템)을 지우고 처음부터 시작할까요?')) {
        this.rs.reset();
        inventory.reset();
        flags.reset();
        location.reload(); // 입국 심사부터 다시
      }
    });

    overlay.querySelector('.panel-close')!.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    this.root.appendChild(overlay);
  }
}
