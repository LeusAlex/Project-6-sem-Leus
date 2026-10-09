/* api.js — обёртка над fetch для работы с заглушкой бэкенда */

const API = (function () {
  'use strict';

  // бэкенд сам раздаёт фронтенд, поэтому путь относительный
  const BASE = '';
  const TOKEN_KEY = 'cncgen_token';
  const USER_KEY = 'cncgen_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function setSession(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  // общий запрос: сам подставляет токен и разбирает ошибки сервера
  async function request(url, options) {
    const opts = options || {};
    const headers = { 'Content-Type': 'application/json' };

    if (getToken()) {
      headers['Authorization'] = 'Bearer ' + getToken();
    }

    const res = await fetch(BASE + url, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      // 401 — токен устарел, чистим сессию
      if (res.status === 401) clearSession();
      const err = new Error((data && data.error) || 'Ошибка сервера (' + res.status + ')');
      err.status = res.status;
      throw err;
    }

    return data;
  }

  return {
    getToken: getToken,
    getUser: getUser,
    setSession: setSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn,

    register: function (login, password) {
      return request('/api/register', { method: 'POST', body: { login: login, password: password } });
    },

    login: function (login, password) {
      return request('/api/login', { method: 'POST', body: { login: login, password: password } });
    },

    me: function () {
      return request('/api/me');
    },

    listPrograms: function () {
      return request('/api/programs');
    },

    getProgram: function (id) {
      return request('/api/programs/' + id);
    },

    saveProgram: function (payload) {
      return request('/api/programs', { method: 'POST', body: payload });
    },

    deleteProgram: function (id) {
      return request('/api/programs/' + id, { method: 'DELETE' });
    },

    logout: function () {
      clearSession();
      location.href = 'index.html';
    },

    // общий для всех страниц блок: кто вошёл
    renderAuthBox: function () {
      const box = document.getElementById('authBox');
      if (!box) return;

      if (!isLoggedIn()) {
        box.innerHTML = '<a href="login.html">Войти</a>';
        return;
      }

      const u = getUser();
      const name = (u && u.login) || 'пользователь';
      box.innerHTML = name + ' · <a href="#" id="logoutLink">выйти</a>';

      const link = document.getElementById('logoutLink');
      if (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          API.logout();
        });
      }
    }
  };
})();

// сразу на любой странице показываем состояние авторизации
document.addEventListener('DOMContentLoaded', function () {
  API.renderAuthBox();
});