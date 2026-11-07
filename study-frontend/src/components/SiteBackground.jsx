import ShapeGrid from '../reactbits/ShapeGrid/ShapeGrid';
import SafeEffect from './SafeEffect';
import { usePrefersReducedMotion } from '../lib/motion';

/**
 * One shared Shape Grid behind the authenticated site, at low opacity. It is fixed behind the content and
 * never receives pointer events, so it cannot block controls. Reduced-motion users get a static grid.
 */
export default function SiteBackground() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="site-background" aria-hidden="true">
      <SafeEffect fallback={null}>
        <ShapeGrid shape="square" cellSize={44} speed={reduced ? 0 : 1.0} lineColor="rgba(91,79,207,0.5)"
          hoverColor="rgba(91,79,207,0.0)" direction="diagonal" fillOpacity={0.14} />
      </SafeEffect>
    </div>
  );
}
