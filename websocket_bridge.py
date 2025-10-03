#!/usr/bin/env python3
"""
WebSocket Bridge Server
Мост между WebSocket клиентами (браузер) и TCP сервером
"""

import asyncio
import websockets
import socket
import json
import logging
from threading import Thread

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class WebSocketBridge:
    def __init__(self, ws_port=12347, tcp_host='localhost', tcp_port=12345):
        self.ws_port = ws_port
        self.tcp_host = tcp_host
        self.tcp_port = tcp_port
        self.active_connections = {}  # {websocket: tcp_socket}
        
    async def handle_client(self, websocket, path):
        """Обработка WebSocket клиента"""
        tcp_socket = None
        client_id = id(websocket)
        
        try:
            # Создаем TCP соединение с основным сервером
            tcp_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            tcp_socket.connect((self.tcp_host, self.tcp_port))
            self.active_connections[websocket] = tcp_socket
            
            logging.info(f"WebSocket клиент {client_id} подключен и связан с TCP")
            
            # Создаем задачу для чтения из TCP
            tcp_task = asyncio.create_task(self.tcp_to_websocket(tcp_socket, websocket))
            
            try:
                # Читаем сообщения от WebSocket клиента
                async for message in websocket:
                    try:
                        # Отправляем сообщение в TCP
                        tcp_socket.send(message.encode('utf-8'))
                        logging.info(f"WS->TCP: {message[:100]}")
                    except Exception as e:
                        logging.error(f"Ошибка отправки в TCP: {e}")
                        break
            except websockets.exceptions.ConnectionClosed:
                logging.info(f"WebSocket клиент {client_id} отключился")
            finally:
                tcp_task.cancel()
                
        except Exception as e:
            logging.error(f"Ошибка обработки WebSocket клиента: {e}")
        finally:
            # Очистка
            if websocket in self.active_connections:
                del self.active_connections[websocket]
            if tcp_socket:
                try:
                    tcp_socket.close()
                except:
                    pass
            logging.info(f"WebSocket клиент {client_id} отключен")
    
    async def tcp_to_websocket(self, tcp_socket, websocket):
        """Чтение из TCP и отправка в WebSocket"""
        loop = asyncio.get_event_loop()
        try:
            while True:
                # Читаем из TCP в отдельном потоке чтобы не блокировать
                data = await loop.run_in_executor(None, tcp_socket.recv, 4096)
                if not data:
                    break
                
                # Отправляем в WebSocket
                message = data.decode('utf-8').strip()
                if message:
                    await websocket.send(message)
                    logging.info(f"TCP->WS: {message[:100]}")
                    
        except Exception as e:
            logging.error(f"Ошибка чтения из TCP: {e}")
    
    async def start(self):
        """Запуск WebSocket сервера"""
        logging.info(f"Запуск WebSocket bridge на порту {self.ws_port}")
        async with websockets.serve(self.handle_client, "0.0.0.0", self.ws_port):
            await asyncio.Future()  # Работаем бесконечно

def main():
    bridge = WebSocketBridge()
    try:
        asyncio.run(bridge.start())
    except KeyboardInterrupt:
        logging.info("Остановка WebSocket bridge...")

if __name__ == "__main__":
    main()
