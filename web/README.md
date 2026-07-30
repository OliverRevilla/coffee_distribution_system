# Coffee Distribution Web App

React (Vite + TypeScript) frontend for the Coffee Distribution System.

## Local Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

3. Update `.env.local` with your Azure AD B2C credentials.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run preview` - Preview production build

### Project Structure

```
src/
├── components/      # Reusable UI components
├── config/          # Configuration files
├── hooks/           # Custom React hooks
├── pages/           # Page components
│   ├── admin/       # Admin dashboard pages
│   └── seller/      # Seller dashboard pages
├── services/        # API service functions
├── App.tsx          # Main app component
└── main.tsx         # Entry point
```
