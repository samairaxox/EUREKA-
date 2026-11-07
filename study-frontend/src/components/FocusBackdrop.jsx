/*FocusBackdrop.jsx*/
import GridScan from '../reactbits/GridScan/GridScan';
import SafeEffect from './SafeEffect';
import { usePrefersReducedMotion } from '../lib/motion';

/**
 * React Bits Grid Scan behind Focus Mode only. Camera and motion-sensor features are disabled explicitly,
 * so the browser never asks for permission to use them.
 */
export default function FocusBackdrop() {
  const reduced = usePrefersReducedMotion();
  const fallback = <div className="focus-backdrop-fallback" aria-hidden="true" />;
  return (
    <div className="focus-backdrop" aria-hidden="true">
      <SafeEffect fallback={fallback}>
        <GridScan
          linesColor="#7C6BD0"
          scanColor="#5B4FCF"
          glow={0.9}
          lineThickness={2}
          autoScan={!reduced}
          interactive={false}
          enableWebcam={false}
          enableGyro={false}
          lightMode
        />
      </SafeEffect>
    </div>
  );
}
