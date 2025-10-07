import express from "express";
import cors from "cors";
import { db } from "../../firebase-config.js";
import {
  getDocs,
  collection,
  updateDoc,
  doc,
  serverTimestamp,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { run } from "../utils/agent.js";


// Helper function to auto-generate title from first message
function autoNameFromPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return "New Chat";

  // Take first 50 characters and clean up
  const title = prompt
    .slice(0, 50)
    .trim()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ');

  return title + (prompt.length > 50 ? '...' : '');
}

// Helper function to convert image URL to base64
async function imageUrlToBase64(imageUrl) {
  try {
    let buffer;

    // Check if it's a URL or local file path
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Fetch from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      // Read from local file system
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      // Get the directory of the current module
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Resolve path relative to project root (2 levels up from backend/route/)
      const absolutePath = path.resolve(__dirname, '../../', imageUrl);
      console.log("Resolved image path:", absolutePath);

      buffer = await fs.readFile(absolutePath);
    }

    // Determine media type from URL/path
    const extension = imageUrl.toLowerCase().split('.').pop()?.split('?')[0];
    let mediaType = "image/png";

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
    }

    const base64Data = buffer.toString('base64');

    return {
      base64: base64Data,
      mediaType: mediaType,
      source: imageUrl
    };
  } catch (error) {
    console.error(`Failed to convert image to base64: ${imageUrl}`, error);
    return null;
  }
}

// Configure CORS for frontend
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "IC Project Backend API",
    timestamp: new Date().toISOString()
  });
});

