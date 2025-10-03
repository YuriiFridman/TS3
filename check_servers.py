#!/usr/bin/env python3
"""
Verification script to test the setup
"""

import socket
import time
import sys

def check_port(host, port, name):
    """Check if a port is open"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    try:
        result = sock.connect_ex((host, port))
        if result == 0:
            print(f"✅ {name} (port {port}) is running")
            return True
        else:
            print(f"❌ {name} (port {port}) is NOT running")
            return False
    except socket.gaierror:
        print(f"❌ Could not resolve hostname for {name}")
        return False
    finally:
        sock.close()

def main():
    print("Проверка серверов VoiceChat Pro...\n")
    
    checks = [
        ("localhost", 12345, "TCP Server"),
        ("localhost", 12347, "WebSocket Bridge"),
        ("localhost", 8080, "HTTP Server"),
    ]
    
    results = []
    for host, port, name in checks:
        results.append(check_port(host, port, name))
    
    print("\n" + "="*50)
    if all(results):
        print("✅ Все серверы работают корректно!")
        print("\nВеб-версия доступна по адресу: http://localhost:8080")
        return 0
    else:
        print("❌ Некоторые серверы не запущены")
        print("\nЗапустите серверы командой: python start_servers.py")
        return 1

if __name__ == "__main__":
    sys.exit(main())
