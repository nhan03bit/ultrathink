# Agora Voice AI Setup

## Required Environment Variables

Add these to your `dashboard/.env.local`:

```bash
# ─── Agora (from https://console.agora.io) ──────────────────
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_app_certificate
AGORA_CUSTOMER_ID=your_customer_id
AGORA_CUSTOMER_SECRET=your_customer_secret

# Client-side (must match server-side values)
NEXT_PUBLIC_AGORA_APP_ID=your_app_id
NEXT_PUBLIC_AGORA_AGENT_UID=333

# ─── LLM (voice agent brain) ────────────────────────────────
# Defaults to Groq. Falls back to GROQ_API_KEY if not set.
AGORA_LLM_URL=https://api.groq.com/openai/v1/chat/completions
AGORA_LLM_API_KEY=your_groq_key
AGORA_LLM_MODEL=llama-3.3-70b-versatile

# ─── TTS (Text-to-Speech) ───────────────────────────────────
AGORA_TTS_VENDOR=microsoft
AGORA_MICROSOFT_TTS_KEY=your_azure_speech_key
AGORA_MICROSOFT_TTS_REGION=eastus
AGORA_MICROSOFT_TTS_VOICE_NAME=en-US-AndrewMultilingualNeural
```

## How to get credentials

1. **Agora**: Sign up at [console.agora.io](https://console.agora.io), create a project, get App ID + Certificate. Enable RESTful API for Customer ID/Secret.
2. **Groq**: Get API key from [console.groq.com](https://console.groq.com)
3. **Azure TTS**: Create a Speech resource in Azure portal, get key + region.

## Free tier

- Agora RTC: 10,000 minutes/month
- Agora Conversational AI: 300 minutes/month
- Groq: Free tier available
