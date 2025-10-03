const { useState, useEffect } = React;
const { createRoot } = ReactDOM;

// Главный компонент приложения
function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState(null);

    return (
        <div className="app-container">
            <TitleBar />
            <MainContent>
                {!isLoggedIn ? (
                    <LoginScreen onLogin={setUserInfo} setLoggedIn={setIsLoggedIn} />
                ) : (
                    <ChatScreen userInfo={userInfo} onLogout={() => {
                        setIsLoggedIn(false);
                        setUserInfo(null);
                    }} />
                )}
            </MainContent>
        </div>
    );
}

// Компонент заголовка окна
function TitleBar() {
    const handleClose = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('close-window');
        }
    };

    const handleMinimize = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
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

// Экран входа
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
        if (!formData.username) {
            setStatus('⚠️ Введите имя пользователя');
            return;
        }

        setIsConnecting(true);
        setStatus('⏳ Подключение...');

        // Симуляция подключения
        setTimeout(() => {
            setStatus('✅ Подключено к серверу');
            onLogin({
                username: formData.username,
                server: formData.server,
                isAdmin: formData.username === 'admin'
            });
            setLoggedIn(true);
            setIsConnecting(false);
        }, 1500);
    };

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
                    placeholder: 'localhost'
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
                    placeholder: 'Введите ваше имя'
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
                    placeholder: 'Введите пароль'
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
            }, status)
        ])
    );
}

// Экран чата
function ChatScreen({ userInfo, onLogout }) {
    return React.createElement('div', {
        style: {
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px'
        }
    }, [
        React.createElement('h2', {
            key: 'welcome',
            style: {
                color: '#007acc',
                textAlign: 'center',
                marginTop: '50px'
            }
        }, `Добро пожаловать, ${userInfo?.username}! 🎉`),

        React.createElement('p', {
            key: 'message',
            style: {
                textAlign: 'center',
                marginTop: '20px',
                color: '#cccccc'
            }
        }, 'Функции чата скоро будут добавлены...'),

        React.createElement('button', {
            key: 'logout',
            className: 'btn btn-danger',
            onClick: onLogout,
            style: {
                maxWidth: '200px',
                margin: '50px auto'
            }
        }, '🚪 Выйти')
    ]);
}

// Запуск приложения
const root = createRoot(document.getElementById('app'));
root.render(React.createElement(App));