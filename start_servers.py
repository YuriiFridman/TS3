#!/usr/bin/env python3
"""
Unified Server Launcher
Запускает все необходимые серверы для работы приложения
"""

import subprocess
import sys
import time
import signal
import logging
from threading import Thread

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class ServerLauncher:
    def __init__(self):
        self.processes = []
    
    def start_server(self, script, name):
        """Запуск сервера в отдельном процессе"""
        try:
            logging.info(f"Запуск {name}...")
            process = subprocess.Popen([sys.executable, script])
            self.processes.append((name, process))
            time.sleep(1)  # Даем время на запуск
            return process
        except Exception as e:
            logging.error(f"Ошибка запуска {name}: {e}")
            return None
    
    def stop_all(self, signum=None, frame=None):
        """Остановка всех серверов"""
        logging.info("\nОстановка всех серверов...")
        for name, process in self.processes:
            try:
                logging.info(f"Остановка {name}...")
                process.terminate()
                process.wait(timeout=5)
            except Exception as e:
                logging.error(f"Ошибка остановки {name}: {e}")
                try:
                    process.kill()
                except:
                    pass
        sys.exit(0)
    
    def run(self):
        """Запуск всех серверов"""
        signal.signal(signal.SIGINT, self.stop_all)
        signal.signal(signal.SIGTERM, self.stop_all)
        
        # Запускаем серверы
        self.start_server('server.py', 'TCP Server')
        self.start_server('websocket_bridge.py', 'WebSocket Bridge')
        self.start_server('http_server.py', 'HTTP Server')
        
        logging.info("\n" + "="*60)
        logging.info("Все серверы запущены!")
        logging.info("="*60)
        logging.info("📱 Electron приложение: npm start")
        logging.info("🌐 Веб-приложение: http://localhost:8080")
        logging.info("🔌 TCP Server: localhost:12345")
        logging.info("🔌 WebSocket Bridge: localhost:12347")
        logging.info("="*60)
        logging.info("Нажмите Ctrl+C для остановки всех серверов\n")
        
        # Ждем завершения
        try:
            while True:
                time.sleep(1)
                # Проверяем, не упал ли какой-то процесс
                for name, process in self.processes:
                    if process.poll() is not None:
                        logging.error(f"{name} неожиданно завершился с кодом {process.returncode}")
                        self.stop_all()
        except KeyboardInterrupt:
            self.stop_all()

if __name__ == "__main__":
    launcher = ServerLauncher()
    launcher.run()
