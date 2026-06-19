# Spyder
Spyder is a full-stack cyber security web application with AI-assisted analysis, malware scanning, threat intelligence lookups, NSFW image moderation, and user authentication.

This repository contains:
- A React + Vite frontend in `Frontend/`
- A Node.js + Express backend in `Backend/`

## Live Deployment

- **Frontend Application**: [https://spyder-frontend.onrender.com/](https://spyder-frontend.onrender.com/)
- **Backend API**: [https://spyder-backend.onrender.com](https://spyder-backend.onrender.com)


## Features

- AI chat assistant for security-related guidance
- File scanning using VirusTotal
- Threat intelligence scans for IP, domain, URL, and file hash
- NSFW image moderation endpoint
- Authentication with JWT (signup, login, protected routes)
- User settings update support (name, username, password)
- Light and dark UI theme support

## Tech Stack

Frontend:
- React 18
- Vite
- Tailwind CSS
- NextUI
- React Router
- Axios

Backend:
- Node.js
- Express
- MongoDB + Mongoose
- JWT + bcrypt
- Multer
- Axios

External services:
- Groq API (chat analysis)
- VirusTotal API (file + IOC threat intelligence)

## Project Structure

```text
Spyder/
  Backend/
    config/
    middleware/
    models/
    routes/
    utils/
    index.js
    fileScan.js
    threatIntel.js
    .env.example
  Frontend/
    src/
      Components/
      Contexts/
      Layouts/
      Pages/
    index.html
    vite.config.js
  README.md
```

## Prerequisites

- Node.js 18+ recommended
- npm
- MongoDB database URI
- Groq API key
- VirusTotal API key

## Local Setup

1. Clone the repository.

2. Install backend dependencies:

```bash
cd Backend
npm install
```

3. Install frontend dependencies:

```bash
cd ../Frontend
npm install
```

4. Create backend environment file:

```bash
cd ../Backend
copy .env.example .env
```

5. Fill required values in `Backend/.env`.

6. Start backend server:

```bash
npm start
```

7. In a new terminal, start frontend dev server:

```bash
cd Frontend
npm run dev
```

Default local URLs:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Environment Variables

Use `Backend/.env.example` as the source of truth.

## Available Scripts

Backend (`Backend/package.json`):
- `npm start` - run API server

Frontend (`Frontend/package.json`):
- `npm run dev` - start Vite dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint

## API Overview

Authentication:
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/settings` (update name, username, password)
- `POST /api/auth/logout`

Chat:
- `POST /api/chat/history`
- `GET /api/chat/history`
- `GET /api/chat/conversations`
- `DELETE /api/chat/history/:id`
- `POST /api/chat/tracking`

Threat intelligence:
- `POST /intel/scan`
- `POST /intel/file`
- `POST /intel/bulk`
- `POST /intel/share`

Other endpoints:
- `POST /scanFile` (file scan + AI analysis)
- `POST /groqChat`
- `POST /geminiChat`
- `POST /api/nsfw/*` (NSFW routes)

For protected routes, send:

```http
Authorization: Bearer <token>
```

## GitHub Push Checklist

Before pushing:
- Ensure `Backend/.env` is not committed
- Ensure API keys/secrets are not in code or commit history
- Run frontend lint/build
- Verify login, signup, settings update, and logout flows

Suggested commands:

```bash
cd Frontend
npm run lint
npm run build
```