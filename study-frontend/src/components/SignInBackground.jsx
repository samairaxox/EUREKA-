
import PixelBlast from '../reactbits/PixelBlast/PixelBlast';

export default function SignInBackground() {
  return (
    <div className="signin-background" aria-hidden="true">
      <PixelBlast
        variant="square"
        pixelSize={5}
        color="#9B7ED8"
        accentColor="#D8BFEA"
        patternScale={2}
        patternDensity={1}
        speed={0.5}
        transparent={true}
        edgeFade={0}
        softness={0.6}
        glow={0.5}
        twinkle={0.2}
        drift={0.2}
        hoverEffect="reveal"
        enableRipples={true}
      />
    </div>
  );
}
