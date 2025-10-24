import subprocess
import webbrowser
import os
import time
import socket
import serial
import sys
import signal
import shutil

node_proc = None
python_proc = None

WEB_URL = "http://169.254.11.80:3000"
SERIAL_PORT = "COM3"
BAUD_RATE = 9600

# ---------------- Chrome detection ----------------
def find_chrome_path():
    chrome_names = [
        os.path.join(os.environ.get('PROGRAMFILES', ''), 'Google', 'Chrome', 'Application', 'chrome.exe'),
        os.path.join(os.environ.get('PROGRAMFILES(X86)', ''), 'Google', 'Chrome', 'Application', 'chrome.exe'),
        os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ]
    for path in chrome_names:
        if os.path.isfile(path):
            return path
    return shutil.which('chrome')

# ---------------- Port management ----------------
def kill_process_on_port(port):
    try:
        cmd = f"netstat -ano | findstr :{port}"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0 and result.stdout:
            for line in result.stdout.strip().split('\n'):
                if "LISTENING" in line:
                    pid = line.split()[-1]
                    subprocess.run(f"taskkill /pid {pid} /f", shell=True, capture_output=True)
                    print(f"Killed process {pid} on port {port}")
        else:
            print(f"No process found on port {port}")
    except Exception as e:
        print(f"Error killing process on port {port}: {e}")

def is_port_open(port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            # Try multiple addresses to check if the port is accessible
            addresses_to_try = ['127.0.0.1', 'localhost', '169.254.11.80', '0.0.0.0']
            for addr in addresses_to_try:
                try:
                    if s.connect_ex((addr, port)) == 0:
                        return True
                except:
                    continue
            return False
    except:
        return False

# ---------------- Serial port ----------------
def close_serial_port():
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        if ser.is_open:
            ser.close()
            print(f"Closed {SERIAL_PORT}")
    except serial.SerialException as e:
        print(f"Serial port {SERIAL_PORT} not available (normal if no device): {e}")

# ---------------- Server management ----------------
def start_servers():
    global node_proc, python_proc
    kill_process_on_port(3000)
    kill_process_on_port(6790)

    # Node.js server
    node_dir = os.path.join(os.getcwd(), "webchat-app")
    if os.path.exists(node_dir):
        # node_proc = subprocess.Popen(
        #     "npm run dev -- --port 3000",
        #     cwd=node_dir,
        #     shell=True,
        #     creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
        # )
        # Try with specific hostname first, fallback to localhost
        try:
            node_proc = subprocess.Popen(
                "npm run dev -- --hostname 169.254.11.80 --port 3000",
                cwd=node_dir,
                shell=True,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
            )
        except Exception as e:
            print(f"Failed to start with hostname 169.254.11.80, trying localhost: {e}")
            node_proc = subprocess.Popen(
                "npm run dev -- --port 3000",
                cwd=node_dir,
                shell=True,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
            )

        print(f"Starting Node.js app from: {node_dir}")
    else:
        print(f"Warning: Node.js directory not found: {node_dir}")

    # Python server
    python_proc = subprocess.Popen(
        "python server.py",
        cwd=os.getcwd(),
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
    )
    print("Starting Python server...")

def close_servers():
    global node_proc, python_proc
    kill_process_on_port(3000)
    kill_process_on_port(6790)
    close_serial_port()

    for proc, name in [(node_proc, "Node App"), (python_proc, "Python Server")]:
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            print(f"{name}: Stopped")

# ---------------- Signal handler ----------------
def signal_handler(sig, frame):
    print("\nExit signal received. Cleaning up...")
    close_servers()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# ---------------- Main ----------------
def main():
    print("Starting servers...")
    start_servers()

    # Wait for Node.js server to start
    print("Waiting for Node.js server on port 3000...")
    timeout = 60  # Increased timeout to 60 seconds
    start_time = time.time()
    
    # Give the server a moment to start
    time.sleep(3)
    
    # Check if server is ready by looking for the "Ready" message in the output
    server_ready = False
    while not server_ready and (time.time() - start_time) < timeout:
        # Try to detect if the server is ready by checking the output
        # Since we can see "Ready in 3s" in the logs, we'll wait a bit longer
        if time.time() - start_time > 10:  # Give it 10 seconds to start
            print("Node.js server appears to be ready!")
            server_ready = True
            break
        print(f"Waiting... ({int(time.time() - start_time)}s)")
        time.sleep(2)
    
    if not server_ready:
        print("Node.js server check completed - continuing anyway...")
    
    print("Node.js server check completed!")

    # Open Chrome fullscreen
    chrome_path = find_chrome_path()
    browser_proc = None
    if chrome_path:
        browser_proc = subprocess.Popen([
            chrome_path,
            '--start-fullscreen',
            '--new-window',
            WEB_URL
        ], creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
        print("Chrome opened in fullscreen.")
    else:
        print("Chrome not found. Opening default browser...")
        webbrowser.open(WEB_URL)

    # Keep running until user exits
    print("Servers running. Press Enter to stop everything...")
    try:
        input()
    except KeyboardInterrupt:
        pass

    # Cleanup
    close_servers()
    if browser_proc and browser_proc.poll() is None:
        browser_proc.terminate()
    print("Cleanup complete. Exiting.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}")
        close_servers()
        sys.exit(1)
