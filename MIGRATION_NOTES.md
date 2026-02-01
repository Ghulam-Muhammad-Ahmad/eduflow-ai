# Next.js Migration Notes

This project has been migrated from Vite + React Router to Next.js with Pages Router.

## Key Changes

### 1. Project Structure
- **Pages Router**: All routes are now in the `pages/` directory
- **API Routes**: AI service calls are now in `pages/api/ai/generate.ts`
- **Components**: Remained in `src/components/` and `src/pages/` (imported by Next.js pages)

### 2. Routing
- React Router (`react-router-dom`) → Next.js Pages Router
- `useNavigate()` → `useRouter().push()`
- `useParams()` → `useRouter().query`
- `Link` from `react-router-dom` → `Link` from `next/link`
- Route parameters: `/dashboard/teacher/classrooms/:id` → `/dashboard/teacher/classrooms/[classroomId].tsx`

### 3. Environment Variables
- `VITE_SUPABASE_URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY` → `GEMINI_API_KEY` (server-side only)
- `VITE_OPENAI_API_KEY` → `OPENAI_API_KEY` (server-side only)

### 4. API Routes
- AI generation now happens server-side via `/api/ai/generate`
- API keys are no longer exposed to the client
- The `aiService.ts` now calls the API route instead of making direct API calls

### 5. Authentication & Protected Routes
- Created `withAuth` HOC in `src/lib/withAuth.tsx` for route protection
- All dashboard pages use `withAuth` wrapper
- Auth state management remains the same (Supabase)

### 6. Build & Development
- `npm run dev` → Starts Next.js dev server (port 3000 by default)
- `npm run build` → Builds Next.js production bundle
- `npm start` → Starts production server

### 7. Files Removed
- `index.html` (Next.js uses `pages/_app.tsx` and `pages/_document.tsx`)
- `vite.config.ts`
- `vitest.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/vite-env.d.ts`
- `tsconfig.app.json`
- `tsconfig.node.json`

### 8. Files Created
- `next.config.js` - Next.js configuration
- `next-env.d.ts` - Next.js TypeScript definitions
- `pages/_app.tsx` - Global app wrapper with providers
- `pages/index.tsx` - Home page
- `pages/auth.tsx` - Authentication page
- `pages/reset-password.tsx` - Password reset page
- `pages/404.tsx` - 404 error page
- `pages/api/ai/generate.ts` - AI generation API route
- All dashboard pages in `pages/dashboard/` structure

### 9. Components Updated
- `src/components/landing/Navbar.tsx` - Uses Next.js Link and router
- `src/components/dashboard/DashboardLayout.tsx` - Uses Next.js router
- `src/components/NavLink.tsx` - Updated for Next.js
- `src/integrations/supabase/client.ts` - Updated for Next.js env vars
- `src/services/aiService.ts` - Now calls API route

### 10. Remaining Work
Some components in `src/pages/dashboard/` may still use `react-router-dom` hooks. These need to be updated to use Next.js router:
- Replace `useNavigate()` with `useRouter().push()`
- Replace `useParams()` with `useRouter().query`
- Replace `useLocation()` with `useRouter().asPath` or `useRouter().pathname`
- Replace `Link` from `react-router-dom` with `Link` from `next/link`

### 11. Testing
- Update test files to work with Next.js
- Update any E2E tests to use Next.js routes

### 12. Deployment
- Update deployment configuration for Next.js
- Set environment variables in your hosting platform
- Ensure API routes are accessible

## Next Steps

1. **Update remaining components**: Search for `react-router-dom` imports and update them
2. **Test all routes**: Verify all pages load correctly
3. **Update environment variables**: Set `NEXT_PUBLIC_*` variables in your `.env` file
4. **Test API routes**: Verify AI generation works through the API route
5. **Update CI/CD**: Update build scripts for Next.js

## Environment Variables Needed

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
```
