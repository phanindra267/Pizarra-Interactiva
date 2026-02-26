# CollabBoard Enterprise 🚀

A high-performance, real-time collaborative whiteboard platform built for enterprise teams.

## ✨ Key Features
- **Infinite Canvas**: Matrix-based transformation for ultra-smooth panning and zooming.
- **Real-time Collaboration**: Delta-sync technology with sub-50ms cursor latency.
- **Secure Authentication**: Google OAuth 2.0 with HTTP-only cookie session management.
- **Multi-modal Communication**: Integrated chat with reactions and WebRTC screen sharing.
- **Session Replay**: Record whiteboard sessions and export them as high-quality MP4/WebM videos.
- **Enterprise Security**: Hardened with Helmet, XSS protection, and Rate Limiting.

## 🛠️ Technology Stack
- **Frontend**: React, Vite, Socket.io-client, PeerJS, Vanilla CSS.
- **Backend**: Node.js, Express, Socket.io, MongoDB, Passport.js.
- **Security**: JWT (Secure Cookies), Helmet, express-mongo-sanitize, hpp, xss-clean.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas or local instance

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Configure `.env` in the `backend` folder:
   ```env
   PORT=5000
   MONGODB_URI=your_mongo_uri
   JWT_SECRET=your_secret
   CLIENT_URL=http://localhost:3000
   GOOGLE_CLIENT_ID=your_id
   GOOGLE_CLIENT_SECRET=your_secret
   ```
4. Run in development:
   ```bash
   # Backend
   npm run dev
   # Frontend
   npm run dev
   ```

## 📜 API Documentation

### Auth
- `POST /api/auth/register` - Create new user.
- `POST /api/auth/login` - Authenticate & set cookies.
- `GET /api/auth/google` - Initiate Google OAuth.
- `POST /api/auth/logout` - Clear session.
- `GET /api/auth/me` - Get current user profile.

### Rooms
- `POST /api/rooms` - Create a new room.
- `GET /api/rooms/:roomId` - Fetch room details.
- `POST /api/rooms/:roomId/versions` - Snapshot current state.

### Files
- `POST /api/files/:roomId` - Upload file to local storage.
- `GET /api/files/:roomId` - List shared files.

## 🛡️ License
Proprietary - Developed for Phani.
