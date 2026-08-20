class WeatherWidget {
    constructor() {
        this.API_KEY = 'fdaf53a2e9c12ebb37ddd6d28f524558';
        this.currentCity = localStorage.getItem('weatherCity') || 'Jakarta';
        this.REFRESH_INTERVAL = 10 * 60 * 1000;

        this.widget = document.getElementById('weather-widget');
        this.loadingEl = document.getElementById('weather-loading');
        this.errorEl = document.getElementById('weather-error');
        this.dataEl = document.getElementById('weather-data');
        this.errorMsgEl = document.getElementById('weather-error-msg');
        this.errorDetailsEl = document.getElementById('weather-error-details');
        this.retryBtn = document.getElementById('weather-retry-btn');

        this.searchForm = document.getElementById('weather-search-form');
        this.cityInput = document.getElementById('weather-city-input');
        this.cityNameEl = document.getElementById('weather-city-name');

        this.iconEl = document.getElementById('weather-icon');
        this.tempEl = document.getElementById('weather-temp');
        this.descEl = document.getElementById('weather-desc');
        this.humidityEl = document.getElementById('weather-humidity');
        this.windEl = document.getElementById('weather-wind');
        this.feelsEl = document.getElementById('weather-feels');
        this.updatedEl = document.getElementById('weather-updated');

        this.init();
    }

    init() {
        if (this.searchForm) {
            this.searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const query = this.cityInput ? this.cityInput.value.trim() : '';
                if (query) {
                    this.fetchWeather(query);
                }
            });
        }

        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => this.fetchWeather(this.currentCity));
        }

        if (this.cityInput) {
            this.cityInput.value = this.currentCity;
        }

        this.fetchWeather(this.currentCity);
        this.startAutoRefresh();
    }

    setState(state) {
        if (this.loadingEl) this.loadingEl.style.display = state === 'loading' ? 'flex' : 'none';
        if (this.dataEl) this.dataEl.style.display = state === 'data' ? 'flex' : 'none';
        if (this.errorEl) this.errorEl.style.display = state === 'error' ? 'flex' : 'none';

        if (this.widget) this.widget.classList.remove('weather--warm', 'weather--cool', 'weather--storm');
    }

    async fetchWeather(targetCity = this.currentCity) {
        this.setState('loading');
        const cityToFetch = targetCity.trim() || 'Jakarta';

        if (!navigator.onLine) {
            const offlineError = new Error('Browser Offline: Perangkat tidak terhubung ke jaringan internet.');
            this.handleWeatherError('NETWORK_OFFLINE', offlineError, {
                mainMsg: 'Tidak Ada Koneksi Internet',
                details: 'Browser mendeteksi mode offline. Periksa Wi-Fi atau koneksi data seluler Anda.',
                recommendation: 'Hubungkan ke internet lalu tekan "Coba Lagi".'
            }, cityToFetch);
            return;
        }

        try {
            const controller = new AbortController();
            const timeoutMs = 8000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityToFetch)}&appid=${this.API_KEY}&units=metric&lang=id`;

            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorReason = '';
                let recommendation = '';

                if (response.status === 401) {
                    errorReason = '401 Unauthorized: API Key tidak valid atau belum diaktivasi oleh OpenWeatherMap.';
                    recommendation = 'Periksa API Key di script.js atau pastikan key sudah aktif di dashboard OpenWeatherMap.';
                } else if (response.status === 404) {
                    errorReason = `Kota "${cityToFetch}" tidak ditemukan.`;
                    recommendation = 'Periksa kembali ejaan nama kota (contoh: Jakarta, Bandung, Surabaya, Tokyo, London).';
                } else if (response.status === 429) {
                    errorReason = '429 Too Many Requests: Batas kuota panggilan API gratis telah terlampaui.';
                    recommendation = 'Tunggu beberapa menit sebelum mencoba kembali.';
                } else if (response.status >= 500) {
                    errorReason = `HTTP ${response.status} Server Error: Server OpenWeatherMap sedang bermasalah.`;
                    recommendation = 'Coba beberapa saat lagi.';
                } else {
                    errorReason = `HTTP Error ${response.status}: ${response.statusText}`;
                    recommendation = 'Terjadi masalah pada respon server cuaca.';
                }

                throw {
                    isHttpError: true,
                    status: response.status,
                    statusText: response.statusText,
                    reason: errorReason,
                    recommendation
                };
            }

            const data = await response.json();
            this.currentCity = data.name || cityToFetch;
            localStorage.setItem('weatherCity', this.currentCity);

            if (this.cityInput) {
                this.cityInput.value = this.currentCity;
            }

            this.cacheWeather(this.currentCity, data);
            this.render(data);
        } catch (error) {
            let errorType = 'FETCH_ERROR';
            let mainMsg = 'Gagal memuat data cuaca';
            let details = '';
            let rec = '';

            if (error.name === 'AbortError') {
                errorType = 'TIMEOUT_ERROR';
                mainMsg = 'Koneksi Timeout (8 Detik)';
                details = 'Permintaan ke API OpenWeatherMap melebihi batas waktu 8 detik.';
                rec = 'Jaringan internet lambat atau server tidak merespon.';
            } else if (error.isHttpError) {
                errorType = `HTTP_${error.status}`;
                mainMsg = error.status === 404 ? `Kota tidak ditemukan` : `Error HTTP ${error.status}`;
                details = error.reason;
                rec = error.recommendation;
            } else {
                errorType = 'NETWORK_OR_CORS_ERROR';
                mainMsg = 'Gagal terhubung ke web API';
                details = `Tidak dapat terhubung ke server cuaca (${error.message || 'TypeError: Failed to fetch'}).`;
                rec = 'Kemungkinan penyebab: AdBlocker / Ekstensi Privasi blocking `api.openweathermap.org`, Firewall/Proxy, atau Sertifikat SSL/DNS bermasalah.';
            }

            this.handleWeatherError(errorType, error, { mainMsg, details, rec }, cityToFetch);
        }
    }

    handleWeatherError(type, errorObj, info, targetCity) {
        const { mainMsg, details, rec } = info;
        const cached = this.getCachedWeather(targetCity);
        if (cached) {
            this.render(cached, true);
        } else {
            this.showError(mainMsg, `${details} ${rec}`);
        }
    }

    render(data, isCached = false) {
        const temp = Math.round(data.main.temp);
        const feelsLike = Math.round(data.main.feels_like);
        const description = data.weather[0].description;
        const iconCode = data.weather[0].icon;
        const humidity = data.main.humidity;
        const windSpeed = data.wind.speed;
        const weatherId = data.weather[0].id;
        const cityName = data.name;
        const country = data.sys && data.sys.country ? `, ${data.sys.country}` : '';

        if (this.cityNameEl) this.cityNameEl.textContent = `${cityName}${country}`;
        if (this.tempEl) this.tempEl.textContent = `${temp}°C`;
        if (this.descEl) this.descEl.textContent = this.capitalizeFirst(description);
        if (this.humidityEl) this.humidityEl.textContent = `${humidity}%`;
        if (this.windEl) this.windEl.textContent = `${windSpeed} m/s`;
        if (this.feelsEl) this.feelsEl.textContent = `${feelsLike}°C`;
        if (this.iconEl) {
            this.iconEl.src = this.getWeatherIconUrl(iconCode);
            this.iconEl.alt = description;
        }

        const recEl = document.getElementById('weather-recommendation');
        if (recEl) {
            let recommendation = "Jaga kesehatan dan tetap semangat beraktivitas!";
            if (weatherId >= 200 && weatherId < 600) {
                recommendation = "Sedang hujan/badai, siapkan payung atau jas hujan & hati-hati di jalan.";
            } else if (weatherId >= 600 && weatherId < 700) {
                recommendation = "Cuaca bersalju, kenakan pakaian hangat dan jaga daya tahan tubuh.";
            } else if (temp >= 32) {
                recommendation = "Cuaca cukup terik, perbanyak minum air putih & hindari paparan matahari langsung.";
            } else if (temp >= 24 && temp < 32) {
                recommendation = "Cuaca cerah dan bersahabat, sangat cocok untuk beraktivitas.";
            } else if (temp < 24) {
                recommendation = "Udara sejuk & segar, jaga kondisi tubuh agar tetap hangat.";
            }
            recEl.textContent = recommendation;
        }

        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        if (this.updatedEl) {
            this.updatedEl.textContent = isCached
                ? `Cache: ${timeStr}`
                : `Updated: ${timeStr}`;
        }

        this.applyWeatherTheme(weatherId, temp);
        this.setState('data');

        if (this.dataEl) {
            this.dataEl.classList.remove('weather-fade-in');
            void this.dataEl.offsetWidth;
            this.dataEl.classList.add('weather-fade-in');
        }
    }

    applyWeatherTheme(weatherId, temp) {
        if (!this.widget) return;
        this.widget.classList.remove('weather--warm', 'weather--cool', 'weather--storm');
        if (weatherId >= 200 && weatherId < 600) {
            this.widget.classList.add('weather--storm');
        } else if (temp >= 30) {
            this.widget.classList.add('weather--warm');
        } else {
            this.widget.classList.add('weather--cool');
        }
    }

    showError(message, details = '') {
        if (this.errorMsgEl) this.errorMsgEl.textContent = message;
        if (this.errorDetailsEl) {
            this.errorDetailsEl.textContent = details;
            this.errorDetailsEl.style.display = details ? 'block' : 'none';
        }
        this.setState('error');
    }

    cacheWeather(cityName, data) {
        try {
            const cacheKey = `weatherCache_${cityName.toLowerCase().replace(/\s+/g, '_')}`;
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
        }
    }

    getCachedWeather(cityName) {
        try {
            const cacheKey = `weatherCache_${cityName.toLowerCase().replace(/\s+/g, '_')}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey));
            if (cached && cached.data) {
                if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
                    return cached.data;
                }
            }
        } catch (e) {
        }
        return null;
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getWeatherIconUrl(iconCode) {
        const iconMap = {
            '01d': 'clear-day.svg',
            '01n': 'clear-night.svg',
            '02d': 'partly-cloudy-day.svg',
            '02n': 'partly-cloudy-night.svg',
            '03d': 'cloudy.svg',
            '03n': 'cloudy.svg',
            '04d': 'overcast-day.svg',
            '04n': 'overcast-night.svg',
            '09d': 'rain.svg',
            '09n': 'rain.svg',
            '10d': 'partly-cloudy-day-rain.svg',
            '10n': 'partly-cloudy-night-rain.svg',
            '11d': 'thunderstorms-rain.svg',
            '11n': 'thunderstorms-rain.svg',
            '13d': 'snow.svg',
            '13n': 'snow.svg',
            '50d': 'mist.svg',
            '50n': 'mist.svg'
        };

        const svgName = iconMap[iconCode];
        if (svgName) {
            return `https://cdn.jsdelivr.net/gh/basmilius/weather-icons@dev/production/fill/svg/${svgName}`;
        }
        return `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
    }

    startAutoRefresh() {
        setInterval(() => this.fetchWeather(), this.REFRESH_INTERVAL);
    }
}

class SoundPlayer {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, type, duration, vol = 0.1) {
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        gainNode.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + duration);
    }

    playAdd() {
        this.playTone(600, 'sine', 0.15);
        setTimeout(() => this.playTone(800, 'sine', 0.2), 100);
    }

    playComplete() {
        this.playTone(500, 'triangle', 0.1);
        setTimeout(() => this.playTone(1000, 'triangle', 0.2), 100);
    }

    playDelete() {
        this.playTone(300, 'square', 0.1, 0.05);
        setTimeout(() => this.playTone(150, 'square', 0.2, 0.05), 100);
    }
}

class TodoApp {
    constructor() {
        this.todos = JSON.parse(localStorage.getItem('todos')) || [];
        this.filter = 'all';
        this.soundPlayer = new SoundPlayer();

        this.todoInput = document.getElementById('todo-input');
        this.todoList = document.getElementById('todo-list');
        this.itemsLeft = document.getElementById('items-left');
        this.filterBtns = document.querySelectorAll('.filter-btn');

        this.draggedItemIndex = null;

        this.init();
    }

    init() {
        if (this.todoInput) {
            this.todoInput.addEventListener('keydown', this.handleAdd.bind(this));
        }

        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filter = e.target.dataset.filter;
                this.render();
            });
        });

        this.render();
    }

    save() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
    }

    handleAdd(e) {
        if (e.key === 'Enter' && this.todoInput.value.trim() !== '') {
            const newTodo = {
                id: Date.now().toString(),
                text: this.todoInput.value.trim(),
                completed: false,
                date: new Date().toISOString()
            };
            this.todos.push(newTodo);
            this.save();
            this.todoInput.value = '';
            this.soundPlayer.playAdd();
            this.render();
        }
    }

    handleDelete(id, li) {
        li.style.animation = 'slideOut 0.2s ease forwards';
        this.soundPlayer.playDelete();
        setTimeout(() => {
            this.todos = this.todos.filter(t => t.id !== id);
            this.save();
            this.render();
        }, 200);
    }

    handleToggle(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            if (todo.completed) this.soundPlayer.playComplete();
            this.save();
            this.render();
        }
    }

    handleEditStart(li, todo, textSpan, editInput) {
        li.classList.add('editing');
        editInput.value = todo.text;
        editInput.focus();
    }

    handleEditEnd(li, todo, editInput) {
        li.classList.remove('editing');
        const newText = editInput.value.trim();
        if (newText && newText !== todo.text) {
            todo.text = newText;
            this.save();
            this.render();
        }
    }

    handleDragStart(e, index) {
        this.draggedItemIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.classList.add('dragging'), 0);
    }

    handleDragOver(e, index) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (this.draggedItemIndex === null || this.draggedItemIndex === index) return;

        const draggedItem = this.todos.splice(this.draggedItemIndex, 1)[0];
        this.todos.splice(index, 0, draggedItem);
        this.draggedItemIndex = index;

        this.render();
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedItemIndex = null;
        this.save();
        this.render();
    }

    render() {
        if (!this.todoList) return;
        this.todoList.innerHTML = '';

        let filteredTodos = this.todos;
        if (this.filter === 'active') {
            filteredTodos = this.todos.filter(t => !t.completed);
        } else if (this.filter === 'completed') {
            filteredTodos = this.todos.filter(t => t.completed);
        }

        filteredTodos.forEach((todo, index) => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
            li.draggable = true;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'todo-checkbox';
            checkbox.checked = todo.completed;
            checkbox.addEventListener('change', () => this.handleToggle(todo.id));

            const weatherTag = document.createElement('span');
            weatherTag.className = 'task-weather-icon';
            weatherTag.setAttribute('title', 'Tenggat hari ini — Terintegrasi dengan kondisi cuaca');
            weatherTag.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;

            const textContainer = document.createElement('div');
            textContainer.className = 'todo-text-container';

            const textSpan = document.createElement('span');
            textSpan.className = 'todo-text';
            textSpan.textContent = todo.text;

            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.className = 'todo-edit-input';

            textContainer.appendChild(textSpan);
            textContainer.appendChild(editInput);

            textSpan.addEventListener('dblclick', () => this.handleEditStart(li, todo, textSpan, editInput));
            editInput.addEventListener('blur', () => this.handleEditEnd(li, todo, editInput));
            editInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') editInput.blur();
                if (e.key === 'Escape') {
                    li.classList.remove('editing');
                    editInput.value = todo.text;
                }
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'todo-delete';
            delBtn.setAttribute('aria-label', 'Hapus tugas');
            delBtn.innerHTML = '<svg class="todo-delete-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
            delBtn.addEventListener('click', () => this.handleDelete(todo.id, li));

            li.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
            li.addEventListener('dragover', (e) => this.handleDragOver(e, index));
            li.addEventListener('dragend', (e) => this.handleDragEnd(e));

            li.appendChild(checkbox);
            li.appendChild(weatherTag);
            li.appendChild(textContainer);
            li.appendChild(delBtn);

            this.todoList.appendChild(li);
        });

        if (this.itemsLeft) {
            const activeCount = this.todos.filter(t => !t.completed).length;
            this.itemsLeft.textContent = `${activeCount} tugas tersisa`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = new Date().toLocaleDateString('id-ID', options).toUpperCase();
    }

    new WeatherWidget();
    new TodoApp();
});
