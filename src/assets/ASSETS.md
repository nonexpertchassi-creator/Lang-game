# 그림 에셋 넣는 법

voidless.dev 등에서 뽑은 PNG/WebP를 아래 폴더에 **정해진 파일명**으로 넣으면 게임에 자동 반영됩니다.
(파일이 없으면 기존 이모지/텍스트로 안전하게 폴백돼요.)

## 폴더
- `scenes/` — 배경 씬 (가로로 긴 비율 권장). 예: `airport.png`
- `characters/` — 캐릭터(투명 배경 PNG). 예: `officer.png`

## 생성 스펙 (voidless 기준)
- **캐릭터**: 64×64 또는 128×128, **투명 배경**, 정면, **같은 스타일 모델**로 통일
- **배경 씬**: 가로 비율(예: 320×120), 같은 팔레트
- 픽셀아트는 게임에서 `image-rendering: pixelated`로 선명하게 확대됨

## 첫 배치 (입국 심사 장면) — 이것부터!
| 파일 | 내용 |
|---|---|
| `scenes/airport.png` | 나리타 공항 입국 심사대 배경 |
| `characters/officer.png` | 입국 심사관 |

이 두 장을 올리면 입국 심사 화면에 바로 떠요. 잘 맞으면 아래로 확장:

## 다음 배치 (확장용 — 시나리오의 scene/char 키와 파일명을 맞추면 됨)
- scenes: `street`(거리), `ramen`(라멘집), `cafe`(카페), `izakaya`, `sushi`, `hotel`, `konbini`, `dotonbori`, `ryokan`, `matsuri`
- characters: `clerk`(점원), `chef`(요리사), `granny`(료칸 할머니), `driver`(택시 기사), `player`(여행자)
