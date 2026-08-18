// ============================================================
// Weather Widget — Real-time Jakarta Weather via OpenWeatherMap
// ============================================================
class WeatherWidget {
    constructor() {
        // 🔑 Replace with your own OpenWeatherMap API key
        // Get one for free at: https://openweathermap.org/api
        this.API_KEY = 'fdaf53a2e9c12ebb37ddd6d28f524558';
        this.CITY = 'Jakarta';
        this.API_URL = `https://api.openweathermap.org/data/2.5/weather?q=${this.CITY}&appid=${this.API_KEY}&units=metric&lang=id`;
        this.REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
        this.CACHE_KEY = 'weatherCache_jakarta';

        // DOM Elements
        this.widget = document.getElementById('weather-widget');
        this.loadingEl = document.getElementById('weather-loading');
        this.errorEl = document.getElementById('weather-error');
        this.dataEl = document.getElementById('weather-data');
        this.errorMsgEl = document.getElementById('weather-error-msg');
        this.retryBtn = document.getElementById('weather-retry-btn');

        // Data elements
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
        // Retry button
        this.retryBtn.addEventListener('click', () => this.fetchWeather());

        // Initial fetch
        this.fetchWeather();

        // Auto-refresh
        this.startAutoRefresh();
    }

    setState(state) {
        // state: 'loading' | 'data' | 'error'
        this.loadingEl.style.display = state === 'loading' ? 'flex' : 'none';
        this.dataEl.style.display = state === 'data' ? 'flex' : 'none';
        this.errorEl.style.display = state === 'error' ? 'flex' : 'none';

        // Animate widget class for color theming
        this.widget.classList.remove('weather--warm', 'weather--cool', 'weather--storm');
    }

    async fetchWeather() {
        this.setState('loading');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

            const response = await fetch(this.API_URL, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('API key tidak valid. Ganti API_KEY di script.js');
                }
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const data = await response.json();

            // Cache the successful response
            this.cacheWeather(data);

            // Render
            this.render(data);
        } catch (error) {
            console.error('Weather fetch error:', error);

            // Try loading from cache as fallback
            const cached = this.getCachedWeather();
            if (cached) {
                console.log('Using cached weather data');
                this.render(cached, true);
            } else {
                this.showError(error.name === 'AbortError'
                    ? 'Koneksi timeout. Periksa internet.'
                    : error.message || 'Gagal memuat data cuaca');
            }
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

        // Update DOM
        this.tempEl.textContent = `${temp}°C`;
        this.descEl.textContent = this.capitalizeFirst(description);
        this.humidityEl.textContent = `${humidity}%`;
        this.windEl.textContent = `${windSpeed} m/s`;
        this.feelsEl.textContent = `${feelsLike}°C`;
        this.iconEl.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
        this.iconEl.alt = description;

        // Update timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        this.updatedEl.textContent = isCached
            ? `Cache: ${timeStr}`
            : `Updated: ${timeStr}`;

        // Apply weather theme
        this.applyWeatherTheme(weatherId, temp);

        this.setState('data');

        // Entrance animation
        this.dataEl.classList.remove('weather-fade-in');
        void this.dataEl.offsetWidth; // trigger reflow
        this.dataEl.classList.add('weather-fade-in');
    }

    applyWeatherTheme(weatherId, temp) {
        this.widget.classList.remove('weather--warm', 'weather--cool', 'weather--storm');

        if (weatherId >= 200 && weatherId < 600) {
            // Rain or thunderstorm
            this.widget.classList.add('weather--storm');
        } else if (temp >= 30) {
            this.widget.classList.add('weather--warm');
        } else {
            this.widget.classList.add('weather--cool');
        }
    }

    showError(message) {
        this.errorMsgEl.textContent = message;
        this.setState('error');
    }

    cacheWeather(data) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to cache weather data:', e);
        }
    }

    getCachedWeather() {
        try {
            const cached = JSON.parse(localStorage.getItem(this.CACHE_KEY));
            if (cached && cached.data) {
                // Accept cache up to 30 minutes old
                if (Date.now() - cached.timestamp < 30 * 60 * 1000) {
                    return cached.data;
                }
            }
        } catch (e) {
            console.warn('Failed to read weather cache:', e);
        }
        return null;
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    startAutoRefresh() {
        setInterval(() => this.fetchWeather(), this.REFRESH_INTERVAL);
    }
}


// ============================================================
// Sound Player — Web Audio API for Todo interactions
// ============================================================
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


// ============================================================
// Todo App — Core Task Manager
// ============================================================
class TodoApp {
    constructor() {
        this.todos = JSON.parse(localStorage.getItem('todos')) || [];
        this.filter = 'all'; // all, active, completed
        this.soundPlayer = new SoundPlayer();

        // DOM Elements
        this.todoInput = document.getElementById('todo-input');
        this.todoList = document.getElementById('todo-list');
        this.itemsLeft = document.getElementById('items-left');
        this.filterBtns = document.querySelectorAll('.filter-btn');

        // Drag state
        this.draggedItemIndex = null;

        this.init();
    }

    init() {
        // Event Listeners
        this.todoInput.addEventListener('keydown', this.handleAdd.bind(this));

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
        li.style.animation = 'slideOut 0.3s ease forwards';
        this.soundPlayer.playDelete();
        setTimeout(() => {
            this.todos = this.todos.filter(t => t.id !== id);
            this.save();
            this.render();
        }, 300); // wait for animation
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

    // Drag and Drop Handlers
    handleDragStart(e, index) {
        this.draggedItemIndex = index;
        e.dataTransfer.effectAllowed = 'move';
        // Need setTimeout to allow visual feedback before opacity drops
        setTimeout(() => e.target.classList.add('dragging'), 0);
    }

    handleDragOver(e, index) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Simple reordering logic
        if (this.draggedItemIndex === null || this.draggedItemIndex === index) return;

        // Swap in array
        const draggedItem = this.todos.splice(this.draggedItemIndex, 1)[0];
        this.todos.splice(index, 0, draggedItem);
        this.draggedItemIndex = index;

        this.render(); // Re-render immediately for visual feedback
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedItemIndex = null;
        this.save();
        this.render();
    }

    render() {
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

            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'todo-checkbox';
            checkbox.checked = todo.completed;
            checkbox.addEventListener('change', () => this.handleToggle(todo.id));

            // Text container
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

            // Double click to edit
            textSpan.addEventListener('dblclick', () => this.handleEditStart(li, todo, textSpan, editInput));
            editInput.addEventListener('blur', () => this.handleEditEnd(li, todo, editInput));
            editInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') editInput.blur();
                if (e.key === 'Escape') {
                    li.classList.remove('editing');
                    editInput.value = todo.text;
                }
            });

            // Delete button
            const delBtn = document.createElement('button');
            delBtn.className = 'todo-delete';
            delBtn.innerHTML = '&#10005;'; // X mark
            delBtn.addEventListener('click', () => this.handleDelete(todo.id, li));

            // Drag events
            li.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
            li.addEventListener('dragover', (e) => this.handleDragOver(e, index));
            li.addEventListener('dragend', (e) => this.handleDragEnd(e));

            li.appendChild(checkbox);
            li.appendChild(textContainer);
            li.appendChild(delBtn);

            this.todoList.appendChild(li);
        });

        // Update items left
        const activeCount = this.todos.filter(t => !t.completed).length;
        this.itemsLeft.textContent = `${activeCount} item${activeCount !== 1 ? 's' : ''} left`;
    }
}


// ============================================================
// Initialize on DOM Load
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    new WeatherWidget();
    new TodoApp();
});
