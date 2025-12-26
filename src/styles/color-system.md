# Site Color System

This document describes the unified color system used throughout the site.

## Color Variables

All colors are defined as CSS variables in `index.css`:

- `--color-purple`: rgb(94, 76, 176)
- `--color-yellow`: rgb(245, 206, 69)
- `--color-pink`: rgb(235, 84, 151)
- `--color-green`: rgb(51, 193, 91)
- `--color-blue`: rgb(113, 187, 233)

## Usage

### Text Colors
- `.text-purple` - Purple text
- `.text-yellow` - Yellow text
- `.text-pink` - Pink text
- `.text-green` - Green text
- `.text-blue` - Blue text
- `.text-blue-glow` - Blue text with glow effect

### Border Colors
- `.border-purple` - Purple border
- `.border-yellow` - Yellow border
- `.border-pink` - Pink border
- `.border-green` - Green border
- `.border-blue` - Blue border
- `.border-blue-glow` - Blue border with glow effect

### Background Colors
- `.bg-purple` - Purple background
- `.bg-yellow` - Yellow background
- `.bg-pink` - Pink background
- `.bg-green` - Green background
- `.bg-blue` - Blue background

### Transparent Backgrounds
- `.bg-purple-transparent` - Purple background with 10% opacity
- `.bg-yellow-transparent` - Yellow background with 10% opacity
- `.bg-pink-transparent` - Pink background with 10% opacity
- `.bg-green-transparent` - Green background with 10% opacity
- `.bg-blue-transparent` - Blue background with 10% opacity

## Changing Site Colors

To change any color site-wide, simply update the CSS variable in `index.css`:

```css
:root {
  --color-purple: rgb(94, 76, 176); /* Change this value */
  /* ... */
}
```

All components using the utility classes or CSS variables will automatically update.

