# MarkUp - Mobile Design Guidelines

## 1. Brand Identity

**Purpose**: MarkUp is a field tool for remodelers and contractors to capture job site photos and annotate them instantly with voice-dictated notes refined by AI.

**Aesthetic Direction**: **Bold Utilitarian**
- High-contrast interface optimized for outdoor visibility
- Construction-inspired: think blueprints, safety signage, precision tools
- Brutally efficient: every tap has purpose, zero decoration for decoration's sake
- One-handed operation priority (large touch targets, bottom-weighted actions)

**Memorable Element**: The annotation tools feel like a **digital measuring tape** - precise, reliable, and always within reach. The app's signature is the bright safety-orange accent that pops against neutral grays, evoking job site visibility.

## 2. Navigation Architecture

**Root Navigation**: Stack-Only (with optional auth modal)
- No tabs - this is a focused single-purpose tool
- Linear flow: Home → Camera/Picker → Editor → Save

**Screen List**:
1. **Optional Sign-In** (modal, shown once on first launch)
2. **Home** - Choose capture method
3. **Camera** - Live camera view
4. **Photo Editor** - Annotation workspace
5. **Settings** - Profile, usage stats (future)

## 3. Screen-by-Screen Specifications

### Sign-In Screen (Modal, Optional)
**Purpose**: Future-proof user tracking
**Layout**:
- Centered card on dimmed background
- Logo/app name at top
- "Continue with Google" button (prominent)
- "Skip for now" text link below
- Footer: Privacy & Terms links
**Components**: Single SSO button, text links

### Home Screen
**Purpose**: Quick-launch photo capture or editing
**Layout**:
- Header: transparent, app name left, settings icon right
- Main content (centered vertically):
  - Large "Take Photo" button (primary action, full-width)
  - "Edit Photo" button below (secondary style)
- Safe area: top = headerHeight + Spacing.xl, bottom = insets.bottom + Spacing.xl
**Components**: Two large buttons, minimal text

### Camera Screen
**Purpose**: Capture photo with standard controls
**Layout**:
- Full-screen camera preview
- Header: transparent, back button left, flash toggle right
- Floating shutter button (bottom center, large circle)
- Safe area: bottom = insets.bottom + Spacing.xl for shutter button
**Components**: Camera preview, circular shutter button, header buttons

### Photo Editor Screen
**Purpose**: Add annotations to photo
**Layout**:
- Header: default navigation, "Done" button right (saves to gallery)
- Main: Scrollable canvas with photo and annotations
- Floating toolbar (bottom): 
  - Icon buttons: Text Box, Arrow, Highlight, Undo
  - Buttons have safety-orange background when active tool
- Safe area: bottom = insets.bottom + Spacing.xl
**Components**: 
- Image canvas with touch handlers
- Draggable text boxes (opaque white bg, 70% opacity, rounded corners)
- Arrow tool (draws line with arrowhead, attaches text box at end)
- Highlight tool (semi-transparent yellow overlay, adjustable size)
- Input modal for text entry (appears when placing annotation)

**Text Input Modal**:
- Appears when user taps canvas with text/arrow tool
- Keyboard opens automatically (user uses native voice-to-text)
- "Refine with AI" toggle button above text input
- "Add" and "Cancel" buttons in modal header

### Settings Screen
**Purpose**: Profile, app preferences
**Layout**:
- Header: default navigation
- Scrollable form:
  - User avatar (if signed in) or placeholder
  - Display name field
  - "Usage Stats" row (shows token count if tracking)
  - "Sign Out" button (if signed in)
  - "Privacy Policy" and "Terms" links
- Safe area: top = Spacing.xl, bottom = insets.bottom + Spacing.xl

## 4. Color Palette

**Primary**: Safety Orange `#FF6B35` - Accent for CTAs, active states, construction safety vibe
**Background**: Concrete Gray `#F5F5F5` - Neutral, non-distracting
**Surface**: White `#FFFFFF` - Cards, modals, text boxes
**Surface Dark**: Charcoal `#2C2C2C` - Camera UI, toolbars
**Text Primary**: `#1A1A1A` - High contrast for legibility
**Text Secondary**: `#6B6B6B` - Subtle labels
**Border**: `#E0E0E0` - Dividers, outlines
**Semantic Success**: `#4CAF50`
**Semantic Warning**: Highlight Yellow `#FFD54F` (semi-transparent for highlight tool)

## 5. Typography

**Font**: System default (SF Pro on iOS, Roboto on Android) for maximum legibility in field conditions
**Type Scale**:
- Title: Bold, 28px - Screen headers
- Headline: Bold, 20px - Button labels, section headers
- Body: Regular, 16px - Input fields, annotations
- Caption: Regular, 14px - Helper text, metadata

## 6. Visual Design

**Touch Targets**: Minimum 48x48pt for one-handed use with gloves
**Button Style**: 
- Primary: Safety Orange background, white text, 12px border radius
- Secondary: White background, orange border, orange text
- Icon-only: 48x48pt, subtle background on press
**Floating Toolbar**: Charcoal background, shadow: offset (0, 2), opacity 0.10, radius 2
**Annotation Styles**:
- Text boxes: White background 70% opacity, 8px padding, 6px border radius, black text
- Arrows: 3px stroke, Safety Orange color, arrowhead 12px
- Highlights: Yellow `#FFD54F` at 30% opacity, draggable circle bounds

## 7. Assets to Generate

1. **icon.png** - App icon: Orange toolbox with white "M" or markup symbol
2. **splash-icon.png** - Launch screen: Same as app icon, centered
3. **empty-gallery.png** - Empty state for photo picker: Simple illustration of camera with "No Photos Yet" (WHERE USED: Photo Editor screen when gallery is empty)
4. **avatar-placeholder.png** - Generic hardhat/contractor avatar (WHERE USED: Settings screen for users without sign-in)
5. **onboarding-welcome.png** - Hero illustration: Stylized photo with annotation callouts (WHERE USED: First launch walkthrough if implemented later)

All illustrations use Safety Orange + Charcoal + white color scheme, flat/minimal style.