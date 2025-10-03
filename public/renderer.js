const { useState, useEffect } = React;
const { createRoot } = ReactDOM;

// Определяем окружение
const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
const ipcRenderer = isElectron ? require('electron').ipcRenderer : null;

// Класс для работы с сервером (поддержка браузера и Electron)
class ServerConnection {
    constructor() {
        this.isConnected = false;
        this.callbacks = {};
        this.ws = null;
        
        if (isElectron) {
            this.setupIPC();
        }
    }

    setupIPC() {
        // Обработчики сообщений от main процесса (только для Electron)
        ipcRenderer.on('server-message', (event, message) => {
            console.log('Получено сообщение от сервера:', message);
            this.handleMessage(message);
        });

        ipcRenderer.on('server-connected', () => {
            this.isConnected = true;
            console.log('Подключено к серверу через IPC');
        });

        ipcRenderer.on('server-disconnected', () => {
            this.isConnected = false;
            console.log('Отключено от сервера');
        });

        ipcRenderer.on('server-error', (event, error) => {
            console.error('Ошибка сервера:', error);
            const callback = this.callbacks['error'];
            if (callback) callback({ message: error });
        });
    }

    async connect(host = 'localhost', port = 12345) {
        if (isElectron) {
            try {
                await ipcRenderer.invoke('connect-to-server', { host, port });
                this.isConnected = true;
                return true;
            } catch (error) {
                console.error('Ошибка подключения:', error);
                throw error;
            }
        } else {
            // Для браузера используем WebSocket
            return new Promise((resolve, reject) => {
                try {
                    // WebSocket подключение к серверу
                    const wsPort = 12347; // Отдельный порт для WebSocket
                    this.ws = new WebSocket(`ws://${host}:${wsPort}`);
                    
                    this.ws.onopen = () => {
                        console.log('✅ WebSocket подключен');
                        this.isConnected = true;
                        resolve(true);
                    };
                    
                    this.ws.onmessage = (event) => {
                        try {
                            const message = JSON.parse(event.data);
                            console.log('📨 Получено от сервера:', message);
                            this.handleMessage(message);
                        } catch (error) {
                            console.error('❌ Ошибка парсинга:', error);
                        }
                    };
                    
                    this.ws.onerror = (error) => {
                        console.error('❌ WebSocket ошибка:', error);
                        this.isConnected = false;
                        const callback = this.callbacks['error'];
                        if (callback) callback({ message: 'Ошибка подключения к серверу' });
                        reject(error);
                    };
                    
                    this.ws.onclose = () => {
                        console.log('🔌 WebSocket закрыт');
                        this.isConnected = false;
                    };
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

    sendMessage(message) {
        if (this.isConnected) {
            console.log('Отправка сообщения на сервер:', message);
            
            if (isElectron) {
                ipcRenderer.invoke('send-to-server', message);
            } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(message));
            }
        } else {
            console.error('Не подключен к серверу');
        }
    }

    handleMessage(message) {
        const callback = this.callbacks[message.type];
        if (callback) {
            callback(message);
        }
    }

    on(messageType, callback) {
        this.callbacks[messageType] = callback;
    }

    disconnect() {
        if (isElectron) {
            ipcRenderer.invoke('disconnect-from-server');
        } else if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}

// Создаем глобальное подключение
const serverConnection = new ServerConnection();

// Главный компонент приложения
function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState(null);

    useEffect(() => {
        // Настройка обработчиков сообщений
        serverConnection.on('login_success', (message) => {
            console.log('Успешный вход:', message);
            setUserInfo({
                username: message.username,
                isAdmin: message.is_admin
            });
            setIsLoggedIn(true);
        });

        serverConnection.on('error', (message) => {
            console.error('Ошибка от сервера:', message);
            alert(message.message);
        });

        serverConnection.on('register_success', (message) => {
            alert(message.message);
        });

        return () => {
            serverConnection.disconnect();
        };
    }, []);

    return React.createElement('div', {
        className: 'app-container'
    }, [
        React.createElement(TitleBar, { key: 'titlebar' }),
        React.createElement(MainContent, { key: 'content' }, [
            !isLoggedIn ?
                React.createElement(LoginScreen, {
                    key: 'login',
                    onLogin: setUserInfo,
                    setLoggedIn: setIsLoggedIn
                }) :
                React.createElement(ChatScreen, {
                    key: 'chat',
                    userInfo: userInfo,
                    onLogout: () => {
                        setIsLoggedIn(false);
                        setUserInfo(null);
                        serverConnection.disconnect();
                    }
                })
        ])
    ]);
}

// Компонент заголовка окна (адаптивный для браузера и Electron)
function TitleBar() {
    const handleClose = () => {
        if (isElectron) {
            ipcRenderer.invoke('close-window');
        } else {
            window.close();
        }
    };

    const handleMinimize = () => {
        if (isElectron) {
            ipcRenderer.invoke('minimize-window');
        }
    };

    return React.createElement('div', {
        style: {
            height: '32px',
            background: '#2d2d30',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            borderBottom: '1px solid #484848',
            WebkitAppRegion: isElectron ? 'drag' : 'initial'
        }
    }, [
        React.createElement('div', {
            key: 'title',
            style: {
                fontSize: '12px',
                fontWeight: '600',
                color: '#cccccc'
            }
        }, '🎤 VoiceChat Pro v1.0.0'),

        isElectron ? React.createElement('div', {
            key: 'controls',
            style: {
                display: 'flex',
                gap: '8px',
                WebkitAppRegion: 'no-drag'
            }
        }, [
            React.createElement('button', {
                key: 'close',
                onClick: handleClose,
                style: {
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ff5f56',
                    cursor: 'pointer'
                }
            }),
            React.createElement('button', {
                key: 'minimize',
                onClick: handleMinimize,
                style: {
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ffbd2e',
                    cursor: 'pointer'
                }
            })
        ]) : null
    ]);
}

// Основной контент
function MainContent({ children }) {
    return React.createElement('div', {
        style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }
    }, children);
}

// Экран входа с РЕАЛЬНОЙ аутентификацией
function LoginScreen({ onLogin, setLoggedIn }) {
    const [formData, setFormData] = useState({
        server: 'localhost',
        username: '',
        password: ''
    });
    const [status, setStatus] = useState('❌ Не подключен');
    const [isConnecting, setIsConnecting] = useState(false);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleConnect = async () => {
        // ПРОВЕРЯЕМ ПОЛЯ!
        if (!formData.username.trim()) {
            setStatus('⚠️ Введите имя пользователя');
            return;
        }

        if (!formData.password.trim()) {
            setStatus('⚠️ Введите пароль');
            return;
        }

        setIsConnecting(true);
        setStatus('⏳ Подключение к серверу...');

        try {
            await serverConnection.connect(formData.server, 12345);
            setStatus('⏳ Аутентификация...');

            // Отправка данных для входа на РЕАЛЬНЫЙ сервер
            serverConnection.sendMessage({
                type: 'login',
                username: formData.username,
                password: formData.password
            });

        } catch (error) {
            setStatus('❌ Ошибка подключения к серверу');
            setIsConnecting(false);
            console.error('Ошибка подключения:', error);
        }
    };

    const handleRegister = async () => {
        if (!formData.username.trim() || !formData.password.trim()) {
            setStatus('⚠️ Заполните все поля для регистрации');
            return;
        }

        setStatus('⏳ Подключение для регистрации...');

        try {
            await serverConnection.connect(formData.server, 12345);
            serverConnection.sendMessage({
                type: 'register',
                username: formData.username,
                password: formData.password
            });
        } catch (error) {
            setStatus('❌ Ошибка подключения к серверу');
            console.error('Ошибка:', error);
        }
    };

    return React.createElement('div', {
        style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d30 100%)'
        }
    },
        React.createElement('div', {
            className: 'card',
            style: { minWidth: '400px' }
        }, [
            React.createElement('h1', {
                key: 'title',
                className: 'title'
            }, '🎤 VoiceChat Pro'),

            React.createElement('p', {
                key: 'subtitle',
                className: 'subtitle'
            }, 'Современный голосовой чат'),

            // Поле сервера
            React.createElement('div', {
                key: 'server-field',
                style: { marginBottom: '20px' }
            }, [
                React.createElement('label', {
                    key: 'server-label',
                    style: {
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#ffffff'
                    }
                }, '🌐 Сервер'),
                React.createElement('input', {
                    key: 'server-input',
                    className: 'input',
                    type: 'text',
                    value: formData.server,
                    onChange: (e) => handleInputChange('server', e.target.value),
                    placeholder: 'localhost',
                    disabled: isConnecting
                })
            ]),

            // Поле имени пользователя
            React.createElement('div', {
                key: 'username-field',
                style: { marginBottom: '20px' }
            }, [
                React.createElement('label', {
                    key: 'username-label',
                    style: {
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#ffffff'
                    }
                }, '👤 Имя пользователя'),
                React.createElement('input', {
                    key: 'username-input',
                    className: 'input',
                    type: 'text',
                    value: formData.username,
                    onChange: (e) => handleInputChange('username', e.target.value),
                    placeholder: 'Введите имя пользователя',
                    disabled: isConnecting
                })
            ]),

            // Поле пароля
            React.createElement('div', {
                key: 'password-field',
                style: { marginBottom: '20px' }
            }, [
                React.createElement('label', {
                    key: 'password-label',
                    style: {
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#ffffff'
                    }
                }, '🔒 Пароль'),
                React.createElement('input', {
                    key: 'password-input',
                    className: 'input',
                    type: 'password',
                    value: formData.password,
                    onChange: (e) => handleInputChange('password', e.target.value),
                    placeholder: 'Введите пароль',
                    disabled: isConnecting
                })
            ]),

            // Кнопки
            React.createElement('div', {
                key: 'buttons',
                style: {
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '20px'
                }
            }, [
                React.createElement('button', {
                    key: 'login-button',
                    className: 'button-primary',
                    onClick: handleConnect,
                    disabled: isConnecting,
                    style: { flex: 1 }
                }, '🚀 Войти'),
                React.createElement('button', {
                    key: 'register-button',
                    className: 'button-secondary',
                    onClick: handleRegister,
                    disabled: isConnecting,
                    style: { flex: 1 }
                }, '📝 Регистрация')
            ]),

            // Статус подключения
            React.createElement('div', {
                key: 'status',
                className: 'status-bar',
                style: {
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#2d2d30',
                    color: '#cccccc',
                    fontSize: '14px',
                    textAlign: 'center'
                }
            }, status)
        ])
    );
}

