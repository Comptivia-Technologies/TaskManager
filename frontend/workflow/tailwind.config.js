/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // IBM Plex: an engineered face for a contractor's quotation process — site
      // visits, BOQs, supplier prices. Segoe UI stays behind it so a blocked font
      // request degrades to the previous look rather than to Times.
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'Cascadia Code', 'Consolas', 'Courier New', 'monospace'],
      },
      colors: {
        // Semantic tokens. Components reference these, never a raw hex.
        // See design-system/taskmanager/MASTER.md.
        primary: {
          DEFAULT: '#434E78',  // brand; 8.08:1 on white (AAA)
          hover: '#363F63',
          active: '#2B3250',
          subtle: '#EEF0F7',   // selected row / active tab wash
          soft: '#DFE3F0',     // selected chip, current-stage halo
          border: '#CDD2E3',
        },
        // The page plane sits one step below the white working surfaces.
        canvas: '#F4F5F8',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8F9FB',    // table header, inset panels
          sunken: '#EDEFF4',
        },
        ink: {
          DEFAULT: '#11152A',  // primary text
          muted: '#474F6B',    // secondary text; 8.3:1 on white
          subtle: '#646B89',   // metadata; 5.2:1 on white, 4.8:1 on canvas
        },
        line: {
          DEFAULT: '#E3E6EE',
          strong: '#CFD4E0',
          subtle: '#EEF0F5',
        },
        // The navigation shell. Deep ink so the brand navy reads as an accent in
        // the content rather than as a slab of colour down the left edge.
        shell: {
          DEFAULT: '#161A2E',
          raised: '#20253D',
          line: 'rgba(255, 255, 255, 0.08)',
          text: '#B3B9D1',     // 8.9:1 on shell
          muted: '#8990AE',    // 5.3:1 on shell
        },
        danger:  { DEFAULT: '#C9372C', strong: '#B42318', subtle: '#FEF3F2', border: '#FECDCA' },
        success: { DEFAULT: '#067647', strong: '#079455', subtle: '#ECFDF3', border: '#ABEFC6' },
        warning: { DEFAULT: '#B54708', strong: '#DC6803', subtle: '#FFFAEB', border: '#FEDF89' },
        info:    { DEFAULT: '#1D4ED8', subtle: '#EFF6FF', border: '#BFDBFE' },

        // Retained so existing `text-text-muted` style usages keep resolving.
        text: {
          DEFAULT: '#434E78',
          dark: 'rgba(67, 78, 120, 0.8)',
          light: 'rgba(67, 78, 120, 0.6)',
          muted: 'rgba(67, 78, 120, 0.4)',
        },
      },
      // Depth only where it says something: cards barely lift, menus float,
      // dialogs sit clearly above the page.
      boxShadow: {
        'azure-sm': '0 1px 2px 0 rgba(17, 21, 42, 0.05)',
        'azure-md': '0 1px 3px 0 rgba(17, 21, 42, 0.08), 0 1px 2px -1px rgba(17, 21, 42, 0.06)',
        'azure-lg': '0 10px 24px -6px rgba(17, 21, 42, 0.14), 0 2px 6px -2px rgba(17, 21, 42, 0.08)',
        'azure-xl': '0 24px 56px -12px rgba(17, 21, 42, 0.30), 0 6px 16px -6px rgba(17, 21, 42, 0.12)',
        focus: '0 0 0 3px rgba(67, 78, 120, 0.22)',
        'focus-danger': '0 0 0 3px rgba(201, 55, 44, 0.20)',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      // Dense rhythm: this is an internal tool read all day. Body 14/20, never
      // below 12 for anything a person has to read.
      fontSize: {
        'label': ['11px', { lineHeight: '16px', letterSpacing: '0.06em' }],
        'meta': ['12px', { lineHeight: '16px' }],
        'body': ['14px', { lineHeight: '20px' }],
        'title': ['16px', { lineHeight: '24px' }],
        'heading': ['22px', { lineHeight: '28px', letterSpacing: '-0.015em' }],
        'display': ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
      },
      // One radius language: 6px controls, 10px cards, 14px dialogs.
      borderRadius: {
        'azure': '4px',
        'azure-sm': '6px',
        'control': '6px',
        'card': '10px',
        'dialog': '14px',
      },
      maxWidth: {
        page: '1360px',
      },
    },
  },
  plugins: [],
}
