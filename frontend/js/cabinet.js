/* cabinet.js — личный кабинет */

(function () {
  'use strict';

  const userLogin = document.getElementById('userLogin');
  const userCount = document.getElementById('userCount');
  const progList = document.getElementById('progList');
  const viewer = document.getElementById('viewer');
  const viewTitle = document.getElementById('viewTitle');
  const viewMeta = document.getElementById('viewMeta');
  const viewStats = document.getElementById('viewStats');
  const viewCode = document.getElementById('viewCode');
  const btnDownloadSaved = document.getElementById('btnDownloadSaved');
  const btnDelete = document.getElementById('btnDelete');
  const btnLogout = document.getElementById('btnLogout');

  let currentProgram = null;

  // проверка авторизации
  if (!API.isLoggedIn()) {
    location.href = 'login.html';
    return;
  }

  // загрузка данных пользователя
  async function loadUser() {
    try {
      const user = await API.me();
      userLogin.textContent = user.login;
    } catch (e) {
      location.href = 'login.html';
    }
  }

  // загрузка списка программ
  async function loadPrograms() {
    try {
      const list = await API.listPrograms();
      userCount.textContent = list.length;

      if (list.length === 0) {
        progList.innerHTML = '<p class="muted">Нет сохранённых программ</p>';
        return;
      }

      const typeNames = {
        plane: 'Плоскость',
        hole: 'Отверстие',
        thread: 'Резьба'
      };

      let html = '';
      for (let p of list) {
        const date = new Date(p.created).toLocaleString('ru-RU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        html += '<div class="prog" data-id="' + p.id + '">';
        html += '<div class="prog-info">';
        html += '<div class="prog-name">' + escapeHtml(p.name) + '</div>';
        html += '<div class="prog-sub">' + date + '</div>';
        html += '</div>';
        html += '<span class="badge">' + typeNames[p.type] + '</span>';
        html += '</div>';
      }

      progList.innerHTML = html;

      // клик на программу
      document.querySelectorAll('.prog').forEach(function (el) {
        el.addEventListener('click', function () {
          const id = this.dataset.id;
          loadProgram(id);
        });
      });

    } catch (e) {
      progList.innerHTML = '<p class="muted">Ошибка загрузки: ' + e.message + '</p>';
    }
  }

  // загрузка одной программы
  async function loadProgram(id) {
    try {
      const p = await API.getProgram(id);
      currentProgram = p;

      viewTitle.textContent = p.name;

      const date = new Date(p.created).toLocaleString('ru-RU');
      const typeNames = { plane: 'Плоскость', hole: 'Отверстие', thread: 'Резьба' };
      viewMeta.innerHTML = '<b>Тип:</b> ' + typeNames[p.type] + ' &nbsp; <b>Создана:</b> ' + date;

      viewCode.textContent = p.gcode;

      const lines = p.gcode.split('\n').length;
      viewStats.textContent = 'строк: ' + lines + ', символов: ' + p.gcode.length;

      // визуализация
      DrawPath.draw('viewCanvas', 'viewLegend', p.gcode);

      viewer.classList.remove('hidden');
      viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (e) {
      alert('Ошибка загрузки программы: ' + e.message);
    }
  }

  // скачать программу
  btnDownloadSaved.addEventListener('click', function () {
    if (!currentProgram) return;

    const blob = new Blob([currentProgram.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(currentProgram.name) + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  // удалить программу
  btnDelete.addEventListener('click', async function () {
    if (!currentProgram) return;
    if (!confirm('Удалить программу «' + currentProgram.name + '»?')) return;

    try {
      await API.deleteProgram(currentProgram.id);
      viewer.classList.add('hidden');
      currentProgram = null;
      loadPrograms();
    } catch (e) {
      alert('Ошибка удаления: ' + e.message);
    }
  });

  // выход
  btnLogout.addEventListener('click', function () {
    API.logout();
  });

  // утилиты
  function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  }

  function sanitizeFilename(name) {
    return name.replace(/[^a-zа-яё0-9_\- ]/gi, '_').slice(0, 100);
  }

  // инициализация
  loadUser();
  loadPrograms();

})();
