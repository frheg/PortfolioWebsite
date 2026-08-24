export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Catppuccin Mocha reskin. Only the shades actually referenced in the
      // codebase are overridden — Tailwind's `extend` merges these into the
      // default palette rather than replacing it, so any shade not listed
      // here still falls back to Tailwind's stock color. Catppuccin itself
      // is a flat ~12-color set, not a light-to-dark ramp, so the lighter
      // shades (50/100) are synthesized by lifting the anchor color's
      // lightness rather than being official Catppuccin swatches.
      colors: {
        slate: {
          100: '#cdd6f4', // text
          200: '#bac2de', // subtext1
          400: '#7f849c', // overlay1
          950: '#11111b', // crust
        },
        // A monochromatic lavender ramp rather than mixing in sky/sapphire —
        // those read as noticeably more saturated/vivid against Catppuccin's
        // otherwise soft, high-lightness palette, so the site's single most
        // visible accent color (this scale, used everywhere) stayed on one
        // consistent, gentle hue instead.
        cyan: {
          50: '#e1e4fa',
          100: '#cbd2fb',
          200: '#b4befe', // lavender
          300: '#94a2f9', // main accent
          400: '#7183f4',
        },
        fuchsia: {
          400: '#cba6f7', // mauve
        },
        amber: {
          100: '#fddac4',
          300: '#fab387', // peach
        },
        red: {
          100: '#f9c8d5',
          300: '#f38ba8', // red
        },
        // Additional single-shade Catppuccin colors, used to break up small
        // labels (eyebrows, badges, status tags) that would otherwise all
        // repeat the same lavender/mauve accent — the site's two heaviest
        // colors are already everywhere in borders and buttons, so detail
        // text is a better place to bring in the rest of the palette.
        teal: { 300: '#94e2d5' },
        green: { 300: '#a6e3a1' },
        sky: { 300: '#89dceb' },
        yellow: { 300: '#f9e2af' },
        pink: { 300: '#f5c2e7' },
        white: '#cdd6f4', // text
        black: '#11111b', // crust
      },
      fontFamily: {
        sans: [
          'Avenir Next',
          'Avenir',
          'Trebuchet MS',
          'Segoe UI',
          'Century Gothic',
          'CenturyGothic',
          'AppleGothic',
          'ui-sans-serif',
          'system-ui',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
        ],
        display: [
          'Avenir Next',
          'Avenir',
          'Trebuchet MS',
          'Segoe UI',
          'Century Gothic',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
