import './style.css';
import { CityGame } from './game/CityGame';
import problemsJson from './data/ja/problems.json';
import researchJson from './data/ja/research.json';
import scenariosJson from './data/ja/scenarios.json';
import type { ProblemBank, ResearchDef, ScenarioDef } from './data/types';
import { flags } from './systems/flags';
import { ResearchSystem } from './systems/ResearchSystem';
import { Hud } from './ui/Hud';
import { PhonePanel } from './ui/PhonePanel';
import { QuizPanel } from './ui/QuizPanel';
import { ResearchPanel } from './ui/ResearchPanel';
import { SavePanel } from './ui/SavePanel';
import { ScenarioPanel } from './ui/ScenarioPanel';

const researchDefs = researchJson as ResearchDef[];
const problemBank = problemsJson as ProblemBank;
const scenarios = scenariosJson as Record<string, ScenarioDef>;

const rs = new ResearchSystem(researchDefs);
const researchPanel = new ResearchPanel(rs);
const quizPanel = new QuizPanel(rs, problemBank);
const savePanel = new SavePanel(rs);
const scenarioPanel = new ScenarioPanel();
const city = new CityGame(rs, scenarios, scenarioPanel);

// 입국 심사 다시 해보기 (여행과 무관한 단독 재생)
const replayImmigration = (): void => {
  scenarioPanel.play(scenarios['tokyo-immigration']);
};
const phonePanel = new PhonePanel(rs, city, replayImmigration);
city.onOpenPhone = () => phonePanel.open();

new Hud(
  rs,
  () => researchPanel.open(),
  () => quizPanel.open(),
  () => savePanel.open(),
  () => phonePanel.open(),
);

city.start();

// 첫 방문: 일정(박수) 선택 → 입국 심사 → 여행(하루 흐름) 시작
if (!flags.get('tokyo-arrived')) {
  setTimeout(() => {
    phonePanel.openTripSetup((nights) => {
      scenarioPanel.play(scenarios['tokyo-immigration'], () => {
        flags.set('tokyo-arrived');
        city.startTrip('tokyo', nights);
      });
    });
  }, 400);
}
