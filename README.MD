# Агрегатор логов Apache

Веб-приложение на Python (Flask) для сбора, анализа и визуализации логов веб-сервера Apache с сохранением в MySQL.

## Возможности

- **Авторизация**: регистрация и вход пользователей (JWT-токены).
- **Парсинг логов**:
  - Ручной запуск через веб-интерфейс.
  - Автоматический фоновый сбор (имитация cron).
- **Аналитика**:
  - Просмотр логов с фильтрацией по датам и IP.
  - Группировка данных (по IP, по дате).
- **REST API**: получение данных в формате JSON.
- **Клиент**:
  - Обмен данными в фоновом режиме (Fetch API).
  - Реальное отображение прогресса загрузки.
  - Модальные окна для уведомлений.
  - Интерактивный список URL с просмотром деталей.

## Требования

- Python 3.8+
- MySQL Server
- DBeaver (для управления БД)
- Flask
- Flask-JWT-Extended
- Flask-SQLAlchemy
- Flask-APScheduler
- PyMySQL

## Структура проекта

```
practice/
├── back/
│ ├── app.py #точка входа, маршруты API
│ ├── cfg.py #конфигурация (БД, JWT, пути к логам)
│ ├── db_models.py #модели SQLAlchemy (User, ApacheLog)
│ ├── parser.py #парсер Apache-логов
│ ├── auth.py #вспомогательные функции авторизации
│ └── logs/
│ └── access.log
├── front/
│ ├── templates/
│ │ └── index.html
│ └── static/
│ ├── js/
│ │ └── app.js #клиентская логика
│ └── css/
│ └── style.css
├── requirements.txt #зависимости Python
│
│
│
├──README.md

```

# Установка

1. Клонирование репозитория:

``` bash
    Win+R 
    cmd
    git clone <https://github.com/genzuuwqe/apache_log_parser>
    cd practice
```

2. Настройка MySQL:
    Установите MySQL Server.
    Создайте БД:

    ```
    CREATE DATABASE apache_logs_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER 'log_user'@'localhost' IDENTIFIED BY 'your_password';
    GRANT ALL PRIVILEGES ON apache_logs_db.* TO 'log_user'@'localhost';
    FLUSH PRIVILEGES;
    ```

    (ЗАПУСКАТЬ ПО ОЧЕРЕДИ КАЖДУЮ СТРОКУ)

3. Настройка окружения:

```
    # Windows
        python -m venv venv
        venv\Scripts\activate

    # Linux/Mac
        python3 -m venv venv
        source venv/bin/activate
```

4. Установите зависимости:

```
pip install -r requirements.txt.
```

5. Конфигурация:
    Отредактируйте config.py, задайте переменные окружения (DATABASE_URL, JWT_SECRET_KEY, LOG_DIR).
    В файле cfg.py описано подробнее

5. Запуск:
```
    cd back
```

    Запустите приложение:
``` python app.py.
```
    Откройте браузер по адресу
```
    http://127.0.0.1:5000
```

# Использование

1. Регистрация: при первом входе введите любой логин и пароль и нажмите «Регистрация», пользователь создан!
2. Вход: введите логин и пароль.
3. Парсинг: нажмите «Запустить парсинг вручную» - данные из logs/access.log попадут в БД.
4. Автоматический запуск: Парсинг выполняется автоматически каждые CRON_INTERVAL секунд (по умолчанию 1 час)
5. Поиск:
    1) Поле «Ключевое слово» - фильтрация по IP или URL.
    2) Поля дат — выбор временного промежутка.
    3) Выпадающий список - группировка по IP или дате.
6. Результаты: кликните на запись, чтобы увидеть её детали в блоке «Выбранный контент».
7. Выход: кнопка «Выйти» в правом верхнем углу.

# API

Все endpoints требуют JWT-токен (кроме /api/register и /api/login).

```
МЕТОД   URL             ОПИСАНИЕ
POST    /api/register   Регистрация нового пользователя
POST    /api/login      Вход, возвращает JWT-токен
GET     /api/logs       Получение логов
POST    /api/parse      Запуск парсинга вручную
```
Параметры для /api/logs:
start_date - начальная дата (YYYY-MM-DD)
end_date - конечная дата (YYYY-MM-DD)
ip - фильтр по IP адресу
group_by - группировка (ip или date)
page - номер страницы (для пагинации)
per_page - записей на страницу

Фоновый парсинг (Cron)
Приложение использует APScheduler для автоматического парсинга логов:
Интервал настраивается в cfg.py (CRON_INTERVAL)
По умолчанию: 3600 секунд (1 час)
При перезапуске сервера планировщик запускается автоматически