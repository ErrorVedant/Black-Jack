#!/usr/bin/env python3
"""
Test script to verify that the servers are running correctly
"""
import requests
import websockets
import asyncio
import sys

async def test_websocket():
    """Test WebSocket connection"""
    try:
        async with websockets.connect("ws://localhost:6790") as websocket:
            print("✅ WebSocket server is running on port 6790")
            return True
    except Exception as e:
        print(f"❌ WebSocket server test failed: {e}")
        return False

def test_http():
    """Test HTTP server"""
    try:
        # Try multiple possible URLs
        urls_to_try = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://169.254.11.80:3000"
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
        print("1. Open your browser to http://localhost:3000 or http://169.254.11.80:3000")
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
