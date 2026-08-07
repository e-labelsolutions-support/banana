● Found the full picture from prod logs. Three takeaways:

1. You don't HAVE a Google client ID yet — GOOGLE_CLIENT_ID is not set anywhere. The "works locally" was misleading; locally the popup opens but then fails when  
   fetching /api/calendar/auth-url (which throws GOOGLE_CLIENT_ID not set — visible in the prod log).

2. The 500 you're seeing is from Trello, not Google. TRELLO_APP_API_KEY is also unset. The Integrations page fires integration.getAuthorizationUrl?provider=trello  
   on load and it throws Trello API key not set in environment variables. That's the 500 in your paste.

3. GitHub status returns 200 (it doesn't require server-side keys to return "not connected").

To get a Google client ID (one-time setup):

1. Go to console.cloud.google.com → sign in with any Google account (yelves, gigi, a shared team account — your call)
2. Create a project (or pick an existing one)
3. APIs & Services → Library → search "Google Calendar API" → Enable
4. APIs & Services → OAuth consent screen → set up External, fill in app name (e.g., "Banana"), save
5. APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application
6. Under Authorized redirect URIs, add:
   - http://localhost:3000/api/calendar/oauth/callback (for local dev)
   - https://banana.elscms.com/api/calendar/oauth/callback (prod)

7. Copy the Client ID + Client Secret → add to prod env:  
   GOOGLE_CLIENT_ID=...  
   GOOGLE_CLIENT_SECRET=...
8. Restart the web container, ~5 min for Google to propagate the consent screen.

For the immediate page break (Trello 500): want me to make the integrations page gracefully degrade — show only integrations whose env vars are configured, hide  
 Trello/GitHub/Google when their keys are missing? That way the page works regardless of what you've set up.
