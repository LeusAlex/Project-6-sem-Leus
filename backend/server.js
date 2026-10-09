// server.js — заглушка бэкенда для генератора управляющих программ
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS = path.join(DATA_DIR, 'users.json');
const PROGRAMS = path.join(DATA_DIR, 'programs.json');

// готовим папку с "базой данных"
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS)) fs.writeFileSync(USERS, '[]');
if (!fs.existsSync(PROGRAMS)) fs.writeFileSync(PROGRAMS, '[]');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8') || '[]');
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');

// ---------- авторизация (учебная заглушка) ----------
const hash = (pwd) => crypto.createHash('md5').update(String(pwd)).digest('hex');

function newToken(user) {
  return Buffer.from(user.id + ':' + Date.now()).toString('base64');
}

function auth(req, res, next) {
  const raw = req.headers.authorization || '';
  const token = raw.replace('Bearer ', '').trim();

  let id = null;
  try {
    id = Buffer.from(token, 'base64').toString('utf8').split(':')[0];
  } catch (e) {
    id = null;
  }

  const user = read(USERS).find((u) => u.id === id);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });

  req.user = user;
  next();
}

// регистрация
app.post('/api/register', (req, res) => {
  const { login, password } = req.body || {};

  if (!login || !password) {
    return res.status(400).json({ error: 'Заполните логин и пароль' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });
  }

  const users = read(USERS);
  if (users.some((u) => u.login.toLowerCase() === String(login).toLowerCase())) {
    return res.status(409).json({ error: 'Такой логин уже занят' });
  }

  const user = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    login: String(login),
    passwordHash: hash(password),
    created: new Date().toISOString()
  };

  users.push(user);
  write(USERS, users);

  res.json({ token: newToken(user), user: { id: user.id, login: user.login } });
});

// вход
app.post('/api/login', (req, res) => {
  const { login, password } = req.body || {};

  const user = read(USERS).find(
    (u) =>
      u.login.toLowerCase() === String(login || '').toLowerCase() &&
      u.passwordHash === hash(password)
  );

  if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });

  res.json({ token: newToken(user), user: { id: user.id, login: user.login } });
});

// текущий пользователь
app.get('/api/me', auth, (req, res) => {
  res.json({ id: req.user.id, login: req.user.login });
});

// ---------- сохранённые программы ----------

// список (без gcode, чтобы не гонять лишнее)
app.get('/api/programs', auth, (req, res) => {
  const list = read(PROGRAMS)
    .filter((p) => p.userId === req.user.id)
    .map((p) => ({ id: p.id, name: p.name, type: p.type, created: p.created }));

  res.json(list);
});

// одна программа целиком
app.get('/api/programs/:id', auth, (req, res) => {
  const p = read(PROGRAMS).find(
    (p) => p.id === req.params.id && p.userId === req.user.id
  );

  if (!p) return res.status(404).json({ error: 'Программа не найдена' });
  res.json(p);
});

// сохранить
app.post('/api/programs', auth, (req, res) => {
  const { name, type, params, gcode } = req.body || {};

  if (!type || !gcode) {
    return res.status(400).json({ error: 'Не хватает данных программы' });
  }

  const programs = read(PROGRAMS);
  const p = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    userId: req.user.id,
    name: name || 'Программа от ' + new Date().toLocaleString('ru-RU'),
    type: type,
    params: params || {},
    gcode: gcode,
    created: new Date().toISOString()
  };

  programs.push(p);
  write(PROGRAMS, programs);

  res.json({ id: p.id, name: p.name, type: p.type, created: p.created });
});

// удалить
app.delete('/api/programs/:id', auth, (req, res) => {
  const programs = read(PROGRAMS);
  const i = programs.findIndex(
    (p) => p.id === req.params.id && p.userId === req.user.id
  );

  if (i === -1) return res.status(404).json({ error: 'Программа не найдена' });

  programs.splice(i, 1);
  write(PROGRAMS, programs);

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log('Сервер запущен: http://localhost:' + PORT);
});