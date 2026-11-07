import ProgressTransition from './ProgressTransition';
import Radar from '../reactbits/Radar/Radar';
import SafeEffect from './SafeEffect';

export default function GameEntry({ gameName, onDone }) {
  return (
    <div className="game-entry">
      <div className="game-entry-bg" aria-hidden="true">
        <SafeEffect fallback={null}>
          <Radar
            color="#5B4FCF"
            backgroundColor="transparent"
            speed={0.8}
            ticks
            ringCount={5}
            spokeCount={10}
          />
        </SafeEffect>
      </div>

      <div className="game-entry-copy">
        <p className="eyebrow">Game zone</p>

        <h2 className="game-entry-title">
          Ready to challenge your mind?
        </h2>

        <ProgressTransition
          label={`Opening ${gameName}…`}
          duration={10000}
          onDone={onDone}
          onSkip={onDone}
        />
      </div>
    </div>
  );
}

