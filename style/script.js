import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, get, child, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    databaseURL: "https://antonkuran-efcb8-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const messagesRef = ref(db, 'messages');
const usersRef = ref(db, 'users');

let currentUser = localStorage.getItem('chat_user');
let userScore = 0;
let userLevel = 1;
let clickPower = 0.1;

// Витрати балів для кожного з 10 рівнів прокачки
const upgradeCosts = [0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800];

// Перевірка сесії
if (currentUser) {
    showApp();
}

// Реєстрація нового користувача
window.handleRegister = async function() {
    const login = document.getElementById('loginInput').value.trim();
    const pass = document.getElementById('passInput').value.trim();
    const errorDiv = document.getElementById('authError');

    if (!login || !pass) {
        errorDiv.textContent = "Введіть логін і пароль!";
        return;
    }

    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `users/${login}`));

    if (snapshot.exists()) {
        errorDiv.textContent = "Цей логін вже зайнятий!";
        return;
    }

    // Зберігаємо нового користувача
    await set(ref(db, `users/${login}`), {
        password: pass,
        score: 0,
        level: 1,
        power: 0.1
    });

    localStorage.setItem('chat_user', login);
    currentUser = login;
    showApp();
}

// Логін існуючого користувача
window.handleLogin = async function() {
    const login = document.getElementById('loginInput').value.trim();
    const pass = document.getElementById('passInput').value.trim();
    const errorDiv = document.getElementById('authError');

    if (!login || !pass) {
        errorDiv.textContent = "Введіть логін і пароль!";
        return;
    }

    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, `users/${login}`));

    if (!snapshot.exists()) {
        errorDiv.textContent = "Користувача не знайдено!";
        return;
    }

    const userData = snapshot.val();
    if (userData.password !== pass) {
        errorDiv.textContent = "Невірний пароль!";
        return;
    }

    localStorage.setItem('chat_user', login);
    currentUser = login;
    showApp();
}

window.logout = function() {
    localStorage.removeItem('chat_user');
    location.reload();
}

function showApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    document.getElementById('currentUserDisplay').textContent = `Гравець: ${currentUser}`;
    initGameAndChat();
}

function initGameAndChat() {
    // Завантажуємо персональні дані гравця з бази
    const userRef = ref(db, `users/${currentUser}`);
    onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            userScore = data.score || 0;
            userLevel = data.level || 1;
            clickPower = data.power || 0.1;
            updateUI();
        }
    });

    // Слухаємо чат
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    onChildAdded(messagesRef, (snapshot) => {
        const data = snapshot.val();
        const msgDiv = document.createElement('div');
        const isMe = data.author === currentUser;
        msgDiv.className = isMe ? 'message user' : 'message remote';
        msgDiv.innerHTML = `<div class="msg-author">${data.author}</div><div>${data.text}</div>`;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Слухаємо лідерборд усіх гравців
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val() || {};
        const list = document.getElementById('leaderboardList');
        list.innerHTML = '';

        const sorted = Object.entries(data)
            .map(([name, info]) => ({ name, score: info.score || 0 }))
            .sort((a, b) => b.score - a.score);

        sorted.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'leaderboard-item';
            li.innerHTML = `<span>${index + 1}. ${item.name}</span> <b>${item.score.toFixed(1)}</b>`;
            list.appendChild(li);
        });
    });
}

function updateUI() {
    document.getElementById('scoreVal').textContent = userScore.toFixed(1);
    document.getElementById('powerVal').textContent = clickPower.toFixed(1);
    document.getElementById('currentLevel').textContent = userLevel;

    const upgradeBtn = document.getElementById('upgradeBtn');
    const upgradeDesc = document.getElementById('upgradeDesc');

    if (userLevel >= 10) {
        upgradeDesc.textContent = "Максимальний рівень прокачки досягнуто!";
        upgradeBtn.textContent = "Максимум";
        upgradeBtn.disabled = true;
    } else {
        const nextCost = upgradeCosts[userLevel];
        upgradeDesc.textContent = `Ціна наступного рівня (+0.1 до кліка): ${nextCost} балів`;
        upgradeBtn.textContent = `Купити за ${nextCost} балів`;
        upgradeBtn.disabled = userScore < nextCost;
    }
}

// Клік по кнопці
window.incrementScore = function() {
    userScore += clickPower;
    saveUserData();
}

// Покупка прокачки рівня
window.buyUpgrade = function() {
    if (userLevel >= 10) return;
    const nextCost = upgradeCosts[userLevel];

    if (userScore >= nextCost) {
        userScore -= nextCost;
        userLevel++;
        clickPower = parseFloat((clickPower + 0.1).toFixed(1)); // збільшуємо на 0.1
        saveUserData();
    }
}

function saveUserData() {
    set(ref(db, `users/${currentUser}`), {
        password: promptPasswordPlaceholder(), // Зберігаємо пароль незмінним
        score: parseFloat(userScore.toFixed(1)),
        level: userLevel,
        power: clickPower
    });
}

// Зберігаємо поточний пароль під час оновлення балів
async function promptPasswordPlaceholder() {
    const snap = await get(child(ref(db), `users/${currentUser}/password`));
    return snap.val() || "";
}

window.sendMessage = function() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;

    push(messagesRef, {
        author: currentUser,
        text: text,
        timestamp: Date.now()
    });

    input.value = '';
}

window.handleKeyPress = function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
}
