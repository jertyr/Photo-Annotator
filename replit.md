# MarkUp - Job Site Photo Annotation App

## Overview
MarkUp is a mobile app designed for remodelers and contractors to capture job site photos and annotate them with voice-dictated notes. The app uses AI to refine rough notes into cleaner, more professional annotations.

## Current State
- **Version**: 1.0.0
- **Stack**: Expo React Native + Express.js backend
- **Status**: Initial build complete

## Key Features
1. **Take Photo**: Capture job site photos directly with the camera
2. **Edit Photo**: Select existing photos from gallery for annotation
3. **Annotation Tools**:
   - Text boxes (opaque white background, readable over photos)
   - Arrows with attached notes
   - Highlight circles (yellow semi-transparent)
4. **AI Text Refinement**: Optional AI cleanup of voice-dictated notes
5. **Save to Gallery**: Annotated photos save directly to device gallery

## Navigation Flow
Stack-only navigation (no tabs):
- Home → Camera → Editor → (saves and returns)
- Home → Edit Photo → Editor → (saves and returns)
- Home → Settings

## Project Architecture

### Frontend (client/)
- `/screens/` - HomeScreen, CameraScreen, EditorScreen, SettingsScreen
- `/components/` - Reusable UI components (Button, Card, ThemedText, etc.)
- `/navigation/` - RootStackNavigator (single stack navigator)
- `/constants/theme.ts` - Design tokens (colors, spacing, typography)
- `/hooks/` - Custom hooks (useTheme, useScreenOptions)

### Backend (server/)
- `/routes.ts` - API endpoints
  - `POST /api/refine-text` - AI text refinement endpoint
  - `GET /api/health` - Health check endpoint

## Design System
- **Primary Color**: Safety Orange (#FF6B35)
- **Background**: Concrete Gray (#F5F5F5)
- **Dark Mode**: Charcoal (#2C2C2C)
- **Touch Targets**: Minimum 48x48pt for gloved use
- **Style**: Bold utilitarian, construction-inspired

## Environment Variables
- `OPENAI_API_KEY` - Required for AI text refinement (optional feature)

## User Preferences
- Voice-to-text uses native phone keyboard (no in-app speech recognition)
- AI refinement is optional per annotation
- Future: Google sign-in for usage tracking and monetization

## Recent Changes
- Initial app creation with camera, editor, and annotation features
- Stack-only navigation (removed tab bar per design guidelines)
- AI text refinement via OpenAI API

## Development Notes
- Camera and media library permissions handled with proper fallbacks
- ViewShot used to capture annotated photos for saving
- Annotations are positioned absolutely over the photo canvas
