<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18d2cQilTZe4To7yhPbx4h6k5rGAXPrAY

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a local env file `.env.local` and set your keys there (do NOT commit this file):

- `VITE_GEMINI_API_KEY` — your Gemini API key (if using Gemini)
- `VITE_OPENAI_API_KEY` — your OpenAI API key (if using OpenAI)
3. Run the app:
   `npm run dev`

Security note (OpenAI keys)
---------------------------------
- By default, the app blocks the OpenAI client from running in a browser environment to avoid exposing your secret API key to users.
- For local development only, you may opt into running the OpenAI client in the browser by adding this to your `.env.local`:

```
VITE_ALLOW_OPENAI_IN_BROWSER=true
```

Only use the opt-in flag for quick local testing. For production, proxy OpenAI requests through a server-side endpoint so secrets remain on the server. See OpenAI's guide: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
