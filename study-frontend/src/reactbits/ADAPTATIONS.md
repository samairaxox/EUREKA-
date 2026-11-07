# React Bits components in this project

All component files are copied unmodified from the React Bits `src/content` variant except where listed.
Source: https://github.com/DavidHDev/react-bits. License: MIT + Commons Clause (see LICENSE.md).

## Dependencies added for the real components
- `motion` (v12): required by CometDial, SwipeRow, SpringCheck, WakeSlider, ThoughtLine, BranchedMenu, MagicBento.
- `@hugeicons/react` and `@hugeicons/core-free-icons`: used by the same components for their icons.
- `gsap` and `@gsap/react`: used by FoldText, AnimatedContent, SplitText.

Earlier compatibility shims for motion and icons have been removed; the real packages are used instead.

## Source edits
| File | Change | Reason |
|---|---|---|
| ShapeGrid/ShapeGrid.jsx | Parenthesised a mixed comparison (`(na >= 0) !== (nb >= 0)`). Behaviour unchanged. | Silences a lint warning in Create React App. |

## Usage adaptations (component source unchanged)
| Component | Adaptation |
|---|---|
| DriftWall | Given EUREKA feature tiles (generated SVG artwork, `landing/featureArtwork.js`) instead of its sample photo URLs. |
| ChromaGrid | Given the six real agent cards (generated SVG artwork, `landing/agentData.js`) instead of its sample photo URLs. |
| CircularCarousel | Given generated per-agent artwork; detail panel shows the active agent. |
| Iridescence, LightTunnel, CometDial, Counter, Crosshair, FoldText, AnimatedContent | Props tuned for the EUREKA palette; source unchanged. |

## Integrated since the last version
SwipeRow (notes), SpringCheck (checklists), GlitchText (Focus heading), Radar (game entry), ShapeGrid (shared site
background and game screens).

## Deliberate substitution
WakeSlider is vendored but not used. It is an interactive slider; the brief's Focus and game transitions are automatic,
so `components/ProgressTransition.jsx` provides an automatic progress transition inspired by its look. It is not a copy
of the Wake Slider.
