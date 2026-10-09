/* login.js — вход и регистрация */

(function () {
  'use strict';

  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('regForm');
  const msg = document.getElementById('msg');

  // переключение вкладок
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      const target = this.dataset.tab;

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');

      if (target === 'login') {
        loginForm.classList.remove('hidden');
        regForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        regForm.classList.remove('hidden');
      }

      msg.textContent = '';
    });
  });

  // вход
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    msg.textContent = '';

    const login = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;

    try {
      const data = await API.login(login, password);
      API.setSession(data);
      location.href = 'cabinet.html';
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'msg err';
    }
  });

  // регистрация
  regForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    msg.textContent = '';

    const login = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPass').value;
    const password2 = document.getElementById('regPass2').value;

    if (password !== password2) {
      msg.textContent = 'Пароли не совпадают';
      msg.className = 'msg err';
      return;
    }

    try {
      const data = await API.register(login, password);
      API.setSession(data);
      location.href = 'cabinet.html';
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'msg err';
    }
  });

})();
