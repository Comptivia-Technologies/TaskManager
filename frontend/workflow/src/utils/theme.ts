/**
 * Colour values for the few places that need one as a JavaScript value rather than
 * a Tailwind class — SVG strokes and the react-select theme object. Everything
 * else uses the semantic tokens in tailwind.config.js.
 */
export const BRAND = '#434E78';
export const BRAND_HOVER = '#363F63';
export const BRAND_SUBTLE = '#EEF0F7';
export const BRAND_SOFT = '#DFE3F0';
export const BRAND_BORDER = '#CDD2E3';
export const INK = '#11152A';
export const INK_MUTED = '#474F6B';
export const INK_SUBTLE = '#646B89';
export const LINE = '#E3E6EE';
export const LINE_STRONG = '#CFD4E0';
export const SURFACE_MUTED = '#F8F9FB';

/** Status colours, matching the `success` / `warning` tokens in tailwind.config.js. */
export const SUCCESS = '#067647';
export const SUCCESS_STRONG = '#079455';
export const SUCCESS_SUBTLE = '#ECFDF3';
export const WARNING = '#B54708';
export const WARNING_STRONG = '#DC6803';
export const WHITE = '#FFFFFF';

/**
 * Identity colours for teams in the workflow diagrams.
 *
 * The dataviz reference categorical order, validated with its colour-vision
 * checker (worst adjacent CVD ΔE 9.1, normal-vision 19.6). Three slots sit under
 * 3:1 on white, so a team colour is never the only signal: every lane and chip
 * that carries one also prints the team's name. Slots are handed out in fixed
 * order and never cycled — a ninth team falls back to neutral grey.
 */
export const TEAM_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const TEAM_FALLBACK = '#8A90A8';

/**
 * Colour per team, assigned in the order teams first own a stage. Adjacent lanes
 * in the swimlane therefore get adjacent palette slots, which is the pairing the
 * palette was validated for.
 */
export const teamColors = (stages: { teamId?: string; stageOrder: number }[]): Map<string, string> => {
  const map = new Map<string, string>();
  [...stages]
    .sort((a, b) => a.stageOrder - b.stageOrder)
    .forEach((stage) => {
      const key = stage.teamId ?? '';
      if (!key || map.has(key)) return;
      map.set(key, TEAM_PALETTE[map.size] ?? TEAM_FALLBACK);
    });
  return map;
};

/** Shared react-select styling so its dropdowns match every other control. */
export const selectTheme = (theme: any) => ({
  ...theme,
  borderRadius: 6,
  colors: {
    ...theme.colors,
    primary: BRAND,
    primary75: BRAND,
    primary50: BRAND_SOFT,
    primary25: BRAND_SUBTLE,
    neutral20: LINE_STRONG,
    neutral30: '#A9B0C4',
  },
});

/** react-select `styles` shared by every multi-select, so chips look the same everywhere. */
export const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: 40,
    borderColor: state.isFocused ? BRAND : LINE_STRONG,
    boxShadow: state.isFocused ? '0 0 0 3px rgba(67, 78, 120, 0.22)' : 'none',
    '&:hover': { borderColor: state.isFocused ? BRAND : '#A9B0C4' },
  }),
  multiValue: (base: any) => ({ ...base, backgroundColor: BRAND_SUBTLE, borderRadius: 4 }),
  multiValueLabel: (base: any) => ({ ...base, color: INK, fontWeight: 500, fontSize: 13 }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: INK_SUBTLE,
    '&:hover': { backgroundColor: BRAND_SOFT, color: INK },
  }),
  option: (base: any, state: any) => ({
    ...base,
    fontSize: 14,
    backgroundColor: state.isSelected ? BRAND : state.isFocused ? BRAND_SUBTLE : 'white',
    color: state.isSelected ? 'white' : INK,
  }),
  placeholder: (base: any) => ({ ...base, color: INK_SUBTLE }),
  menu: (base: any) => ({ ...base, zIndex: 20, boxShadow: '0 10px 24px -6px rgba(17, 21, 42, 0.14)' }),
};
