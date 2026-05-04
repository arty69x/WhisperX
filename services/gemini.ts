/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Using gemini-2.5-pro for complex coding tasks.
const GEMINI_MODEL = 'gemini-3-pro-preview';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are an expert AI Engineer and Product Designer specializing in "bringing artifacts to life" as WhisperX.
Your goal is to take a user uploaded file—which might be a polished UI design, a messy napkin sketch, a photo of a whiteboard with jumbled notes, or a picture of a real-world object (like a messy desk)—and instantly generate a fully functional, interactive, single-page HTML/JS/CSS application.

CORE DIRECTIVES:
1. **Analyze & Abstract**: Look at the image.
    - **Sketches/Wireframes**: Detect buttons, inputs, and layout. Turn them into a production-grade UI.
    - **Real-World Photos (Mundane Objects)**: Gamify it or build a utility around it.

2. **NO EXTERNAL IMAGES**:
    - **CRITICAL**: Do NOT use <img src="..."> with external URLs.
    - **INSTEAD**: Use **CSS shapes**, **inline SVGs**, **Emojis**, or **CSS gradients**.

3. **MANDATORY INTERACTIVE FEATURES (MUST IMPLEMENT ALL SYSTEMS)**:
    - **Platform-Specific UX/UI Paradigms**: Generate TWO distinct structural designs using CSS media queries within the same HTML. 1 explicitly for Desktop (e.g., sidebars, multi-column bento grids, hover-states, dense data views) and 1 explicitly for Mobile (e.g., bottom navigation bars, full-screen modals, swipeable cards, large touch targets). Do NOT just scale down the desktop view; architect unique UX patterns for each platform.
    - **Accessibility (a11y) & ARIA**: Review the generated HTML and add necessary ARIA roles, states, and properties to all interactive elements (buttons, forms, navigation). Ensure proper focus management and full keyboard navigation compatibility for all interactive flows, including keyboard-accessible drag-and-drop.
    - **Full Node Elements & Visual Architecture**: Implement advanced UI systems using deeply nested, styled HTML nodes, complex CSS Grid/Flexbox layouts, and fully polished aesthetic. Build scalable DOM structures.
    - **Atomic Node Element Interaction**: Architect the DOM into deeply reactive atomic components. Connect elements securely so that state shifts or interactions on one node instantaneously cascade to connected sibling/parent systems.
    - **Interactive Visualization & Data Mapping**: Integrate intense interactive data visualizations (e.g., live node graphs, morphing charts, or physics-based data views) using D3 (via CDN) or high-performance canvas/SVG. Ensure full integration where variables sync across the entire visual layout.
    - **Advanced SVG Vector Motion & Physics**: Leverage advanced SVG vector motion, path tracing, morphing geometries, and physics-driven spring animations to make every line, chart, and illustration feel alive.
    - **Advanced System Operations**: Upgrade functionality to include advanced structural logic (simulation engines, real-time data filtering pipelines, predictive search arrays, algorithmic pathfinding) entirely managed client-side. Implement a polished command bus uniting all systems for seamless data flow.
    - **Tooltips & Guidance**: Add elegant tooltips to key interactive elements to provide additional context and guidance to the user.
    - **Content Loading States**: Add sophisticated loading states, shimmer effects, or skeleton screens for dynamic content blocks to improve perceived performance.
    - **Advanced Interactive Controls**: Enhance the UI with complex interactive elements such as sliders, toggles, and carousels for improved user engagement.
    - **Custom Cursor & WhisperX Animations**: Implement a custom cursor that changes appearance based on user interaction (e.g., hover, drag). Review and refine all SVG and UI animations to ensure they are highly performant (using CSS transforms/opacity), consistent with a high-tech 'WhisperX' theme, and provide meaningful visual feedback.
    - **Drag-and-Drop functionality**: Add fluid drag-and-drop functionality for elements representing distinct components or data points. Ensure smooth transition animations during drag operations, clear visual indicators for drop targets, responsive feedback upon placement/cancellation, and keyboard navigation support.
    - **Image & Content Filtering**: Implement dynamic visual filtering (grayscale, sepia, brightness, contrast) on the generated layout. Provide UI controls and options to save/load these presets.
    - **State Management (Undo/Redo)**: Implement a robust Command Pattern or history array in Javascript to provide universal Undo/Redo functionality covering typing in forms, modifying elements, and major user actions. Ensure the system provides clear visual/audio feedback when actions are undone or redone.
    - **Audio Feedback**: Use the Web Audio API to create a lightweight synthesizer string providing subtle, real-time sound feedback for clicks, button presses, animation completions, and form validation events. Sounds must be light and enhance UX without being intrusive. DO NOT use external audio assets.
    - **Validation & Real-time Errors**: Form inputs must have immediate, real-time visual (shaking input, red/green glowing fields, dynamic helper texts) and sound feedback indicating validation state for input errors.

4. **Self-Contained & Modern**: The output must be a single HTML file with embedded CSS (<style>) and JavaScript (<script>). Use Tailwind CSS via CDN. Ensure modern cohesive styling, responsiveness (desktop and mobile), and subtle animations. Integrate libraries like localforage, d3, or framer-motion via CDN if it significantly upgrades the output. Ensure accessibility (ARIA).