// Background processing function - placeholder for now
async function processClaudeRequest(sessionId, messageId, userQuery, attachments = [], isResume = false) {
  try {
    console.log("> Starting background Claude processing for message:", messageId);
    console.log("=� Attachments:", attachments.length);

    // Get session data for resume functionality
    let existingProviderSessionId = null;

    if (isResume) {
      console.log("= This is a resume request, getting session data...");
      const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        const providerSessionId = sessionData.current?.providerSessionId;

        if (providerSessionId) {
          console.log("= Found existing Claude session ID:", providerSessionId);
          existingProviderSessionId = providerSessionId;
        } else {
          console.log("� No provider session ID found, treating as new session");
        }
      }
    }

    // Track accumulated tool stream log
    let accumulatedToolStream = "";
    let lastUpdateTime = 0;
    const UPDATE_THROTTLE_MS = 2000;
    let pendingUpdate = false;

    // Convert image URLs to base64 and update Firestore
    const processedAttachments = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.url) {
          console.log("Converting image to base64:", att.url);
          const imageData = await imageUrlToBase64(att.url);
          if (imageData) {
            processedAttachments.push({
              url: att.url,
              base64: imageData.base64,
              mediaType: imageData.mediaType,
              type: att.type || "image",
              filename: att.filename || att.url.split('/').pop()
            });
          }
        }
      }

      // Update Firestore with base64 attachments
      if (processedAttachments.length > 0) {
        await updateDoc(doc(db, "messages", messageId), {
          attachments: processedAttachments,
          updatedAt: serverTimestamp()
        });
      }
    }

    // Format message with attachments - pass base64 images to agent
    let messageWithAttachments = userQuery;
    if (processedAttachments.length > 0) {
      messageWithAttachments += "\n\nImages:\n";
      processedAttachments.forEach(att => {
        messageWithAttachments += `[Image: ${att.filename}]\n`;
      });
    }

    // Call Claude Agent SDK with streaming callbacks
    const result = await run(messageWithAttachments, {
      showThinking: true,
      showToolCalls: true,
      streamAssistantText: true,
      resumeSid: existingProviderSessionId,
      newSession: !existingProviderSessionId,
      enableToolStreamLogging: true,
      toolStreamLogDir: "./logs",
      images: processedAttachments,

      // Stream tool log to Firestore assistantStreaming field
      onToolStreamUpdate: async (toolStreamLog) => {
        const toolStreamNow = toolStreamLog || "";
        const toolStreamDelta = toolStreamNow.slice(accumulatedToolStream.length);
        accumulatedToolStream += toolStreamDelta;

        const now = Date.now();
        if (now - lastUpdateTime >= UPDATE_THROTTLE_MS && !pendingUpdate) {
          pendingUpdate = true;
          try {
            await updateDoc(doc(db, "messages", messageId), {
              assistantStreaming: accumulatedToolStream,
              updatedAt: serverTimestamp()
            });
            lastUpdateTime = now;
          } catch (error) {
            console.error("Failed to update tool stream:", error);
          } finally {
            pendingUpdate = false;
          }
        }
      }
    });

    const claudeSessionId = result.sessionId;
    const answer = result.toolStreamLog || accumulatedToolStream;
    const links = []; // WebSearch results would go here

    // Update the session document with Claude session ID
    if (claudeSessionId) {
      await updateDoc(doc(db, "sessions", sessionId), {
        "current.providerSessionId": claudeSessionId,
        "current.updatedAt": serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    // Update message with final response
    const updateData = {
      assistantStreaming: answer,
      status: "done",
      updatedAt: serverTimestamp(),
      finishedAt: serverTimestamp(),
      error: null,
      links: links,
      provider: {
        vendor: "anthropic",
        sessionId: claudeSessionId || "",
        model: "",
        resumeUsed: isResume,
        previousSessionId: existingProviderSessionId
      }
    };

    await updateDoc(doc(db, "messages", messageId), updateData);

    console.log(" Background processing completed for message:", messageId);

  } catch (error) {
    console.error("L Background processing error for message:", messageId, error.message);
    console.error("L Error stack:", error.stack);

    // Update message with error status
    try {
      await updateDoc(doc(db, "messages", messageId), {
        status: "error",
        error: {
          message: error.message,
          code: error.code || "unknown",
          timestamp: new Date().toISOString()
        },
        updatedAt: serverTimestamp(),
        finishedAt: serverTimestamp()
      });
    } catch (updateError) {
      console.error("L Failed to update message with error:", updateError);
    }
  }
}

// POST /chat - Create new session and first message
app.post("/chat", async (req, res) => {
  try {
    const { userQuery, attachments = [] } = req.body;

    if (!userQuery) {
      return res.status(400).json({ error: "userQuery is required" });
    }

    console.log("=� Creating new chat session...");
    console.log("=� User query:", userQuery.slice(0, 100));
    console.log("=� Attachments:", attachments.length);

    // 1. Create the session document
    const sessionRef = await addDoc(collection(db, "sessions"), {
      title: autoNameFromPrompt(userQuery),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessagePreview: userQuery.slice(0, 100),
      ownerUid: "anonymous",
      current: {
        providerSessionId: "",
        model: "claude-sonnet-4-20250514",
        updatedAt: serverTimestamp(),
      },
    });

    // 2. Create the message document
    const messageRef = await addDoc(collection(db, "messages"), {
      sessionId: sessionRef.id,
      ownerUid: "anonymous",
      userQuery,
      assistantStreaming: "",
      status: "processing",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      turnNo: 1,
      error: null,
      attachments: attachments || [],
      links: []
    });

    console.log(" Session created with ID:", sessionRef.id);
    console.log(" Message created with ID:", messageRef.id);

    // 3. Start background processing (don't await)
    processClaudeRequest(sessionRef.id, messageRef.id, userQuery, attachments);

    // 4. Return immediately with document IDs
    res.status(201).json({
      sessionId: sessionRef.id,
      messageId: messageRef.id,
      status: "processing",
      message: "Request is being processed in the background. Check Firestore for real-time updates."
    });

  } catch (error) {
    console.error("L ERROR: Failed to create chat:", error.message);
    console.error("L Error stack:", error.stack);

    res.status(500).json({
      error: "failed_to_create_chat",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /chat/continue - Continue existing session with new message
app.post("/chat/continue", async (req, res) => {
  console.log("=� Received POST request to /chat/continue");

  try {
    const { sessionId, userQuery, attachments = [] } = req.body;

    // Validate required fields
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    if (!userQuery) {
      return res.status(400).json({ error: "userQuery is required" });
    }

    console.log("=Continuing session:", sessionId);
    console.log("=� User query:", userQuery.slice(0, 100));

    // 1. Verify session exists
    const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
    if (!sessionDoc.exists()) {
      console.log("L Session not found:", sessionId);
      return res.status(404).json({
        error: "session_not_found",
        message: "The specified session does not exist"
      });
    }

    // 2. Get the next turn number
    const messagesQuery = query(
      collection(db, "messages"),
      where("sessionId", "==", sessionId),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const messagesSnapshot = await getDocs(messagesQuery);
    let nextTurnNo = 1;

    if (!messagesSnapshot.empty) {
      const lastMessage = messagesSnapshot.docs[0].data();
      nextTurnNo = (lastMessage.turnNo || 0) + 1;
    }

    console.log("= Next turn number:", nextTurnNo);

    // 3. Create the new message document
    const messageRef = await addDoc(collection(db, "messages"), {
      sessionId: sessionId,
      ownerUid: "anonymous",
      userQuery,
      assistantStreaming: "",
      status: "processing",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      turnNo: nextTurnNo,
      error: null,
      attachments: attachments || [],
      links: []
    });

    // 4. Update session with latest message info
    await updateDoc(doc(db, "sessions", sessionId), {
      lastMessagePreview: userQuery.slice(0, 100),
      updatedAt: serverTimestamp()
    });

    console.log(" Message created with ID:", messageRef.id);

    // 5. Start background processing with resume flag
    processClaudeRequest(sessionId, messageRef.id, userQuery, attachments, true);

    // 6. Return immediately
    res.status(201).json({
      sessionId: sessionId,
      messageId: messageRef.id,
      turnNo: nextTurnNo,
      status: "processing",
      message: "Request is being processed in the background. Check Firestore for real-time updates."
    });

  } catch (error) {
    console.error("L ERROR: Failed to continue chat:", error.message);
    console.error("L Error stack:", error.stack);

    res.status(500).json({
      error: "failed_to_continue_chat",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /sessions - List all sessions with metadata
app.get("/sessions", async (req, res) => {
  console.log("=� Received GET request to /sessions");

  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.limit) || 1000;
    const ownerUid = req.query.ownerUid || "anonymous";

    console.log("=� Query params:", { page, pageSize, ownerUid });

    // Build query to get sessions ordered by most recent
    const sessionsQuery = query(
      collection(db, "sessions"),
      where("ownerUid", "==", ownerUid),
      orderBy("updatedAt", "desc"),
      limit(pageSize)
    );

    const sessionsSnapshot = await getDocs(sessionsQuery);

    if (sessionsSnapshot.empty) {
      console.log("=� No sessions found");
      return res.json({
        sessions: [],
        pagination: {
          page,
          pageSize,
          totalCount: 0,
          hasMore: false
        }
      });
    }

    // Process each session and get additional metadata
    console.log("=� Processing", sessionsSnapshot.size, "sessions...");
    const sessionsWithMetadata = await Promise.all(
      sessionsSnapshot.docs.map(async (sessionDoc) => {
        const sessionData = sessionDoc.data();
        const sessionId = sessionDoc.id;

        // Get message count for this session
        const messageCountQuery = query(
          collection(db, "messages"),
          where("sessionId", "==", sessionId)
        );
        const messageCountSnapshot = await getDocs(messageCountQuery);
        const messageCount = messageCountSnapshot.size;

        // Get the latest message for preview
        const latestMessageQuery = query(
          collection(db, "messages"),
          where("sessionId", "==", sessionId),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const latestMessageSnapshot = await getDocs(latestMessageQuery);

        let latestMessage = null;
        if (!latestMessageSnapshot.empty) {
          const messageData = latestMessageSnapshot.docs[0].data();
          latestMessage = {
            id: latestMessageSnapshot.docs[0].id,
            userQuery: messageData.userQuery,
            status: messageData.status,
            turnNo: messageData.turnNo,
            createdAt: messageData.createdAt,
            hasAttachments: (messageData.attachments && messageData.attachments.length > 0)
          };
        }

        // Calculate session duration
        let sessionDuration = null;
        if (messageCount > 1) {
          const firstMessageQuery = query(
            collection(db, "messages"),
            where("sessionId", "==", sessionId),
            orderBy("createdAt", "asc"),
            limit(1)
          );
          const firstMessageSnapshot = await getDocs(firstMessageQuery);

          if (!firstMessageSnapshot.empty && !latestMessageSnapshot.empty) {
            const firstTime = firstMessageSnapshot.docs[0].data().createdAt;
            const lastTime = latestMessageSnapshot.docs[0].data().createdAt;

            if (firstTime && lastTime) {
              sessionDuration = {
                startTime: firstTime,
                endTime: lastTime,
                durationMinutes: Math.round((lastTime.toDate() - firstTime.toDate()) / (1000 * 60))
              };
            }
          }
        }

        return {
          id: sessionId,
          title: sessionData.title,
          createdAt: sessionData.createdAt,
          updatedAt: sessionData.updatedAt,
          lastMessagePreview: sessionData.lastMessagePreview,
          ownerUid: sessionData.ownerUid,
          current: sessionData.current,
          metadata: {
            messageCount,
            sessionDuration,
            hasActiveSession: !!sessionData.current?.providerSessionId
          },
          latestMessage
        };
      })
    );

    console.log(" Successfully processed sessions");

    res.json({
      sessions: sessionsWithMetadata,
      pagination: {
        page,
        pageSize,
        totalCount: sessionsSnapshot.size,
        hasMore: sessionsSnapshot.size === pageSize
      }
    });

  } catch (error) {
    console.error("L ERROR: Failed to fetch sessions:", error.message);
    console.error("L Error stack:", error.stack);

    res.status(500).json({
      error: "failed_to_fetch_sessions",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /sessions/:sessionId - Get specific session with all messages
app.get("/sessions/:sessionId", async (req, res) => {
  console.log("=� Received GET request to /sessions/:sessionId");

  try {
    const { sessionId } = req.params;
    console.log("Fetching session:", sessionId);

    // Get session data
    const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
    if (!sessionDoc.exists()) {
      console.log("L Session not found:", sessionId);
      return res.status(404).json({
        error: "session_not_found",
        message: "The specified session does not exist"
      });
    }

    const sessionData = sessionDoc.data();

    // Get all messages for this session
    console.log("=� Fetching messages for session...");
    const messagesQuery = query(
      collection(db, "messages"),
      where("sessionId", "==", sessionId),
      orderBy("turnNo", "asc")
    );

    const messagesSnapshot = await getDocs(messagesQuery);
    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(" Found", messages.length, "messages");

    // Return complete session with messages
    res.json({
      session: {
        id: sessionId,
        ...sessionData,
        metadata: {
          messageCount: messages.length,
          hasActiveSession: !!sessionData.current?.providerSessionId
        }
      },
      messages
    });

  } catch (error) {
    console.error("L ERROR: Failed to fetch session details:", error.message);
    console.error("L Error stack:", error.stack);

    res.status(500).json({
      error: "failed_to_fetch_session_details",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /search - Search messages by userQuery field
app.get("/search", async (req, res) => {
  console.log("=� Received GET request to /search");

  try {
    const searchTerm = req.query.q || req.query.query || "";
    const ownerUid = req.query.ownerUid || "anonymous";

    if (!searchTerm || typeof searchTerm !== 'string') {
      return res.status(400).json({
        error: "search_term_required",
        message: "Please provide a search term using the 'q' or 'query' parameter"
      });
    }

    console.log("Searching for:", searchTerm);

    // Get all messages for this user
    const messagesQuery = query(
      collection(db, "messages"),
      where("ownerUid", "==", ownerUid)
    );

    const messagesSnapshot = await getDocs(messagesQuery);

    // Filter messages that contain the search term (case-insensitive)
    const searchTermLower = searchTerm.toLowerCase();
    const matchingMessages = [];
    const sessionIds = new Set();

    messagesSnapshot.docs.forEach(doc => {
      const messageData = doc.data();
      const userQuery = messageData.userQuery || "";

      if (userQuery.toLowerCase().includes(searchTermLower)) {
        matchingMessages.push({
          id: doc.id,
          sessionId: messageData.sessionId,
          userQuery: messageData.userQuery,
          status: messageData.status,
          turnNo: messageData.turnNo,
          createdAt: messageData.createdAt,
          hasAttachments: (messageData.attachments && messageData.attachments.length > 0)
        });
        sessionIds.add(messageData.sessionId);
      }
    });

    console.log(` Found ${matchingMessages.length} messages matching "${searchTerm}"`);
    console.log(` Found ${sessionIds.size} unique sessions`);

    // Get session details for all matching sessions
    const sessionsData = [];
    for (const sessionId of sessionIds) {
      try {
        const sessionDoc = await getDoc(doc(db, "sessions", sessionId));
        if (sessionDoc.exists()) {
          const sessionData = sessionDoc.data();

          // Get messages for this session that matched the search
          const sessionMessages = matchingMessages.filter(m => m.sessionId === sessionId);

          sessionsData.push({
            id: sessionId,
            title: sessionData.title,
            createdAt: sessionData.createdAt,
            updatedAt: sessionData.updatedAt,
            lastMessagePreview: sessionData.lastMessagePreview,
            ownerUid: sessionData.ownerUid,
            matchingMessages: sessionMessages,
            matchCount: sessionMessages.length
          });
        }
      } catch (err) {
        console.error(`� Error fetching session ${sessionId}:`, err.message);
      }
    }

    // Sort sessions by most recent
    sessionsData.sort((a, b) => {
      const aTime = a.updatedAt?.toDate() || new Date(0);
      const bTime = b.updatedAt?.toDate() || new Date(0);
      return bTime - aTime;
    });

    res.json({
      searchTerm,
      totalMatches: matchingMessages.length,
      uniqueSessions: sessionIds.size,
      sessions: sessionsData
    });

  } catch (error) {
    console.error("L ERROR: Failed to search messages:", error.message);
    console.error("L Error stack:", error.stack);

    res.status(500).json({
      error: "failed_to_search",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(8000, () => {
  console.log(`=� IC Project Backend server running on port ${PORT}`);
  console.log(`=� API endpoints:`);
  console.log(`   GET  /                     - Health check`);
  console.log(`   POST /chat                 - Create new session`);
  console.log(`   POST /chat/continue        - Continue existing session`);
  console.log(`   GET  /sessions             - List all sessions`);
  console.log(`   GET  /sessions/:sessionId  - Get session details`);
  console.log(`   GET  /search               - Search messages`);
});