# MarkUp - Job Site Photo Annotation App

## Overview
MarkUp is a mobile app designed for remodelers and contractors to capture job site photos and annotate them with voice-dictated notes. The app uses AI to analyze photos and intelligently place annotations based on natural language descriptions.

## Current State
- **Version**: 1.1.0
- **Stack**: Expo React Native + Express.js backend
- **Status**: AI-powered markup complete

## Key Features
1. **Take Photo**: Capture job site photos directly with the camera
2. **Edit Photo**: Select existing photos from gallery for annotation
3. **AI-Powered Markup**: Describe what you want to mark in natural language
   - "Draw an arrow pointing to the water damage"
   - "Highlight the cracked tile in the corner"
   - "Add a note about the electrical outlet"
4. **Annotation Types** (AI-determined):
   - Text boxes with orange left border
   - Arrows with attached notes
   - Highlight circles (yellow semi-transparent)
5. **Save to Gallery**: Annotated photos save directly to device gallery

## How It Works
1. Take or select a photo
2. Describe the markup you want (use voice-to-text on your keyboard)
3. AI analyzes the photo and your description using GPT-4o vision
4. Annotations are placed at the correct locations automatically
5. Save and return to home

## Navigation Flow
Stack-only navigation (no tabs):
- Home → Camera → Editor → (saves and returns to home)
- Home → Edit Photo → Editor → (saves and returns to home)
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
  - `POST /api/analyze-markup` - Vision AI markup analysis (GPT-4o)
  - `POST /api/refine-text` - AI text refinement endpoint
  - `GET /api/health` - Health check endpoint

## Design System
- **Primary Color**: Safety Orange (#FF6B35)
- **Background**: Concrete Gray (#F5F5F5)
- **Dark Mode**: Charcoal (#2C2C2C)
- **Touch Targets**: Minimum 48x48pt for gloved use
- **Style**: Bold utilitarian, construction-inspired

## Environment Variables
- Uses Replit AI Integrations (no API key required)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-configured
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-configured

## User Preferences
- Voice-to-text uses native phone keyboard (no in-app speech recognition)
- AI determines annotation type and placement based on description
- Future: Google sign-in for usage tracking and monetization

## Recent Changes
- Added AI-powered vision markup using GPT-4o
- User describes markup in natural language, AI places annotations
- Integrated Replit AI Integrations for OpenAI access
- Updated save flow to return directly to home screen
- Platform-specific image handling for web and native

## Development Notes
- Camera and media library permissions handled with proper fallbacks
- ViewShot used to capture annotated photos for saving
- Annotations are positioned based on AI analysis of the photo
- Web platform uses fetch/blob for base64 conversion
- Native platform uses expo-file-system
