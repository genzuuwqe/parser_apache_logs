let token = localStorage.getItem('token');

function showModal(title, message, type = 'info') {
    let modal = document.getElementById('custom-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
            z-index: 1000; font-family: sans-serif;
        `;
        document.body.appendChild(modal);
    }
    
    const color = type === 'error' ? '#e74c3c' : (type === 'success' ? '#27ae60' : '#3498db');
    
    modal.innerHTML = `
        <div style="background: white; padding: 25px; border-radius: 8px; max-width: 400px; width: 90%; box-shadow: 0 4px 15px rgba(0,0,0,0.2); text-align: center;">
            <h3 style="color: ${color}; margin-top: 0;">${title}</h3>
            <p style="margin-bottom: 20px; color: #333;">${message}</p>
            <button onclick="closeModal()" style="padding: 10px 25px; background: ${color}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">OK</button>
        </div>
    `;
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    if (modal) modal.remove();
}

async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const response = await fetch(`/api${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        if (response.status === 401) {
            logout();
            showModal("Сессия истекла", "Пожалуйста, войдите в систему заново.", "error");
            return null;
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.msg || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        return null;
    }
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showModal("Внимание", "Заполните все поля", "error");
        return;
    }

    const data = await apiCall('/login', 'POST', { username, password });
    
    if (data && data.access_token) {
        token = data.access_token;
        localStorage.setItem('token', token);
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('app-section').classList.remove('hidden');
    }
}

async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showModal("Ошибка", "Введите логин и пароль", "error");
        return;
    }

    const data = await apiCall('/register', 'POST', { username, password });
    if (data) {
        showModal("Успех", data.msg, "success");
    }
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    
    document.getElementById('app-section').classList.add('hidden');
    document.getElementById('auth-section').classList.remove('hidden');
    
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('results-list').innerHTML = '';
    document.getElementById('selected-content').textContent = '';
    document.getElementById('parse-status').innerText = '';
}

async function triggerParse() {
    const statusDiv = document.getElementById('parse-status');
    statusDiv.innerText = "Запуск парсинга...";
    statusDiv.style.color = "#333";
    
    const res = await apiCall('/parse', 'POST');
    if (res) {
        statusDiv.innerText = res.msg;
        statusDiv.style.color = "green";
    } else {
        statusDiv.innerText = "Ошибка при парсинге";
        statusDiv.style.color = "red";
    }
}

async function fetchLogs() {
    const keyword = document.getElementById('keyword').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const groupBy = document.getElementById('group-by').value;
    
    const progressBar = document.getElementById('progress-bar');
    const loadStatus = document.getElementById('load-status');
    
    progressBar.style.width = '0%';
    loadStatus.innerText = "Подключение...";

    let query = `?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`;
    if (keyword) query += `&ip=${keyword}`;

    try {
        const response = await fetch(`/api/logs${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            logout();
            showModal("Сессия истекла", "Пожалуйста, войдите снова.", "error");
            return;
        }

        if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);

        const contentLength = +response.headers.get('Content-Length');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let receivedLength = 0; 
        let chunks = []; 

        while(true) {
            const {done, value} = await reader.read();
            if (done) break;
            
            chunks.push(value);
            receivedLength += value.length;
            
            if (contentLength) {
                const percent = Math.round((receivedLength / contentLength) * 100);
                progressBar.style.width = percent + '%';
                loadStatus.innerText = `Загрузка: ${(receivedLength / 1024).toFixed(1)} КБ (${percent}%)`;
            } else {
                loadStatus.innerText = `Загрузка: ${(receivedLength / 1024).toFixed(1)} КБ...`;
            }
        }

        let chunksAll = new Uint8Array(receivedLength);
        let position = 0;
        for(let chunk of chunks) {
            chunksAll.set(chunk, position);
            position += chunk.length;
        }
        
        const resultText = decoder.decode(chunksAll);
        const data = JSON.parse(resultText);
        
        progressBar.style.width = '100%';
        loadStatus.innerText = "Готово";
        
        renderResults(data);

    } catch (error) {
        showModal("Ошибка", error.message, "error");
        loadStatus.innerText = "Ошибка загрузки";
    }
}

function renderResults(data) {
    const list = document.getElementById('results-list');
    list.innerHTML = '';

    let itemsToRender = [];
    if (Array.isArray(data)) {
        itemsToRender = data;
    } else if (data.items) {
        itemsToRender = data.items;
    }

    if (itemsToRender.length === 0) {
        list.innerHTML = '<li style="padding:10px; color:#777;">Нет данных для отображения</li>';
        return;
    }

    itemsToRender.forEach(item => {
        const li = document.createElement('li');
        li.style.cssText = `padding: 10px; margin-bottom: 5px; background: white; border-radius: 5px; cursor: pointer; border: 1px solid #ddd;`;
        
        let html = '';

        if (item.date && item.count) {
            html = `<b>${item.date}</b>: ${item.count} запросов`;
        } else if (item.ip && item.count) {
            html = `<b>IP: ${item.ip}</b>: ${item.count} запросов`;
        } else {
            const statusColor = item.status >= 400 ? '#e74c3c' : '#27ae60';
            html = `
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:${statusColor}; font-weight:bold;">[${item.status}]</span>
                    <span style="color:#888; font-size:0.9em;">${item.time ? item.time.split('T')[0] : ''}</span>
                </div>
                <div style="margin-top:5px; word-break:break-all;">${item.url}</div>
                <div style="font-size:0.8em; color:#666; margin-top:2px;">IP: ${item.ip}</div>
            `;
        }

        li.innerHTML = html;
        li.onclick = () => {
            document.getElementById('selected-content').textContent = JSON.stringify(item, null, 2);
        };
        list.appendChild(li);
    });
}

if (token) {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
}