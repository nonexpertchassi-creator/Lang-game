/**
 * 그림 에셋 자동 등록.
 * src/assets/scenes/ 와 characters/ 에 PNG·WebP 파일을 넣으면
 * 확장자를 뗀 파일명이 "키"가 되어 자동으로 잡힌다.
 *   예: scenes/airport.png  → sceneUrl('airport')
 *       characters/officer.png → charUrl('officer')
 * 파일이 없으면 undefined → UI는 이모지/텍스트로 폴백한다.
 */
const sceneMods = import.meta.glob('./scenes/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const charMods = import.meta.glob('./characters/*.{png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function toMap(mods: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(mods)) {
    const key = path.split('/').pop()!.replace(/\.(png|webp)$/, '');
    map[key] = url;
  }
  return map;
}

export const scenes = toMap(sceneMods);
export const characters = toMap(charMods);

export const sceneUrl = (key?: string): string | undefined => (key ? scenes[key] : undefined);
export const charUrl = (key?: string): string | undefined => (key ? characters[key] : undefined);
