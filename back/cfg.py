import os

class Config:
    #замените yourpassword на свой пароль от пользователя в бд, замените log_user на имя пользователя которого вы создали в бд
    SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://log_user:yourpassword@localhost/apache_logs_db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    #введите рандомную длинную фразу
    JWT_SECRET_KEY = ('super-secret-key-for-my-project-12345')
    
    #парсер логов
    LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    LOG_PATTERN = 'access.log'
    
    #интервал фонового парсинга в секундах
    CRON_INTERVAL = int(os.getenv('CRON_INTERVAL', 3600))