// ФУНКЦИОНАЛЬНЫЙ экран чата
function ChatScreen({ userInfo, onLogout }) {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [currentRoom, setCurrentRoom] = useState('general');

    useEffect(() => {
        serverConnection.on('chat_message', (message) => {
            setMessages(prev => [...prev, message]);
        });

        serverConnection.on('user_joined', (message) => {
            setMessages(prev => [...prev, {
                type: 'system',
                message: `${message.username} присоединился к комнате`
            }]);
        });

        serverConnection.on('user_left', (message) => {
            setMessages(prev => [...prev, {
                type: 'system',
                message: `${message.username} покинул комнату`
            }]);
        });
    }, []);

    const handleSendMessage = () => {
        if (!inputMessage.trim()) return;

        serverConnection.sendMessage({
            type: 'chat',
            message: inputMessage,
            room: currentRoom
        });

        setInputMessage('');
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    };

    return React.createElement('div', {
        style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: '#1a1a1a'
        }
    }, [
        // Заголовок чата
        React.createElement('div', {
            key: 'chat-header',
            style: {
                padding: '16px',
                background: '#2d2d30',
                borderBottom: '1px solid #484848',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }
        }, [
            React.createElement('div', {
                key: 'user-info',
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }
            }, [
                React.createElement('span', {
                    key: 'username',
                    style: {
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#ffffff'
                    }
                }, `👤 ${userInfo.username}`),
                userInfo.isAdmin && React.createElement('span', {
                    key: 'admin-badge',
                    style: {
                        padding: '4px 8px',
                        background: '#0078d4',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#ffffff'
                    }
                }, '⭐ ADMIN')
            ]),
            React.createElement('button', {
                key: 'logout-button',
                className: 'button-secondary',
                onClick: onLogout,
                style: {
                    padding: '8px 16px'
                }
            }, '🚪 Выход')
        ]),

        // Область сообщений
        React.createElement('div', {
            key: 'messages-area',
            style: {
                flex: 1,
                overflowY: 'auto',
                padding: '16px'
            }
        }, messages.map((msg, index) =>
            React.createElement('div', {
                key: index,
                style: {
                    marginBottom: '12px',
                    padding: '12px',
                    background: msg.type === 'system' ? '#2d2d30' : '#3c3c3c',
                    borderRadius: '8px',
                    borderLeft: msg.type === 'system' ? '3px solid #0078d4' : 'none'
                }
            }, [
                msg.username && React.createElement('div', {
                    key: 'username',
                    style: {
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#0078d4',
                        marginBottom: '4px'
                    }
                }, msg.username),
                React.createElement('div', {
                    key: 'message',
                    style: {
                        fontSize: '14px',
                        color: '#ffffff'
                    }
                }, msg.message),
                msg.timestamp && React.createElement('div', {
                    key: 'timestamp',
                    style: {
                        fontSize: '10px',
                        color: '#888',
                        marginTop: '4px'
                    }
                }, msg.timestamp)
            ])
        )),

        // Поле ввода сообщения
        React.createElement('div', {
            key: 'input-area',
            style: {
                padding: '16px',
                background: '#2d2d30',
                borderTop: '1px solid #484848',
                display: 'flex',
                gap: '12px'
            }
        }, [
            React.createElement('input', {
                key: 'message-input',
                className: 'input',
                type: 'text',
                value: inputMessage,
                onChange: (e) => setInputMessage(e.target.value),
                onKeyPress: handleKeyPress,
                placeholder: 'Введите сообщение...',
                style: {
                    flex: 1
                }
            }),
            React.createElement('button', {
                key: 'send-button',
                className: 'button-primary',
                onClick: handleSendMessage
            }, '📤 Отправить')
        ])
    ]);
}

// Запуск приложения
const root = createRoot(document.getElementById('app'));
root.render(React.createElement(App));
