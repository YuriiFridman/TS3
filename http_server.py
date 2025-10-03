#!/usr/bin/env python3
"""
Simple HTTP Server для обслуживания веб-версии приложения
"""

import http.server
import socketserver
import os
import logging

PORT = 8080
DIRECTORY = "public"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s'
)

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Добавляем CORS заголовки для разработки
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

if __name__ == "__main__":
    # Проверяем, существует ли директория
    if not os.path.exists(DIRECTORY):
        print(f"Ошибка: Директория '{DIRECTORY}' не найдена!")
        exit(1)
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        logging.info(f"Веб-сервер запущен на http://localhost:{PORT}")
        logging.info(f"Обслуживается директория: {DIRECTORY}")
        logging.info("Нажмите Ctrl+C для остановки")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logging.info("\nОстановка сервера...")
            httpd.shutdown()
