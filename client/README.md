# Climate Data Assistant - Frontend

A beautiful chat interface for the Climate Data Assistant with real-time session management and file preview capabilities.

## 🌟 Features

- **Beautiful Gradient UI**: Inspired by modern chat interfaces with purple-to-orange gradient background
- **Session Management**: Toggle sidebar to view and switch between chat sessions
- **Real-time Updates**: Firebase real-time listeners for live message updates
- **File Attachments**: Preview HTML files in iframe modals, images in image modals, and download other file types
- **Responsive Design**: Optimized for desktop and mobile devices
- **TypeScript**: Fully typed for better development experience

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project configured
- Backend server running on port 3000

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env.local` and update with your Firebase configuration:
   ```bash
   cp .env.example .env.local
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3001` (or another port if 3001 is in use).

## 🏗️ Project Structure

```
client/
├── app/                    # Next.js App Router
│   ├── globals.css        # Global styles and Tailwind CSS
│   ├── layout.tsx         # Root layout component
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # Base UI components
│   │   ├── button.tsx    # Button component
│   │   └── modal.tsx     # Modal component
│   ├── ChatInput.tsx     # Message input component
│   ├── ChatInterface.tsx # Main chat interface
│   ├── FileAttachment.tsx # File preview component
│   ├── MessageBubble.tsx # Message display component
│   └── SessionSidebar.tsx # Session list sidebar
├── lib/
│   └── firebase.ts       # Firebase configuration
├── types/
│   └── index.ts          # TypeScript type definitions
├── utils/
│   ├── api.ts            # API calls to backend
│   ├── cn.ts             # Class name utility
│   └── formatters.ts     # Text/date formatting utilities
└── package.json
```

## 🎨 Design Features

### Gradient Background
The interface uses a beautiful gradient background (`purple-600 → pink-600 → orange-400`) that matches modern chat applications.

### Session Sidebar
- **Toggle Button**: Menu icon in header opens/closes sidebar
- **Session List**: Shows all chat sessions with metadata
- **Real-time Status**: Green dot indicates active sessions
- **Session Preview**: Shows last message preview and message count

### Message Display
- **User Messages**: Blue bubbles aligned to the right
- **Assistant Messages**: Gray bubbles aligned to the left
- **Status Indicators**: Processing spinner, error alerts, success confirmation
- **Markdown Support**: Basic formatting for bold, italic, and code

### File Attachments
- **Automatic Detection**: Extracts URLs from assistant responses
- **File Type Icons**: Visual indicators for different file types
- **Preview Modals**: 
  - HTML files open in iframe
  - Images open in image viewer
  - Other files can be downloaded
- **Click Actions**: Preview or download based on file type

## 🔧 API Integration

The frontend connects to the backend API at `http://localhost:3000` with these endpoints:

- `POST /chat` - Start new chat session
- `POST /chat/continue` - Continue existing session  
- `GET /sessions` - Get all sessions
- `GET /sessions/:id` - Get specific session with messages

## 🔥 Firebase Integration

Uses Firebase Firestore for real-time data:

- **Sessions Collection**: Chat session metadata
- **Messages Collection**: Individual messages with status
- **Real-time Listeners**: Live updates when messages change status

## 🚀 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## 🎯 Usage

1. **Start New Chat**: Type a message in the input field
2. **Continue Chat**: Messages are automatically added to the current session
3. **Switch Sessions**: Click the menu button to open sidebar and select a session
4. **View Files**: Click on file attachments to preview or download
5. **Real-time Updates**: Watch messages update in real-time as the AI processes them

## 🌐 Environment Variables

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 🎨 Customization

### Changing Colors
Edit `app/globals.css` to modify the gradient background:

```css
.bg-gradient-to-br {
  background: linear-gradient(135deg, #your-color-1, #your-color-2, #your-color-3);
}
```

### Adding New File Types
Update the `getFileIcon()` function in `utils/formatters.ts` to support new file types.

## 🐛 Troubleshooting

### Port Already in Use
If port 3001 is in use, Next.js will automatically find an available port.

### Firebase Connection Issues
Verify your Firebase configuration in `.env.local` matches your Firebase project settings.

### Backend Connection
Ensure the backend server is running on port 3000 before starting the frontend.

---

Built with ❤️ using Next.js, TypeScript, Tailwind CSS, and Firebase.