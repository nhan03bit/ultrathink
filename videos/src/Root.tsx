import { Composition } from "remotion";
import { UltraThinkPromo } from "./UltraThinkPromo";
import { UltraThinkShowcase } from "./UltraThinkShowcase";
import { Intro } from "./scenes/Intro";
import { Problem } from "./scenes/Problem";
import { Pillars } from "./scenes/Pillars";
import { SkillMesh } from "./scenes/SkillMesh";
import { MemoryDemo } from "./scenes/MemoryDemo";
import { HooksPrivacy } from "./scenes/HooksPrivacy";
import { EditorSupport } from "./scenes/EditorSupport";
import { Stats } from "./scenes/Stats";
import { CTA } from "./scenes/CTA";
import { FPS, WIDTH, HEIGHT } from "./theme";

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="UltraThinkShowcase"
        component={UltraThinkShowcase}
        durationInFrames={Math.round(FPS * 52)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="UltraThinkPromo"
        component={UltraThinkPromo}
        durationInFrames={Math.round(FPS * 29)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition id="Intro" component={Intro} durationInFrames={FPS * 4} fps={FPS} width={WIDTH} height={HEIGHT} />
      <Composition
        id="Problem"
        component={Problem}
        durationInFrames={Math.round(FPS * 3.6)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Pillars"
        component={Pillars}
        durationInFrames={Math.round(FPS * 4)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SkillMesh"
        component={SkillMesh}
        durationInFrames={Math.round(FPS * 4)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="MemoryDemo"
        component={MemoryDemo}
        durationInFrames={Math.round(FPS * 3.6)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="HooksPrivacy"
        component={HooksPrivacy}
        durationInFrames={Math.round(FPS * 3.6)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="EditorSupport"
        component={EditorSupport}
        durationInFrames={Math.round(FPS * 3)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="Stats"
        component={Stats}
        durationInFrames={Math.round(FPS * 3)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition id="CTA" component={CTA} durationInFrames={FPS * 5} fps={FPS} width={WIDTH} height={HEIGHT} />
    </>
  );
}
