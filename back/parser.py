import re
import glob
import os
from datetime import datetime
from db_models import db, ApacheLog

LOG_PATTERN = re.compile(
    r'(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d{3}) (\S+) "[^"]*" "([^"]*)"')

def parse_log_line(line):
    match = LOG_PATTERN.match(line)
    if not match:
        return None
    
    try:
        ip, time_str, method, url, status, size, user_agent = match.groups()
        
        dt_object = datetime.strptime(time_str, '%d/%b/%Y:%H:%M:%S %z')
        
        if size == '-':
            size = 0
        else:
            size = int(size)
            
        return {
            'ip_address': ip,
            'timestamp': dt_object,
            'method': method,
            'url': url,
            'status_code': int(status),
            'size': size,
            'user_agent': user_agent
        }
    except Exception:
        return None

def process_logs(log_dir, pattern):
    path = os.path.join(log_dir, pattern)
    files = glob.glob(path)
    
    if not files:
        return 0
    
    # Очищаем базу перед парсингом
    ApacheLog.query.delete()
    db.session.commit()
    
    processed_count = 0
    
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                        
                    data = parse_log_line(line)
                    if data:
                        log_entry = ApacheLog(**data)
                        db.session.add(log_entry)
                        processed_count += 1
                
                db.session.commit()
                
        except Exception:
            db.session.rollback()
    
    return processed_count