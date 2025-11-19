# Frontend

React + TypeScript + Vite application with Supabase authentication.

## Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.frontend` file (copy from `.env.frontend.example`):
   ```bash
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
   
   **Note:** The `VITE_SUPABASE_ANON_KEY` is different from the backend's `SUPABASE_KEY`. The anon key is safe to use in the frontend and is available in your Supabase project settings under API keys.

## Running

**Development server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
```

## Project Structure

```
src/
├── components/     # Reusable components (ProtectedRoute, etc.)
├── lib/           # Utilities (Supabase client)
├── pages/         # Page components (Login, SignUp, Home)
├── App.tsx        # Main app component with routing
└── main.tsx       # Entry point
```