RESPONSE FORMAT:
Return ONLY the raw HTML code. Do not wrap it in markdown code blocks (\`\`\`html ... \`\`\`). Start immediately with <!DOCTYPE html>.`;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      const is503 = error?.status === 503 || error?.message?.includes("503") || error?.message?.includes("Currently experiencing high demand");
      if (is503 && attempt < MAX_RETRIES) {
        console.warn(`Gemini API 503 error, retrying attempt ${attempt} of ${MAX_RETRIES} in ${RETRY_DELAY_MS}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt)); // Exponential backoff based on attempt
      } else {
        throw error;
      }
    }
  }
}

export async function bringToLife(prompt: string, fileBase64?: string, mimeType?: string): Promise<string> {
  const parts: any[] = [];
  
  // Strong directive for file-only inputs with emphasis on NO external images
  const finalPrompt = fileBase64 
    ? "Analyze this image/document. Detect what functionality is implied. If it is a real-world object (like a desk), gamify it (e.g., a cleanup game). Build a fully interactive web app. IMPORTANT: Do NOT use external image URLs. Recreate the visuals using CSS, SVGs, or Emojis." 
    : prompt || "Create a demo app that shows off your capabilities.";

  parts.push({ text: finalPrompt });

  if (fileBase64 && mimeType) {
    parts.push({
      inlineData: {
        data: fileBase64,
        mimeType: mimeType,
      },
    });
  }

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: parts
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.5, // Higher temperature for more creativity with mundane inputs
      },
    }));

    let text = response.text || "<!-- Failed to generate content -->";

    // Cleanup if the model still included markdown fences despite instructions
    text = text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');

    return text;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    const errorMessage = error?.message || "An unknown error occurred during generation.";
    throw new Error(`AI Generation Failed: ${errorMessage}`);
  }
}

export async function refineCode(prompt: string, code: string): Promise<string> {
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          { text: `You are an expert AI Engineer. Consider the following code:\n\n\`\`\`html\n${code}\n\`\`\`\n\nThe user requests the following refinement: "${prompt}".\n\nReturn the ENTIRE updated HTML code, do not output explanations, only return the updated raw HTML code.` }
        ]
      },
      config: {
        systemInstruction: "You are an expert at HTML/JS/CSS manipulation. Output only code without markdown block quotes.",
        temperature: 0.2, 
      },
    }));

    let text = response.text || "";
    text = text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
    return text;
  } catch (error: any) {
    console.error("Gemini Refinement Error:", error);
    const errorMessage = error?.message || "An unknown error occurred during code refinement.";
    throw new Error(`AI Refinement Failed: ${errorMessage}`);
  }
}

export async function refineSnippet(prompt: string, codeSnippet: string): Promise<string> {
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          { text: `You are an expert AI Engineer. Consider the following code snippet:\n\n\`\`\`html\n${codeSnippet}\n\`\`\`\n\nThe user requests the following refinement for this specific snippet: "${prompt}".\n\nReturn ONLY the updated code snippet. Do not include the rest of the file. Do not output explanations, only return the updated raw code snippet.` }
        ]
      },
      config: {
        systemInstruction: "You are an expert at HTML/JS/CSS manipulation. Output only the requested code snippet without markdown block quotes.",
        temperature: 0.2, 
      },
    }));

    let text = response.text || "";
    text = text.replace(/^```[a-z]*\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
    return text.trim();
  } catch (error: any) {
    console.error("Gemini Snippet Refinement Error:", error);
    const errorMessage = error?.message || "An unknown error occurred during snippet refinement.";
    throw new Error(`AI Snippet Refinement Failed: ${errorMessage}`);
  }
}

export async function explainCode(code: string): Promise<string> {
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          { text: `You are an expert AI Engineer. Explain the following code concisely:\n\n\`\`\`html\n${code}\n\`\`\`` }
        ]
      },
      config: {
        systemInstruction: "You are an expert at explaining HTML/JS/CSS concisely and clearly.",
        temperature: 0.2, 
      },
    }));
    return response.text || "No explanation provided.";
  } catch (error: any) {
    console.error("Gemini Explanation Error:", error);
    const errorMessage = error?.message || "An unknown error occurred during code explanation.";
    throw new Error(`AI Explanation Failed: ${errorMessage}`);
  }
}

export async function analyzeElement(elementData: any): Promise<string> {
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          { text: `You are an expert web accessibility and semantics inspector. Analyze the following element properties and suggest improvements for a11y, ARIA, and semantics:\n\n${JSON.stringify(elementData, null, 2)}` }
        ]
      },
      config: {
        systemInstruction: "Provide concise, bullet-pointed insights and suggestions for HTML elements focusing on accessibility and semantic meaning. Keep it under 100 words.",
        temperature: 0.2, 
      },
    }));
    return response.text || "No insights provided.";
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    const errorMessage = error?.message || "An unknown error occurred during element analysis.";
    throw new Error(`AI Analysis Failed: ${errorMessage}`);
  }
}