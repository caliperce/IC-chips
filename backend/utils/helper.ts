import * as fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// ============================================================================
// SESSION MANAGEMENT HELPERS
// ============================================================================

const SESSION_STORE = "sessions.json";

export async function loadSession(name: string): Promise<string | null> {
  try {
    const all = JSON.parse(await fs.readFile(SESSION_STORE, "utf8")) as Record<string, string>;
    return all[name] ?? null;
  } catch {
    return null;
  }
}

export async function saveSession(name: string, id: string) {
  let all: Record<string, string> = {};
  try { all = JSON.parse(await fs.readFile(SESSION_STORE, "utf8")); } catch {}
  all[name] = id;
  await fs.writeFile(SESSION_STORE, JSON.stringify(all, null, 2), "utf8");
}

// ============================================================================
// SESSION DIRECTIVE PARSING HELPERS
// ============================================================================

export function parseSessionDirectives(msg: string): {
  name: string | null;
  forceNew: boolean;
  cleaned: string;
} {
  const nameMatch = msg.match(/(^|\n)\s*@session\s*:\s*([A-Za-z0-9._-]{1,100})/i);
  const forceNew = /(^|\n)\s*@new(\b|$)/i.test(msg);
  const name = nameMatch ? nameMatch[2] : null;

  // Strip session directives from the prompt
  let cleaned = msg
    .replace(/(^|\n)\s*@session\s*:[^\n]*\n?/gi, "\n")
    .replace(/(^|\n)\s*@new(\b[^\n]*)?\n?/gi, "\n")
    .trim();

  return { name, forceNew, cleaned };
}

export function autoNameFromPrompt(msg: string): string {
  const firstWords = msg.replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join(" ");
  const slug = firstWords.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "session";
  const ts = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
  return `${slug}-${ts}`;
}

// ============================================================================
// TODO LIST UTILITIES
// ============================================================================

export function printTodos(todos: any[]) {
  if (!Array.isArray(todos) || !todos.length) return;
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const total = todos.length;

  console.log(`\n=== TODO UPDATE (${completed}/${total} done; ${inProgress} in progress) ===`);
  todos.forEach((t: any, i: number) => {
    const icon = t.status === "completed" ? "✅" : t.status === "in_progress" ? "🔧" : "❌";
    const text = t.status === "in_progress" ? t.activeForm : t.content;
    console.log(`${i + 1}. ${icon} ${text}`);
  });
  console.log("=== END TODO UPDATE ===\n");
}

// ============================================================================
// TOOL INPUT FORMATTING HELPERS
// ============================================================================

export function formatToolInput(partialJson: string): string | null {
  try {
    let parsed;
    try {
      parsed = JSON.parse(partialJson);
    } catch {
      // Extract meaningful info from incomplete JSON
      if (partialJson.includes('"command"')) {
        const commandMatch = partialJson.match(/"command"\s*:\s*"([^"]+)"/);
        if (commandMatch) {
          return `🔍 Running: ${commandMatch[1]}`;
        }
      }

      if (partialJson.includes('"pattern"')) {
        const patternMatch = partialJson.match(/"pattern"\s*:\s*"([^"]+)"/);
        if (patternMatch) {
          return `🔍 Searching for: ${patternMatch[1]}`;
        }
      }

      if (partialJson.includes('"content"')) {
        const contentMatch = partialJson.match(/"content"\s*:\s*"([^"]{1,100})/);
        if (contentMatch) {
          return `📝 Working on: ${contentMatch[1]}...`;
        }
      }

      return null;
    }

    // Format based on tool input structure
    if (parsed.command) {
      return `🔍 Running: ${parsed.command}`;
    }

    if (parsed.pattern) {
      return `🔍 Searching for: "${parsed.pattern}"`;
    }

    if (parsed.todos && Array.isArray(parsed.todos)) {
      const activeTask = parsed.todos.find((t: any) => t.status === "in_progress");
      if (activeTask) {
        return `🔧 Working on: ${activeTask.content}`;
      }
      const newTasks = parsed.todos.filter((t: any) => t.status === "pending").length;
      if (newTasks > 0) {
        return `📋 Planning ${newTasks} tasks...`;
      }
    }

    if (parsed.file_path) {
      const fileName = parsed.file_path.split('/').pop();
      if (parsed.content) {
        return `📝 Writing to: ${fileName}`;
      } else {
        return `📖 Reading: ${fileName}`;
      }
    }

    if (parsed.url) {
      return `🌐 Fetching: ${parsed.url}`;
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// IMAGE PROCESSING HELPERS
// ============================================================================

export async function processImageFile(imagePath: string): Promise<{ type: "image"; source: { type: "base64"; media_type: string; data: string } } | null> {
  try {
    let imageBuffer: Buffer;

    // Check if imagePath is a URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // Fetch image from URL
      const response = await fetch(imagePath);
      if (!response.ok) {
        console.error(`❌ Failed to fetch image from URL: ${imagePath}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      // Read local file
      imageBuffer = readFileSync(imagePath);
    }

    // Determine media type based on file extension or URL path
    const extension = imagePath.toLowerCase().split('.').pop()?.split('?')[0]; // Remove query params
    let mediaType = "image/png"; // default

    switch (extension) {
      case 'jpg':
      case 'jpeg':
        mediaType = "image/jpeg";
        break;
      case 'png':
        mediaType = "image/png";
        break;
      case 'gif':
        mediaType = "image/gif";
        break;
      case 'webp':
        mediaType = "image/webp";
        break;
      default:
        console.log(`⚠️ Unknown image format: ${extension}, defaulting to PNG`);
    }

    // Convert to base64
    const base64Data = imageBuffer.toString('base64');

    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data
      }
    };
  } catch (error) {
    console.error(`❌ Error processing image file ${imagePath}:`, error);
    return null;
  }
}

export function parseImageReferences(msg: string): { text: string; imagePaths: string[] } {
  // Look for image references like @image:path/to/image.png
  const imageRegex = /@image:\s*([^\s\n]+)/gi;
  const imagePaths: string[] = [];
  let match;
  
  while ((match = imageRegex.exec(msg)) !== null) {
    imagePaths.push(match[1]);
  }
  
  // Remove image references from the text
  const cleanedText = msg.replace(imageRegex, '').trim();
  
  return { text: cleanedText, imagePaths };
}

// ============================================================================
// MESSAGE CONSTRUCTION HELPERS
// ============================================================================

export const makeUserMessage = async (msg: string, base64Images: any[] = []) => {
  // Parse for image references in text (for backward compatibility)
  const { text, imagePaths } = parseImageReferences(msg);

  // Build content array starting with text
  const content: any[] = [{ type: "text" as const, text }];

  // Add images from base64Images parameter (from server.js)
  if (base64Images && base64Images.length > 0) {
    for (const img of base64Images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType || "image/png",
          data: img.base64
        }
      });
      console.log(`📸 Added base64 image: ${img.filename}`);
    }
  }

  // Add images from @image: references (for backward compatibility)
  for (const imagePath of imagePaths) {
    const imageContent = await processImageFile(imagePath);
    if (imageContent) {
      content.push(imageContent);
      console.log(`📸 Added image from path: ${imagePath}`);
    } else {
      console.log(`❌ Failed to process image: ${imagePath}`);
    }
  }

  return {
    type: "user" as const,
    session_id: randomUUID(),
    parent_tool_use_id: null,
    message: { role: "user" as const, content },
  };
};

