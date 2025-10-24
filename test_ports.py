#!/usr/bin/env python3
"""
Test script to check if required ports are available
"""
import socket
import serial
import sys

def test_port(host, port):
    """Test if a port is available"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex((host, port))
            if result == 0:
                print(f"❌ Port {port} is already in use")
                return False
            else:
                print(f"✅ Port {port} is available")
                return True
    except Exception as e:
        print(f"❌ Error testing port {port}: {e}")
        return False

def test_serial_port(port):
    """Test if a serial port is available"""
    try:
        ser = serial.Serial(port, 9600, timeout=1)
        ser.close()
        print(f"✅ Serial port {port} is available")
        return True
    except serial.SerialException as e:
        print(f"❌ Serial port {port} is not available: {e}")
        return False
    except Exception as e:
        print(f"❌ Error testing serial port {port}: {e}")
        return False

def main():
    print("Testing required ports and serial connections...")
    print("=" * 50)
    
    # Test required ports
    print("Testing TCP ports:")
    port_3000_ok = test_port('localhost', 3000)
    port_6790_ok = test_port('localhost', 6790)
    
    print("\nTesting serial ports:")
    com1_ok = test_serial_port('COM1')
    com3_ok = test_serial_port('COM3')
    
    print("\n" + "=" * 50)
    print("Summary:")
    
    if port_3000_ok and port_6790_ok:
        print("✅ All required TCP ports are available")
    else:
        print("❌ Some TCP ports are not available")
        if not port_3000_ok:
            print("   - Port 3000 (Node.js) is in use")
        if not port_6790_ok:
            print("   - Port 6790 (WebSocket) is in use")
    
    if com3_ok:
        print("✅ Serial port COM3 is available (recommended)")
    elif com1_ok:
        print("⚠️  Serial port COM1 is available (may have permission issues)")
    else:
        print("❌ No serial ports are available")
        print("   - This is normal if no serial device is connected")
    
    print("\nRecommendations:")
    if not port_3000_ok or not port_6790_ok:
        print("- Kill processes using these ports or restart your computer")
    if not com3_ok and not com1_ok:
        print("- Connect your serial device or run without serial support")
    
    return port_3000_ok and port_6790_ok

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
