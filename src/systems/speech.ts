/** 일본어 TTS (Web Speech API) — 음성 파일 없이 브라우저 내장 음성 사용 */

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakJa(text: string): void {
  if (!ttsAvailable()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.85;
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
  if (voice) u.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// 일부 브라우저는 voices 목록을 비동기로 로드한다 — 미리 한 번 깨워둔다
if (ttsAvailable()) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
