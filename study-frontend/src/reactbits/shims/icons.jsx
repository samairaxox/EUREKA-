/**
 * Small inline-SVG icon set standing in for @hugeicons/react and @hugeicons/core-free-icons.
 * The React Bits components call HugeiconsIcon with an icon component; these components match that call
 * shape. The glyphs are simple generic line icons, not the Hugeicons artwork. Brand logos are not reproduced.
 */
const make = paths => function Icon({ size = 16, strokeWidth = 2, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden="true" focusable="false">
      {paths}
    </svg>
  );
};

const sparkle = <path d="M12 3l1.8 4.9L19 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />;
const chevron = <path d="M6 9l6 6 6-6" />;
const tick = <path d="M5 12.5l4.2 4.2L19 7" />;
const circle = <circle cx="12" cy="12" r="7" />;
const square = <rect x="5" y="5" width="14" height="14" rx="3" />;
const pointer = <path d="M6 4l12 7-5 1.5L11 18z" />;
const download = <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />;
const rocket = <path d="M12 3c3 2 4 5 4 9l-4 4-4-4c0-4 1-7 4-9zM8 14l-3 3m11-3l3 3" />;
const gear = <path d="M12 9a3 3 0 100 6 3 3 0 000-6zm0-5v3m0 12v3M4 12h3m10 0h3" />;
const paint = <path d="M5 19c3 0 4-2 4-4 0-2 2-3 4-3s4 1 4 3c0 2 2 4 3 4" />;
const text = <path d="M5 6h14M12 6v13" />;
const layers = <path d="M12 4l8 4-8 4-8-4zm-8 8l8 4 8-4" />;
const bell = <path d="M7 16V11a5 5 0 0110 0v5l2 2H5zm3 3a2 2 0 004 0" />;
const key = <path d="M14 10a4 4 0 11-2.8-3.8L20 6v3l-2 2v2h-2v-2" />;
const branch = <path d="M7 4v12M7 16a3 3 0 103 3M17 4a3 3 0 110 6 3 3 0 010-6zm0 6c0 3-5 3-10 6" />;
const fingerprint = <path d="M9 6a6 6 0 0112 0v3M6 12a6 6 0 0112-1M8 21c.8-2 1-4 1-7 0-2 2-3 3-3s3 1 3 3" />;

export const SparklesIcon = make(sparkle);
export const ArrowDown01Icon = make(chevron);
export const Tick02Icon = make(tick);
export const CursorPointer01Icon = make(pointer);
export const Download04Icon = make(download);
export const Layers01Icon = make(layers);
export const Notification03Icon = make(bell);
export const PaintBoardIcon = make(paint);
export const Rocket01Icon = make(rocket);
export const Settings02Icon = make(gear);
export const TextFontIcon = make(text);
export const FigmaIcon = make(square);
export const FingerPrintIcon = make(fingerprint);
export const GitBranchIcon = make(branch);
export const GithubIcon = make(circle);
export const Key01Icon = make(key);
export const NotionIcon = make(square);
export const SlackIcon = make(circle);

export function HugeiconsIcon({ icon: Icon, size = 16, strokeWidth = 2, ...rest }) {
  return <Icon size={size} strokeWidth={strokeWidth} {...rest} />;
}
