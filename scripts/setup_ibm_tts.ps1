# IBM Watson Text-to-Speech Integration Setup Script
# This script configures IBM TTS speaker profiles for the Open Notebook podcast feature
#
# Prerequisites:
# 1. IBM Cloud account with Watson Text-to-Speech service created
# 2. API Key and Service URL from your IBM Watson TTS instance
# 3. Update .env file with IBM_TTS_API_KEY and IBM_TTS_API_URL
#
# Usage: .\setup_ibm_tts.ps1

param(
    [string]$ApiUrl = "http://localhost:15055",
    [string]$IbmApiKey = $env:IBM_TTS_API_KEY,
    [string]$IbmServiceUrl = $env:IBM_TTS_API_URL
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "IBM Watson Text-to-Speech Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if IBM credentials are configured
if (-not $IbmApiKey -or -not $IbmServiceUrl) {
    Write-Host "❌ Error: IBM TTS credentials not found in environment variables" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please update your .env file with:" -ForegroundColor Yellow
    Write-Host "  IBM_TTS_API_KEY=your_api_key_here" -ForegroundColor White
    Write-Host "  IBM_TTS_API_URL=https://api.us-south.text-to-speech.watson.cloud.ibm.com" -ForegroundColor White
    Write-Host ""
    Write-Host "Then reload your Docker containers:" -ForegroundColor Yellow
    Write-Host "  docker compose restart backend" -ForegroundColor White
    exit 1
}

Write-Host "✅ IBM TTS credentials found" -ForegroundColor Green
Write-Host ""

# Available IBM Watson voices
$ibmVoices = @(
    @{
        name = "Allison (American English)"
        voice_id = "en-US_AllisonV3Voice"
        backstory = "Professional news anchor with clear enunciation"
        personality = "professional, authoritative, engaging"
    },
    @{
        name = "Enrique (Castilian Spanish)"
        voice_id = "es-ES_EnriqueV3Voice"
        backstory = "Native Spanish speaker with warm tone"
        personality = "friendly, approachable, warm"
    },
    @{
        name = "Olivia (British English)"
        voice_id = "en-GB_OliviaV3Voice"
        backstory = "BBC-style British English speaker"
        personality = "polished, sophisticated, clear"
    },
    @{
        name = "Michael (German)"
        voice_id = "de-DE_MichaelV3Voice"
        backstory = "Native German speaker"
        personality = "professional, neutral, clear"
    },
    @{
        name = "Margot (French)"
        voice_id = "fr-FR_MargotV3Voice"
        backstory = "Native French speaker"
        personality = "elegant, refined, expressive"
    },
    @{
        name = "Lucia (Italian)"
        voice_id = "it-IT_LuciaV3Voice"
        backstory = "Native Italian speaker"
        personality = "expressive, melodic, engaging"
    },
    @{
        name = "Yuki (Japanese)"
        voice_id = "ja-JP_YukiV3Voice"
        backstory = "Native Japanese speaker"
        personality = "clear, professional, polite"
    },
    @{
        name = "Li-Wei (Mandarin Chinese)"
        voice_id = "zh-CN_LiWeiV3Voice"
        backstory = "Native Mandarin speaker"
        personality = "clear, precise, professional"
    }
)

Write-Host "📋 Available IBM Watson Voices:" -ForegroundColor Cyan
Write-Host ""
for ($i = 0; $i -lt $ibmVoices.Count; $i++) {
    Write-Host "  $($i+1). $($ibmVoices[$i].name) - $($ibmVoices[$i].voice_id)"
}
Write-Host ""

# Create speaker profiles for each voice
Write-Host "🔧 Creating IBM TTS speaker profiles..." -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($voice in $ibmVoices) {
    $profileName = "ibm_$($voice.voice_id -replace '-', '_' -replace 'V3Voice', '').ToLower()"
    
    # Create single speaker profile
    $speakerProfile = @{
        name = $profileName
        description = "IBM Watson TTS - $($voice.name)"
        tts_provider = "ibm"
        tts_model = "watson-tts"
        speakers = @(
            @{
                name = $voice.name
                voice_id = $voice.voice_id
                backstory = $voice.backstory
                personality = $voice.personality
            }
        )
    }

    try {
        Write-Host "Creating profile: $profileName..." -ForegroundColor Yellow
        
        $response = Invoke-WebRequest `
            -Uri "$ApiUrl/api/speaker-profiles" `
            -Method POST `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body (ConvertTo-Json $speakerProfile -Depth 10) `
            -ErrorAction Stop `
            -UseBasicParsing

        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ Profile created successfully" -ForegroundColor Green
            $successCount++
        }
    } catch {
        Write-Host "  ❌ Failed to create profile: $_" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Setup Summary" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✅ Successful: $successCount profiles" -ForegroundColor Green
Write-Host "❌ Failed: $failCount profiles" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($successCount -gt 0) {
    Write-Host "📚 Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Go to http://localhost:3000/podcasts" -ForegroundColor White
    Write-Host "  2. Click 'Generate Podcast'" -ForegroundColor White
    Write-Host "  3. Select an IBM TTS profile (e.g., 'ibm_allison')" -ForegroundColor White
    Write-Host "  4. Your podcast will be generated with IBM Watson TTS" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Pro Tips:" -ForegroundColor Cyan
    Write-Host "  - IBM provides up to 10,000 characters per month free" -ForegroundColor White
    Write-Host "  - Multiple voice profiles let you create diverse podcasts" -ForegroundColor White
    Write-Host "  - Pricing: ~$0.02 per 1000 characters after free tier" -ForegroundColor White
    Write-Host ""
}

Write-Host "Documentation: https://cloud.ibm.com/docs/text-to-speech" -ForegroundColor Gray
