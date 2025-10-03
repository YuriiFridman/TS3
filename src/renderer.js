const { useState, useEffect } = React;
const { createRoot } = ReactDOM;
const { ipcRenderer } = require('electron');

// Класс для работы с сервером через IPC
class ServerConnection {
    constructor() {
        this.isConnected = false;
        this.callbacks = {};
        this.setupIPC();
    }

    setupIPC() {
        // Обработчики сообщений от main процесса
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
        try {
            await ipcRenderer.invoke('connect-to-server', { host, port });
            this.isConnected = true;
            return true;
        } catch (error) {
            console.error('Ошибка подключения:', error);
            throw error;
        }
    }

    sendMessage(message) {
        if (this.isConnected) {
            console.log('Отправка сообщения на сервер:', message);
            ipcRenderer.invoke('send-to-server', message);
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
        ipcRenderer.invoke('disconnect-from-server');
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

// Компонент заголовка окна (остается тот же)
function TitleBar() {
    const handleClose = () => {
        ipcRenderer.invoke('close-window');
    };

    const handleMinimize = () => {
        ipcRenderer.invoke('minimize-window');
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
            WebkitAppRegion: 'drag'
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

        React.createElement('div', {
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
        ])
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

    // Обновляем статус при успешном входе/ошибке
    useEffect(() => {
        const handleLoginSuccess = () => {
            setStatus('✅ Успешно подключен');
            setIsConnecting(false);
        };

        const handleError = (message) => {
            setStatus('❌ ' + message.message);
            setIsConnecting(false);
        };

        serverConnection.on('login_success', handleLoginSuccess);
        serverConnection.on('error', handleError);

    }, []);

    return React.createElement('div', {
        style: {
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
                    placeholder: 'Введите ваше имя',
                    disabled: isConnecting
                })
            ]),

            // Поле пароля
            React.createElement('div', {
                key: 'password-field',
                style: { marginBottom: '32px' }
            }, [
                React.createElement('label', {
                    key: 'password-label',
                    style: {
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#ffffff'
                    }
                }, '🔑 Пароль'),
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
                    key: 'connect-btn',
                    className: 'btn',
                    onClick: handleConnect,
                    disabled: isConnecting,
                    style: { flex: 1 }
                }, isConnecting ? '⏳ Подключение...' : '🚀 Войти'),

                React.createElement('button', {
                    key: 'register-btn',
                    className: 'btn btn-success',
                    onClick: handleRegister,
                    disabled: isConnecting,
                    style: { flex: 1 }
                }, '📝 Регистрация')
            ]),

            // Статус
            React.createElement('div', {
                key: 'status',
                style: {
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: status.includes('✅') ? '#4EC9B0' :
                           status.includes('❌') ? '#f44747' : '#cccccc'
                }
            }, status),

            // Информация для тестирования
            React.createElement('div', {
                key: 'test-info',
                style: {
                    marginTop: '20px',
                    padding: '16px',
                    background: '#383838',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#cccccc'
                }
            }, [
                React.createElement('div', {
                    key: 'test-title',
                    style: { fontWeight: '600', marginBottom: '8px' }
                }, '🧪 Тестовые данные:'),
                React.createElement('div', { key: 'admin' }, '👑 admin / admin123'),
                React.createElement('div', { key: 'user' }, '👤 Или зарегистрируйте нового пользователя')
            ])
        ])
    );
}

// ФУНКЦИОНАЛЬНЫЙ экран чата (вместо заглушки!)
function ChatScreen({ userInfo, onLogout }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentRoom, setCurrentRoom] = useState('general');

    useEffect(() => {
        // Настройка обработчиков сообщений чата
        serverConnection.on('chat_message', (message) => {
            setMessages(prev => [...prev, message]);
        });

        serverConnection.on('user_joined', (message) => {
            setMessages(prev => [...prev, {
                type: 'system',
                message: `${message.username} присоединился к чату`,
                timestamp: message.timestamp
            }]);
        });

        serverConnection.on('user_left', (message) => {
            setMessages(prev => [...prev, {
                type: 'system',
                message: `${message.username} покинул чат`,
                timestamp: message.timestamp
            }]);
        });

        // Запрос списка пользователей и комнат
        serverConnection.sendMessage({ type: 'get_users' });
        serverConnection.sendMessage({ type: 'get_rooms' });

    }, []);

    const sendMessage = () => {
        if (newMessage.trim()) {
            serverConnection.sendMessage({
                type: 'chat',
                message: newMessage
            });
            setNewMessage('');
        }
    };

    return React.createElement('div', {
        style: {
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }
    }, [
        // Заголовок чата
        React.createElement('div', {
            key: 'chat-header',
            style: {
                padding: '16px',
                borderBottom: '1px solid #484848',
                background: '#2d2d30',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }
        }, [
            React.createElement('h2', {
                key: 'title',
                style: {
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#ffffff',
                    margin: 0
                }
            }, `💬 #${currentRoom} - Добро пожаловать, ${userInfo?.username}! ${userInfo?.isAdmin ? '👑' : '👤'}`),

            React.createElement('button', {
                key: 'logout',
                className: 'btn btn-danger',
                onClick: onLogout,
                style: { padding: '8px 16px' }
            }, '🚪 Выйти')
        ]),

        // Сообщения
        React.createElement('div', {
            key: 'messages',
            style: {
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
            }
        }, messages.length === 0 ?
            React.createElement('div', {
                style: {
                    textAlign: 'center',
                    color: '#888888',
                    marginTop: '50px'
                }
            }, 'Нет сообщений. Начните общение! 💬') :
            messages.map((msg, index) =>
                React.createElement('div', {
                    key: index,
                    style: {
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: msg.type === 'system' ? '#383838' : '#2d2d30',
                        border: '1px solid #484848'
                    }
                }, [
                    msg.type !== 'system' ? React.createElement('div', {
                        key: 'header',
                        style: {
                            fontSize: '12px',
                            color: '#007acc',
                            marginBottom: '4px',
                            fontWeight: '600'
                        }
                    }, `${msg.username} • ${msg.timestamp}`) : null,
                    React.createElement('div', {
                        key: 'content',
                        style: {
                            fontSize: '14px',
                            color: msg.type === 'system' ? '#888888' : '#ffffff'
                        }
                    }, msg.message)
                ])
            )
        ),

        // Поле ввода сообщения
        React.createElement('div', {
            key: 'message-input',
            style: {
                padding: '16px',
                borderTop: '1px solid #484848',
                background: '#2d2d30',
                display: 'flex',
                gap: '12px'
            }
        }, [
            React.createElement('input', {
                key: 'input',
                className: 'input',
                type: 'text',
                value: newMessage,
                onChange: (e) => setNewMessage(e.target.value),
                onKeyPress: (e) => e.key === 'Enter' && sendMessage(),
                placeholder: 'Введите сообщение...',
                style: { flex: 1 }
            }),
            React.createElement('button', {
                key: 'send',
                className: 'btn',
                onClick: sendMessage,
                style: { padding: '16px 24px' }
            }, '📤 Отправить')
        ])
    ]);
}

// Запуск приложения
const root = createRoot(document.getElementById('app'));
root.render(React.createElement(App));