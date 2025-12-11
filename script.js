import { getDb } from './firebase.js';
import { ref, set, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

const db = getDb();

// --- STATE MANAGEMENT ---
const state = {
    currentUser: null,
    currentRoomId: null,
    rooms: {}, // Simularemos la DB aquí: { roomId: { config, users: [{name, availability: []}] } }
    isAdmin: false
};

// --- DOM ELEMENTS ---
const views = {
    home: document.getElementById('view-home'),
    create: document.getElementById('view-create'),
    calendar: document.getElementById('view-calendar'),
    results: document.getElementById('view-results')
};

// --- INIT ---
function init() {
    // loadFromStorage();
    setupEventListeners();

    // Check URL params for auto-join (optional enhancement)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        document.getElementById('join-code').value = code;
    }
}

/*
function loadFromStorage() {
    const storedRooms = localStorage.getItem('horario_rooms');
    if (storedRooms) {
        state.rooms = JSON.parse(storedRooms);
    }
}

function saveToStorage() {
    localStorage.setItem('horario_rooms', JSON.stringify(state.rooms));
}
*/

async function saveRoomToFirebase(roomId, data) {
    await set(ref(db, "rooms/" + roomId), data);
}

async function loadRoomFromFirebase(roomId) {
    const snapshot = await get(ref(db, "rooms/" + roomId));
    return snapshot.exists() ? snapshot.val() : null;
}

// --- NAVIGATION ---
function showView(viewName) {
    Object.values(views).forEach(view => view.classList.add('hidden'));
    views[viewName].classList.remove('hidden');

    // Update active class for animation
    setTimeout(() => {
        views[viewName].classList.add('active');
    }, 10);
}

// --- LOGIC ---

function createRoom() {
    const username = document.getElementById('username').value.trim();
    if (!username) return showToast('Por favor ingresa tu nombre');

    state.currentUser = username;
    state.isAdmin = true;
    showView('create');
}

async function confirmCreateRoom() {
    const title = document.getElementById('cal-title').value.trim() || 'Evento Sin Título';
    const monthInput = document.getElementById('cal-month').value; // YYYY-MM

    if (!monthInput) return showToast('Selecciona un mes');

    const [year, month] = monthInput.split('-');
    const roomId = generateRoomId();

    // Create Room Object
    const newRoom = {
        id: roomId,
        title: title,
        year: parseInt(year),
        month: parseInt(month) - 1, // JS months are 0-indexed
        users: [
            {
                name: state.currentUser,
                role: 'admin',
                availability: [], // Array of day numbers
                hidden: false
            }
        ]
    };

    state.rooms[roomId] = newRoom;
    state.currentRoomId = roomId;
    // saveToStorage();
    await saveRoomToFirebase(roomId, newRoom);

    enterRoom(roomId);
}

async function joinRoom() {
    const username = document.getElementById('username').value.trim();
    const code = document.getElementById('join-code').value.trim();

    if (!username) return showToast('Ingresa tu nombre');
    if (!code) return showToast('Ingresa el código de la sala');

    // Reload storage just in case
    // loadFromStorage();
    const fetchedRoom = await loadRoomFromFirebase(code);
    if (fetchedRoom) state.rooms[code] = fetchedRoom;

    const room = state.rooms[code];
    if (!room) return showToast('Sala no encontrada');

    // Check if user already exists
    const existingUser = room.users.find(u => u.name === username);
    if (!existingUser) {
        room.users.push({
            name: username,
            role: 'member',
            availability: [],
            hidden: false
        });
        // saveToStorage();
        await saveRoomToFirebase(code, room);
    }

    state.currentUser = username;
    state.currentRoomId = code;
    state.isAdmin = (existingUser && existingUser.role === 'admin') || false;

    enterRoom(code);
}

function enterRoom(roomId) {
    const room = state.rooms[roomId];
    document.getElementById('display-cal-title').textContent = room.title;
    document.getElementById('room-code-display').querySelector('.code').textContent = roomId;
    document.getElementById('current-user-display').textContent = state.currentUser;

    renderCalendar(room, 'input'); // 'input' mode or 'result' mode
    showView('calendar');
}

function renderCalendar(room, mode) {
    const grid = mode === 'input' ? document.getElementById('calendar-grid') : document.getElementById('results-grid');
    grid.innerHTML = ''; // Clear

    const daysInMonth = new Date(room.year, room.month + 1, 0).getDate();
    const firstDayIndex = new Date(room.year, room.month, 1).getDay(); // 0 = Sunday

    // Empty slots for previous month
    for (let i = 0; i < firstDayIndex; i++) {
        const empty = document.createElement('div');
        empty.classList.add('day', 'empty');
        grid.appendChild(empty);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.classList.add('day');
        dayEl.textContent = day;

        if (mode === 'input') {
            // Check my availability
            const me = room.users.find(u => u.name === state.currentUser);
            if (me && me.availability.includes(day)) {
                dayEl.classList.add('selected'); // Green
            } else {
                dayEl.classList.add('busy'); // Red (Default state logic: Red = Busy, Green = Free)
            }

            dayEl.onclick = () => toggleDay(day);
        } else if (mode === 'result') {
            // Calculate group availability
            const activeUsers = room.users.filter(u => !u.hidden);
            const isEveryoneFree = activeUsers.every(u => u.availability.includes(day));

            if (isEveryoneFree && activeUsers.length > 0) {
                dayEl.classList.add('all-free'); // Green
            } else {
                dayEl.classList.add('conflict'); // Red
            }
        }

        grid.appendChild(dayEl);
    }
}

