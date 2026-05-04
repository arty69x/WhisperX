# Gemini "Bring Anything to Life" - Full Specification

## Overview
This application serves as an interactive sandbox where users can upload any visual artifact (napkin sketch, whiteboard photo, etc.) and use Gemini's multimodal capabilities to generate a fully functional, interactive, single-page HTML application based on the uploaded visual.

## Core Features
1. **Intelligent Artifact Interpretation**: Uses `gemini-3.1-pro-preview` to detect intent from mundane or messy images and turn them into gamified or utilitarian interactive apps.
2. **Real-time Progress Indicator**: Visual progress for file uploads and processing steps.
3. **Advanced Generated HTML Canvas**: 
   - No external images (uses SVGs, Emojis, CSS).
   - Touch/click interactivity, including drag-and-drop.
   - Drawing board features.
   - Undo/Redo capability inside the iframe.
   - Subtle sound effects and animation feedback.
   - Image filters and presets.
4. **App Sandbox Tools (LivePreview)**:
   - Export generated HTML as a standalone file.
   - Export JSON archive.
   - Fullscreen preview.
   - Zoom and Pan the iframe.
5. **Aesthetic & Responsive UI**: Fully responsive, dark luxury/technical hybrid theme with atmospheric styling, supporting mobile-first and desktop-optimized layouts.

## Technical Architecture
- **Frontend**: React 19, TypeScript, Vite.
- **Styling**: Tailwind CSS v4, utilizing Space Grotesk / Inter fonts.
- **State Management**: React Hooks (useState, useEffect, useCallback).
- **Storage**: LocalStorage for persisting creation histories and archives.
- **AI Integration**: `@google/genai` Node.js SDK.

## Capabilities Requested by User (Implemented)
- Drag and drop functionality inside the generated HTML.
- Drawing capabilities (canvas) within generated HTML.
- Layer management & export drawing capabilities inside the generated HTML.
- Zoom & pan functionality for the `iframe` previewer.
- Download generated UI as `index.html`.
- Export all histories to a JSON file.
- Form validation within the generated HTML.
- Subtle sounds, animations, and SVG hover effects inside the generated HTML.
- Undo/Redo inside the generated HTML.
- Responsive, modern "beautiful" design overhaul.

## Future Enhancements
- Integration with external webhooks.
- Multi-user collaboration on a single artifact.
- Cloud persistence for histories.
