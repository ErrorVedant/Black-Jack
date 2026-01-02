#!/usr/bin/env python3
"""
Test script to verify that the servers are running correctly
"""
import requests
import websockets
import asyncio
import sys
from ip_config import get_ip_address, get_web_url, get_websocket_url

async def test_websocket():
    """Test WebSocket connection"""
    try:
        # Try IP from ip.txt first, then localhost
        ws_url = get_websocket_url(6790)
        urls_to_try = [ws_url or "ws://localhost:6790", "ws://localhost:6790"]
        
        for url in urls_to_try:
            try:
                async with websockets.connect(url) as websocket:
                    print(f"✅ WebSocket server is running on {url}")
                    return True
            except:
                continue
        
        print("❌ WebSocket server test failed on all attempted URLs")
        return False
    except Exception as e:
        print(f"❌ WebSocket server test failed: {e}")
        return False

def test_http():
    """Test HTTP server"""
    try:
        # Get IP from ip.txt
        web_url = get_web_url(3000)
        urls_to_try = [
            web_url or "http://localhost:3000",
            "http://localhost:3000",
        ]
        
        for url in urls_to_try:
            try:
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    print(f"✅ HTTP server is running on {url}")
                    return True
            except:
                continue
        
        print("❌ HTTP server test failed on all attempted URLs")
        return False
    except Exception as e:
        print(f"❌ HTTP server test failed: {e}")
        return False

async def main():
    print("Testing server connections...")
    print("=" * 40)
    
    # Test HTTP server
    print("Testing HTTP server:")
    http_ok = test_http()
    
    # Test WebSocket server
    print("\nTesting WebSocket server:")
    ws_ok = await test_websocket()
    
    print("\n" + "=" * 40)
    print("Summary:")
    
    if http_ok and ws_ok:
        print("✅ Both servers are running correctly!")
        print("\nYou can now:")
        web_url = get_web_url(3000) or "http://localhost:3000"
        print(f"1. Open your browser to {web_url}")
        print("2. The application should be fully functional")
        return True
    else:
        print("❌ Some servers are not running correctly")
        if not http_ok:
            print("- HTTP server (Node.js) is not accessible")
        if not ws_ok:
            print("- WebSocket server (Python) is not accessible")
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        sys.exit(1)
