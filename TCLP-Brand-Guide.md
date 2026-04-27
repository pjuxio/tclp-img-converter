# TCLP Brand Guide

Brand reference for **The Chisholm Legacy Project** — colors, typography, logo usage, and UI component patterns extracted from the Community Priority Map application.

---

## Logo Assets

Two SVG files are provided. Use them as `<img>` tags or inline SVG.

| File | Dimensions (viewBox) | Use case |
|---|---|---|
| `brand-wordmark.svg` | 728.8 × 317.4 | Desktop headers, full lockup |
| `brand.svg` | 285.6 × 317.4 | Mobile headers, favicons, small spaces |

The wordmark contains the icon mark on the left plus the organization name set in the brand typeface. The icon mark is a custom glyph rendered in the two brand colors below.

**Preferred presentation:** render the logo in natural color over `#f2f2f2`. This is the only approved background for the logo lockup.

**Never** render the logo all-white (e.g. via `filter: brightness(0) invert(1)`) over the plum `#401338` header or any other dark surface. The brand colors — plum and chartreuse — must always be visible. If the surrounding context is dark, place the logo on a `#f2f2f2` container rather than inverting it.

---

## Color Palette

### Brand Colors

| Name | Hex | Usage |
|---|---|---|
| Plum (primary) | `#401338` | Buttons, headings, borders, icon mark |
| Chartreuse (accent) | `#D9E026` | Icon mark accent, highlight elements |
| Plum dark | `#2b0e24` | Deep dark surfaces (tooltips, map chrome) |
| Plum hover | `#5f2251` | Hover state for primary buttons |
| Plum light | `#9a4f8d` | Dark-mode primary accent |

### Neutrals

| Name | Hex | Usage |
|---|---|---|
| Background | `#f2f2f2` | Page background |
| Surface | `#ffffff` | Cards, panels, inputs |
| Text primary | `#333333` | Body text |
| Text secondary | `#666666` | Captions, labels |
| Text muted | `#6b5a66` | Timestamps, meta |
| Border | `rgba(64, 19, 56, 0.2)` | Input and card borders |

### Status / Data Colors

These are used for priority tiers on the map and badges — do not use for general UI chrome.

| Priority | Hex |
|---|---|
| Critical | `#dc2626` (red) |
| High | `#f97316` (orange) |
| Moderate | `#eab308` (yellow) |
| Low | `#22c55e` (green) |

### Dark Mode Overrides

Apply via a `body.dark-mode` class. All values below replace the light-mode equivalents.

| Token | Dark value |
|---|---|
| Background | `#1a1a2e` |
| Surface | `#16213e` |
| Panel | `rgba(22, 33, 62, 0.95)` |
| Text primary | `#e8e8e8` |
| Text secondary | `#a0a0a0` |
| Accent primary | `#9a4f8d` |
| Accent hover | `#b76aa9` |

---

## Typography

### Fonts

```css
/* Headings — load from Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;600;700&display=swap');

/* Body — system stack, no import needed */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
```

### Scale

| Element | Font | Size | Weight |
|---|---|---|---|
| Page title (h1) | Josefin Sans | 2.5rem | 700 |
| Section heading (h2) | Josefin Sans | 1.5rem | 600 |
| Panel heading (h3) | Josefin Sans | 1.15rem | 600 |
| Sidebar label | system | 0.85rem | 600, uppercase, 0.5px letter-spacing |
| Body | system | 0.95rem | 400 |
| Small / caption | system | 0.8rem | 400 |

Headings use `color: #401338`. Sidebar labels use `text-transform: uppercase` with `letter-spacing: 0.5px`.

---

## Buttons

All buttons share these base traits: `font-weight: 600`, `cursor: pointer`, `transition: all 0.2s ease`.

### Primary (filled)

Used for main actions (export, submit).

```css
padding: 8px 16px;
background: #401338;
color: #ffffff;
border: 2px solid #401338;
border-radius: 20px;   /* pill shape */
font-size: 0.85rem;
font-weight: 600;
```

**Hover:** background and border → `#5f2251`  
**Disabled:** `opacity: 0.4; cursor: not-allowed`

### Secondary (outlined)

Used for filter/toggle buttons in their inactive state.

