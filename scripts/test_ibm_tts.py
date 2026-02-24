#!/usr/bin/env python3
"""
IBM Watson TTS Integration Test Script
Tests connectivity, credentials, and speaker profile setup
"""

import json
import sys
import os
from pathlib import Path
from typing import Optional

# Add backend to path if running from project
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

def print_header(text: str):
    """Print a formatted header"""
    print("\n" + "=" * 50)
    print(f"  {text}")
    print("=" * 50)

def print_success(text: str):
    """Print success message"""
    print(f"✅ {text}")

def print_error(text: str):
    """Print error message"""
    print(f"❌ {text}")

def print_info(text: str):
    """Print info message"""
    print(f"ℹ️  {text}")

def check_environment_variables() -> bool:
    """Check if IBM TTS environment variables are set"""
    print_header("Checking Environment Variables")
    
    api_key = os.getenv("IBM_TTS_API_KEY")
    api_url = os.getenv("IBM_TTS_API_URL")
    
    if not api_key:
        print_error("IBM_TTS_API_KEY not found in environment")
        print_info("Set it in your .env file:")
        print("  IBM_TTS_API_KEY=your_api_key_here")
        return False
    
    if not api_url:
        print_error("IBM_TTS_API_URL not found in environment")
        print_info("Set it in your .env file:")
        print("  IBM_TTS_API_URL=https://api.us-south.text-to-speech.watson.cloud.ibm.com")
        return False
    
    print_success(f"IBM_TTS_API_KEY found (length: {len(api_key)})")
    print_success(f"IBM_TTS_API_URL found: {api_url}")
    
    return True

def test_ibm_api_connectivity() -> bool:
    """Test connection to IBM Watson TTS API"""
    print_header("Testing IBM API Connectivity")
    
    try:
        import httpx
        import base64
    except ImportError:
        print_error("Required libraries not installed. Install with:")
        print("  pip install httpx")
        return False
    
    api_key = os.getenv("IBM_TTS_API_KEY")
    api_url = os.getenv("IBM_TTS_API_URL")
    
    if not api_key or not api_url:
        print_error("IBM credentials not configured")
        return False
    
    # Create Basic Auth header
    auth_str = f"apikey:{api_key}"
    auth_bytes = auth_str.encode('utf-8')
    auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
    
    try:
        with httpx.Client() as client:
            response = client.get(
                f"{api_url}/v1/voices",
                headers={"Authorization": f"Basic {auth_b64}"},
                timeout=10
            )
        
        if response.status_code == 200:
            voices = response.json()
            voice_count = len(voices.get("voices", []))
            print_success(f"Connected to IBM Watson TTS API")
            print_success(f"Found {voice_count} available voices")
            
            # Show first few voices
            print_info("Sample voices:")
            for voice in voices.get("voices", [])[:3]:
                print(f"  - {voice.get('name')} ({voice.get('language')})")
            
            return True
        else:
            print_error(f"IBM API returned status {response.status_code}")
            print_error(f"Response: {response.text}")
            return False
    
    except Exception as e:
        print_error(f"Failed to connect to IBM API: {e}")
        return False

def test_api_endpoint(api_url: str = "http://localhost:15055") -> bool:
    """Test connection to Open Notebook API"""
    print_header("Testing Open Notebook API")
    
    try:
        import httpx
    except ImportError:
        print_error("httpx not installed. Skipping API test.")
        return False
    
    try:
        with httpx.Client() as client:
            response = client.get(f"{api_url}/api/speaker-profiles", timeout=5)
        
        if response.status_code == 200:
            profiles = response.json()
            print_success(f"Connected to Open Notebook API")
            print_success(f"Found {len(profiles)} speaker profiles")
            
            # Check for IBM profiles
            ibm_profiles = [p for p in profiles if p.get("tts_provider") == "ibm"]
            if ibm_profiles:
                print_success(f"Found {len(ibm_profiles)} IBM TTS profiles")
                for profile in ibm_profiles:
                    print(f"  - {profile.get('name')}")
            else:
                print_info("No IBM TTS profiles found yet (run setup_ibm_tts.ps1 to create them)")
            
            return True
        else:
            print_error(f"API returned status {response.status_code}")
            return False
    
    except Exception as e:
        print_error(f"Failed to connect to Open Notebook API: {e}")
        print_info("Make sure Docker containers are running:")
        print("  docker compose up -d")
        return False

def show_setup_instructions():
    """Show setup instructions"""
    print_header("Next Steps")
    
    print("1. Verify IBM credentials in Docker container:")
    print("   docker compose exec backend env | grep IBM")
    print()
    print("2. Create IBM TTS speaker profiles:")
    print("   cd scripts")
    print("   ./setup_ibm_tts.ps1    # Windows")
    print("   ./setup_ibm_tts.sh     # Linux/macOS")
    print()
    print("3. Generate a test podcast:")
    print("   - Go to http://localhost:3000/podcasts")
    print("   - Click 'Generate Podcast'")
    print("   - Select an IBM profile")
    print("   - Click Generate")
    print()
    print("4. Monitor generation:")
    print("   docker compose logs -f backend | grep -i podcast")

def main():
    """Run all tests"""
    print("=" * 50)
    print("  IBM Watson TTS Integration Test")
    print("=" * 50)
    
    results = []
    
    # Test environment variables
    results.append(("Environment Variables", check_environment_variables()))
    
    # Test IBM API connectivity
    if results[-1][1]:  # Only test if env vars are set
        results.append(("IBM API Connectivity", test_ibm_api_connectivity()))
    
    # Test Open Notebook API
    results.append(("Open Notebook API", test_api_endpoint()))
    
    # Print summary
    print_header("Test Summary")
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print_success("All tests passed! IBM TTS is ready to use.")
        show_setup_instructions()
        return 0
    else:
        print_error("Some tests failed. See errors above.")
        print_info("Common fixes:")
        print("  1. Update .env with IBM credentials")
        print("  2. Restart Docker: docker compose restart backend")
        print("  3. Check logs: docker compose logs backend")
        return 1

if __name__ == "__main__":
    sys.exit(main())
