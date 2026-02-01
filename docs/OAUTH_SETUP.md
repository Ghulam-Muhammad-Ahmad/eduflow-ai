# Google OAuth Setup

Continue with Google is wired to Supabase Auth. To enable it:

## 1. Supabase Dashboard

1. Open your project: **Authentication** → **Providers**.
2. Enable **Google**.
3. Add the **Client ID** and **Client Secret** from Google (see below).
4. Under **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:3000` (dev) or your production URL.
   - **Redirect URLs**: add:
     - `http://localhost:3000/auth/callback`
     - `https://your-production-domain.com/auth/callback`

## 2. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project → **APIs & Services** → **Credentials**.
3. **Create credentials** → **OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized redirect URIs**: add the Supabase callback URL, e.g.  
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
   (exact value is shown in Supabase → Authentication → Providers → Google).
6. Copy **Client ID** and **Client secret** into Supabase → Google provider.

## 3. New OAuth users

- First-time Google sign-ins get a **student** role and a **profile** row (name/avatar from Google).
- They are redirected to `/dashboard/student`. Teachers and admins must be set in your database or via another flow.

## 4. Flow summary

1. User clicks **Continue with Google**.
2. They are sent to Google, then back to Supabase.
3. Supabase redirects to `/auth/callback` with the session.
4. The callback page reads the user's role and redirects to the right dashboard.