async function toggleDay(day) {
    // loadFromStorage(); // Sync first
    const fetched = await loadRoomFromFirebase(state.currentRoomId);
    if (fetched) state.rooms[state.currentRoomId] = fetched;
    const room = state.rooms[state.currentRoomId];
    const me = room.users.find(u => u.name === state.currentUser);

    if (me.availability.includes(day)) {
        me.availability = me.availability.filter(d => d !== day);
    } else {
        me.availability.push(day);
    }

    // saveToStorage();
    await saveRoomToFirebase(state.currentRoomId, room);

    // Re-render only this day or whole calendar? Whole is easier for now.
    renderCalendar(room, 'input');
}

async function showResults() {
    // loadFromStorage();
    const fetched = await loadRoomFromFirebase(state.currentRoomId);
    if (fetched) state.rooms[state.currentRoomId] = fetched;
    const room = state.rooms[state.currentRoomId];

    // Update Code Display in Results
    const codeDisplay = document.getElementById('room-code-display-results');
    codeDisplay.querySelector('.code').textContent = state.currentRoomId;
    codeDisplay.onclick = copyRoomCode;

    renderCalendar(room, 'result');
    renderUserList(room);
    showView('results');
}

function renderUserList(room) {
    const list = document.getElementById('users-list');
    list.innerHTML = '';

    room.users.forEach(user => {
        const li = document.createElement('li');
        li.classList.add('user-item');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = user.name + (user.role === 'admin' ? ' (Admin)' : '');
        if (user.hidden) nameSpan.style.textDecoration = 'line-through';

        li.appendChild(nameSpan);

        if (state.isAdmin && user.name !== state.currentUser) {
            const actions = document.createElement('div');
            actions.classList.add('user-actions');

            const btnHide = document.createElement('button');
            btnHide.textContent = user.hidden ? 'Mostrar' : 'Ocultar';
            btnHide.classList.add('btn-hide');
            if (user.hidden) btnHide.classList.add('active');
            btnHide.onclick = () => toggleHideUser(user.name);

            const btnKick = document.createElement('button');
            btnKick.textContent = 'Expulsar';
            btnKick.classList.add('btn-kick');
            btnKick.onclick = () => kickUser(user.name);

            actions.appendChild(btnHide);
            actions.appendChild(btnKick);
            li.appendChild(actions);
        }

        list.appendChild(li);
    });
}

async function toggleHideUser(targetName) {
    // loadFromStorage();
    const fetched = await loadRoomFromFirebase(state.currentRoomId);
    if (fetched) state.rooms[state.currentRoomId] = fetched;
    const room = state.rooms[state.currentRoomId];
    const user = room.users.find(u => u.name === targetName);
    if (user) {
        user.hidden = !user.hidden;
        // saveToStorage();
        await saveRoomToFirebase(state.currentRoomId, room);
        showResults(); // Refresh
    }
}

async function kickUser(targetName) {
    if (!confirm(`¿Seguro que quieres expulsar a ${targetName}?`)) return;

    // loadFromStorage();
    const fetched = await loadRoomFromFirebase(state.currentRoomId);
    if (fetched) state.rooms[state.currentRoomId] = fetched;
    const room = state.rooms[state.currentRoomId];
    room.users = room.users.filter(u => u.name !== targetName);
    // saveToStorage();
    await saveRoomToFirebase(state.currentRoomId, room);
    showResults();
}

// --- UTILS ---
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function copyRoomCode() {
    const code = state.currentRoomId;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Código copiado al portapapeles');
    });
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Buttons
    document.getElementById('btn-go-create').onclick = createRoom;
    document.getElementById('btn-join').onclick = joinRoom;
    document.getElementById('btn-create-confirm').onclick = confirmCreateRoom;
    document.getElementById('btn-view-results').onclick = showResults;
    document.getElementById('room-code-display').onclick = copyRoomCode;

    // Back Buttons
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.onclick = (e) => showView(e.target.dataset.target);
    });

    // Storage Sync (Magic for multi-tab)
    // window.addEventListener('storage', (e) => {
    //     if (e.key === 'horario_rooms') {
    //         loadFromStorage();
    //         // Refresh current view if we are in a room
    //         if (state.currentRoomId && state.rooms[state.currentRoomId]) {
    //             const room = state.rooms[state.currentRoomId];
    //             // Check if I was kicked
    //             if (!room.users.find(u => u.name === state.currentUser)) {
    //                 alert('Has sido expulsado de la sala.');
    //                 location.reload();
    //                 return;
    //             }

    //             // Refresh Calendar if visible
    //             if (!document.getElementById('view-calendar').classList.contains('hidden')) {
    //                 renderCalendar(room, 'input');
    //             }
    //             // Refresh Results if visible
    //             if (!document.getElementById('view-results').classList.contains('hidden')) {
    //                 renderCalendar(room, 'result');
    //                 renderUserList(room);
    //             }
    //         }
    //     }
    // });
}

// Run
init();
