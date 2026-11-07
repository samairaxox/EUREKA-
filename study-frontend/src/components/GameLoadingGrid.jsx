/*study-frontend>src>components>GameLoadingGrind.jsx*/
import ShapeGrid from '../reactbits/ShapeGrid/ShapeGrid';
import SafeEffect from './SafeEffect';

/**
 * Rainbow Shape Grid shown only while a game's questions are being requested. It is unmounted when
 * loading finishes, and a plain message is shown if the canvas cannot render.
 */
export default function GameLoadingGrid({ active, label = 'Getting your questions…' }) {
  if (!active) return null;
  const fallback = <div className="game-loading-fallback" role="status">{label}</div>;
  return (
    <div className="game-loading" role="status" aria-live="polite" aria-busy="true">
      <SafeEffect fallback={fallback}>
        <div className="game-loading-canvas" aria-hidden="true">
          <ShapeGrid shape="square" rainbow speed={0.6} cellSize={44} lineColor="rgba(43,38,64,0.12)" hoverColor="#5B4FCF" />
        </div>
      </SafeEffect>
      <span className="game-loading-label">{label}</span>
    </div>
  );
}
