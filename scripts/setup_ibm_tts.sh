#!/bin/bash

# IBM Watson Text-to-Speech Integration Setup Script
# This script configures IBM TTS speaker profiles for the Open Notebook podcast feature
#
# Prerequisites:
# 1. IBM Cloud account with Watson Text-to-Speech service created
# 2. API Key and Service URL from your IBM Watson TTS instance
# 3. Update .env file with IBM_TTS_API_KEY and IBM_TTS_API_URL
#
# Usage: ./setup_ibm_tts.sh

API_URL="${1:-http://localhost:15055}"
IBM_API_KEY="${IBM_TTS_API_KEY:-}"
IBM_SERVICE_URL="${IBM_TTS_API_URL:-}"

echo "======================================"
echo "IBM Watson Text-to-Speech Setup"
echo "======================================"
echo ""

# Check if IBM credentials are configured
if [ -z "$IBM_API_KEY" ] || [ -z "$IBM_SERVICE_URL" ]; then
    echo "❌ Error: IBM TTS credentials not found in environment variables"
    echo ""
    echo "Please update your .env file with:"
    echo "  IBM_TTS_API_KEY=your_api_key_here"
    echo "  IBM_TTS_API_URL=https://api.us-south.text-to-speech.watson.cloud.ibm.com"
    echo ""
    echo "Then reload your Docker containers:"
    echo "  docker compose restart backend"
    exit 1
fi

echo "✅ IBM TTS credentials found"
echo ""

# Available IBM Watson voices
declare -a VOICE_NAMES=(
    "Allison (American English)"
    "Enrique (Castilian Spanish)"
    "Olivia (British English)"
    "Michael (German)"
    "Margot (French)"
    "Lucia (Italian)"
    "Yuki (Japanese)"
    "Li-Wei (Mandarin Chinese)"
)

declare -a VOICE_IDS=(
    "en-US_AllisonV3Voice"
    "es-ES_EnriqueV3Voice"
    "en-GB_OliviaV3Voice"
    "de-DE_MichaelV3Voice"
    "fr-FR_MargotV3Voice"
    "it-IT_LuciaV3Voice"
    "ja-JP_YukiV3Voice"
    "zh-CN_LiWeiV3Voice"
)

declare -a BACKSTORIES=(
    "Professional news anchor with clear enunciation"
    "Native Spanish speaker with warm tone"
    "BBC-style British English speaker"
    "Native German speaker"
    "Native French speaker"
    "Native Italian speaker"
    "Native Japanese speaker"
    "Native Mandarin speaker"
)

declare -a PERSONALITIES=(
    "professional, authoritative, engaging"
    "friendly, approachable, warm"
    "polished, sophisticated, clear"
    "professional, neutral, clear"
    "elegant, refined, expressive"
    "expressive, melodic, engaging"
    "clear, professional, polite"
    "clear, precise, professional"
)

echo "📋 Available IBM Watson Voices:"
echo ""
for i in "${!VOICE_NAMES[@]}"; do
    echo "  $((i+1)). ${VOICE_NAMES[$i]} - ${VOICE_IDS[$i]}"
done
echo ""

# Create speaker profiles for each voice
echo "🔧 Creating IBM TTS speaker profiles..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

for i in "${!VOICE_IDS[@]}"; do
    VOICE_ID="${VOICE_IDS[$i]}"
    PROFILE_NAME=$(echo "ibm_${VOICE_ID}" | tr '[:upper:]' '[:lower:]' | sed 's/-/_/g' | sed 's/v3voice//')
    
    # Create single speaker profile
    SPEAKER_PROFILE=$(cat <<EOF
{
  "name": "$PROFILE_NAME",
  "description": "IBM Watson TTS - ${VOICE_NAMES[$i]}",
  "tts_provider": "ibm",
  "tts_model": "watson-tts",
  "speakers": [
    {
      "name": "${VOICE_NAMES[$i]}",
      "voice_id": "$VOICE_ID",
      "backstory": "${BACKSTORIES[$i]}",
      "personality": "${PERSONALITIES[$i]}"
    }
  ]
}
EOF
)

    echo "Creating profile: $PROFILE_NAME..."
    
    RESPONSE=$(curl -s -X POST "$API_URL/api/speaker-profiles" \
        -H "Content-Type: application/json" \
        -d "$SPEAKER_PROFILE" \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✅ Profile created successfully"
        ((SUCCESS_COUNT++))
    else
        echo "  ❌ Failed to create profile (HTTP $HTTP_CODE)"
        ((FAIL_COUNT++))
    fi
done

echo ""
echo "======================================"
echo "Setup Summary"
echo "======================================"
echo "✅ Successful: $SUCCESS_COUNT profiles"
echo "❌ Failed: $FAIL_COUNT profiles"
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "📚 Next Steps:"
    echo "  1. Go to http://localhost:3000/podcasts"
    echo "  2. Click 'Generate Podcast'"
    echo "  3. Select an IBM TTS profile (e.g., 'ibm_allison')"
    echo "  4. Your podcast will be generated with IBM Watson TTS"
    echo ""
    echo "💡 Pro Tips:"
    echo "  - IBM provides up to 10,000 characters per month free"
    echo "  - Multiple voice profiles let you create diverse podcasts"
    echo "  - Pricing: ~\$0.02 per 1000 characters after free tier"
    echo ""
fi

echo "Documentation: https://cloud.ibm.com/docs/text-to-speech"
