window.MSE_PALETTES = [
  { id: 'teal', name: 'Teal (current)', note: 'Clinical, calm. Sits close to the green series colour.',
    light: { plane: '#f3f5f3', surface: '#ffffff', surface2: '#f6f8f6', surface3: '#eef2ef', accent: '#0f766e', accentInk: '#ffffff', accentSoft: '#e2f1ee', accentText: '#0b5e58' },
    dark: { plane: '#0f1412', surface: '#171d1a', surface2: '#1d2420', surface3: '#232b27', accent: '#2fb5a5', accentInk: '#0b1512', accentSoft: '#163a35', accentText: '#6ad3c6' } },
  { id: 'indigo', name: 'Indigo on slate', note: 'Cool, analytical. Reads as a data product.',
    light: { plane: '#f4f5f9', surface: '#ffffff', surface2: '#f7f8fc', surface3: '#eef0f7', accent: '#4f46e5', accentInk: '#ffffff', accentSoft: '#e7e6fb', accentText: '#3730a3' },
    dark: { plane: '#0f1117', surface: '#171a24', surface2: '#1d212c', surface3: '#242935', accent: '#8b84f5', accentInk: '#0f1117', accentSoft: '#2a2860', accentText: '#b4affa' } },
  { id: 'blue', name: 'Programme blue', note: 'Institutional. The blue of health-programme reports.',
    light: { plane: '#f3f6fa', surface: '#ffffff', surface2: '#f6f9fd', surface3: '#eaf0f8', accent: '#1d4ed8', accentInk: '#ffffff', accentSoft: '#e0e9fb', accentText: '#1e3a8a' },
    dark: { plane: '#0d1219', surface: '#151c26', surface2: '#1b232f', surface3: '#222c3a', accent: '#6ea0ff', accentInk: '#0d1219', accentSoft: '#1b3466', accentText: '#a7c3ff' } },
  { id: 'forest', name: 'Forest and clay', note: 'Warm neutrals, deep green. Field rather than lab.',
    light: { plane: '#f5f4ef', surface: '#ffffff', surface2: '#f8f7f2', surface3: '#efede5', accent: '#3f6f3a', accentInk: '#ffffff', accentSoft: '#e3eedf', accentText: '#2f5a2b' },
    dark: { plane: '#13140f', surface: '#1b1d16', surface2: '#21241b', surface3: '#292c21', accent: '#8bc47f', accentInk: '#13140f', accentSoft: '#243a21', accentText: '#b7dfae' } },
  { id: 'plum', name: 'Plum', note: 'Distinct from every series colour. Quiet but not corporate.',
    light: { plane: '#f6f4f7', surface: '#ffffff', surface2: '#f9f7fa', surface3: '#f0ecf3', accent: '#7c3a8d', accentInk: '#ffffff', accentSoft: '#f1e4f4', accentText: '#5f2b6d' },
    dark: { plane: '#13101a', surface: '#1b1623', surface2: '#221c2b', surface3: '#2a2334', accent: '#c58ad3', accentInk: '#13101a', accentSoft: '#3a2446', accentText: '#dfb6ea' } },
  { id: 'ramp', name: 'Map blue', note: 'The blue ramp of the county map, used as the accent. Chosen 23 Oct.',
    light: { plane: '#f3f6fa', surface: '#ffffff', surface2: '#f6f9fd', surface3: '#e9f0f9', accent: '#256abf', accentInk: '#ffffff', accentSoft: '#dceafb', accentText: '#0d366b' },
    dark: { plane: '#0c1420', surface: '#131d2b', surface2: '#192434', surface3: '#1f2c3f', accent: '#5598e7', accentInk: '#0c1420', accentSoft: '#15325a', accentText: '#9ec5f4' } },
  { id: 'ink', name: 'Ink and amber', note: 'Near-black accent, amber for emphasis. The most editorial.',
    light: { plane: '#f5f5f3', surface: '#ffffff', surface2: '#f8f8f6', surface3: '#efefeb', accent: '#1f2937', accentInk: '#ffffff', accentSoft: '#e8eaee', accentText: '#111827' },
    dark: { plane: '#111214', surface: '#191b1f', surface2: '#1f2227', surface3: '#272a30', accent: '#f0b429', accentInk: '#111214', accentSoft: '#3a2f10', accentText: '#f6c95a' } },
];
window.MSE_PALETTE_CSS = function () {
  const v = (p) => '--plane:' + p.plane + ';--surface:' + p.surface + ';--surface-2:' + p.surface2 + ';--surface-3:' + p.surface3 + ';--accent:' + p.accent + ';--accent-ink:' + p.accentInk + ';--accent-soft:' + p.accentSoft + ';--accent-text:' + p.accentText + ';';
  return window.MSE_PALETTES.filter(p => p.id !== 'teal').map(p => ':root[data-palette="' + p.id + '"]{' + v(p.light) + '}\n@media (prefers-color-scheme: dark){:root[data-palette="' + p.id + '"]:not([data-theme="light"]){' + v(p.dark) + '}}\n:root[data-palette="' + p.id + '"][data-theme="dark"]{' + v(p.dark) + '}').join('\n');
};