```css
padding: 8px 12px;
background: #ffffff;
color: #666666;
border: 2px solid rgba(64, 19, 56, 0.2);
border-radius: 6px;
font-size: 0.8rem;
font-weight: 600;
```

**Hover:** background → `#f9f5f8`, border → `#401338`  
**Active/selected:** background → `#401338`, color → `#ffffff`, border → `#401338`  
**Active hover:** background → `#5f2251`, border → `#5f2251`

### Destructive (outlined)

Used for clear/reset actions.

```css
padding: 10px 16px;
background: #ffffff;
color: #dc2626;
border: 2px solid #dc2626;
border-radius: 8px;
font-size: 0.85rem;
font-weight: 600;
width: 100%;
```

**Hover:** background → `#dc2626`, color → `#ffffff`  
**Disabled:** `opacity: 0.3; cursor: not-allowed` (hover has no effect)

### Utility (outlined)

Used for secondary utility actions (e.g. reset view).

```css
padding: 10px 16px;
background: #ffffff;
color: #2563eb;
border: 2px solid #2563eb;
border-radius: 8px;
font-size: 0.85rem;
font-weight: 600;
width: 100%;
```

**Hover:** background → `#2563eb`, color → `#ffffff`

### Segmented Toggle (view switcher)

Two buttons joined into a single control.

```css
/* Wrapper */
display: grid;
grid-template-columns: 1fr 1fr;
border: 2px solid rgba(64, 19, 56, 0.2);
border-radius: 8px;
overflow: hidden;
background: #ffffff;

/* Each button */
padding: 10px 12px;
border: none;
background: transparent;
color: #666666;
font-size: 0.85rem;
font-weight: 600;
border-right: 1px solid rgba(64, 19, 56, 0.2); /* removed on last child */

/* Active */
background: #401338;
color: #ffffff;
```

---

## Form Inputs

### Text / Email Input

```css
padding: 10px 12px;
border: 2px solid rgba(64, 19, 56, 0.2);
border-radius: 8px;
font-size: 0.85rem;
background: #ffffff;
color: #333333;
width: 100%;
```

**Focus:** `border-color: #401338; box-shadow: 0 0 0 3px rgba(64, 19, 56, 0.1); outline: none`  
**Placeholder:** `color: #666666`

### Select / Dropdown

Same as text input above. `cursor: pointer`.

---

## Cards / Panels

```css
background: rgba(255, 255, 255, 0.8);
border-radius: 12px;
padding: 20px;
border: 1px solid rgba(255, 255, 255, 0.5);
box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
backdrop-filter: blur(20px);
```

---

## Badges / Tags

### Priority Badge (pill)

```css
display: inline-block;
padding: 4px 10px;
border-radius: 20px;
font-size: 0.75rem;
font-weight: 600;
color: #ffffff;
text-transform: uppercase;
letter-spacing: 0.5px;
background: <priority-color>;  /* see Status Colors above */
```

> Use dark text `#222222` instead of white when background is yellow (`#eab308`).

### Category Tag (chip)

```css
display: inline-block;
padding: 3px 8px;
background: #f0f0f0;
border-radius: 12px;
font-size: 0.75rem;
color: #333333;
white-space: nowrap;
```

---

## Spacing & Shape

| Token | Value |
|---|---|
| Border radius (cards, modals) | `12px` |
| Border radius (buttons, inputs) | `8px` |
| Border radius (pill buttons) | `20px` |
| Focus ring | `0 0 0 3px rgba(64, 19, 56, 0.1)` |
| Mobile touch target minimum | `44px` height |

---

## CSS Custom Properties (copy-paste starter)

```css
:root {
  --accent-primary:   #401338;
  --accent-secondary: #5f2251;
  --accent-deep:      #2b0e24;
  --accent-lime:      #D9E026;

  --bg-primary:    #f2f2f2;
  --bg-secondary:  #ffffff;
  --bg-panel:      rgba(255, 255, 255, 0.8);

  --text-primary:   #333333;
  --text-secondary: #666666;
  --text-muted:     #6b5a66;

  --border-color:  rgba(64, 19, 56, 0.2);
  --border-light:  rgba(255, 255, 255, 0.5);
  --shadow-color:  rgba(0, 0, 0, 0.15);
  --hover-bg:      #f9f5f8;

  --font-heading: 'Josefin Sans', sans-serif;
  --font-body:    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```
