/* main.js — логика главной страницы генератора */

(function () {
  'use strict';

  const geoPicker = document.getElementById('geoPicker');
  const btnGenerate = document.getElementById('btnGenerate');
  const btnReset = document.getElementById('btnReset');
  const btnCopy = document.getElementById('btnCopy');
  const btnDownload = document.getElementById('btnDownload');
  const btnSave = document.getElementById('btnSave');

  const gcodeOut = document.getElementById('gcodeOut');
  const codeStats = document.getElementById('codeStats');
  const msg = document.getElementById('msg');
  const saveRow = document.getElementById('saveRow');
  const progName = document.getElementById('progName');

  let currentGCode = '';
  let currentType = '';
  let currentParams = {};

  // переключение полей под тип геометрии
  geoPicker.addEventListener('change', function (e) {
    if (e.target.name !== 'geometry') return;

    const selected = e.target.value;
    document.querySelectorAll('.fields').forEach(function (f) {
      if (f.dataset.geom === selected) {
        f.classList.remove('hidden');
      } else {
        f.classList.add('hidden');
      }
    });

    // для резьбы stepdown не актуален
    const rowStepdown = document.getElementById('rowStepdown');
    if (selected === 'thread') {
      rowStepdown.style.display = 'none';
    } else {
      rowStepdown.style.display = '';
    }
  });

  // сбор параметров
  function readParams() {
    const type = document.querySelector('input[name="geometry"]:checked').value;

    const common = {
      toolDiameter: parseFloat(document.getElementById('toolDiameter').value),
      spindle: parseInt(document.getElementById('spindle').value),
      feed: parseInt(document.getElementById('feed').value),
      plungeFeed: parseInt(document.getElementById('plungeFeed').value),
      stepdown: parseFloat(document.getElementById('stepdown').value),
      safeZ: parseFloat(document.getElementById('safeZ').value)
    };

    let specific = {};

    if (type === 'plane') {
      specific = {
        length: parseFloat(document.getElementById('pLength').value),
        width: parseFloat(document.getElementById('pWidth').value),
        depth: parseFloat(document.getElementById('pDepth').value),
        stepover: parseFloat(document.getElementById('pStepover').value),
        origin: document.getElementById('pOrigin').value,
        zigzag: document.getElementById('pZigzag').checked
      };
    } else if (type === 'hole') {
      specific = {
        diameter: parseFloat(document.getElementById('hDiameter').value),
        depth: parseFloat(document.getElementById('hDepth').value)
      };
    } else if (type === 'thread') {
      specific = {
        diameter: parseFloat(document.getElementById('tDiameter').value),
        pitch: parseFloat(document.getElementById('tPitch').value),
        depth: parseFloat(document.getElementById('tDepth').value),
        kind: document.getElementById('tKind').value,
        hand: document.getElementById('tHand').value
      };
    }

    return { type: type, params: Object.assign(common, specific) };
  }

  // валидация
  function validate(type, params) {
    if (params.toolDiameter <= 0) return 'Диаметр фрезы должен быть больше 0';
    if (params.spindle < 0) return 'Обороты шпинделя не могут быть отрицательными';
    if (params.feed <= 0) return 'Рабочая подача должна быть больше 0';
    if (params.plungeFeed <= 0) return 'Подача врезания должна быть больше 0';
    if (params.safeZ <= 0) return 'Безопасная высота должна быть больше 0';

    if (type === 'plane') {
      if (params.length <= 0 || params.width <= 0) return 'Длина и ширина должны быть больше 0';
      if (params.depth <= 0) return 'Глубина снятия должна быть больше 0';
      if (params.stepdown <= 0) return 'Заглубление за проход должно быть больше 0';
      if (params.stepover < 10 || params.stepover > 100) return 'Перекрытие строчек: 10–100%';
    }

    if (type === 'hole') {
      if (params.diameter <= 0) return 'Диаметр отверстия должен быть больше 0';
      if (params.depth <= 0) return 'Глубина отверстия должна быть больше 0';
      if (params.toolDiameter >= params.diameter) return 'Диаметр фрезы должен быть меньше диаметра отверстия';
      if (params.stepdown <= 0) return 'Заглубление за проход должно быть больше 0';
    }

    if (type === 'thread') {
      if (params.diameter <= 0) return 'Диаметр резьбы должен быть больше 0';
      if (params.pitch <= 0) return 'Шаг резьбы должен быть больше 0';
      if (params.depth <= 0) return 'Высота резьбы должна быть больше 0';
    }

    return null;
  }

  // генерация
  btnGenerate.addEventListener('click', function () {
    msg.textContent = '';
    msg.className = 'msg';

    const data = readParams();
    const err = validate(data.type, data.params);

    if (err) {
      msg.textContent = 'Ошибка: ' + err;
      msg.classList.add('err');
      return;
    }

    try {
      const gcode = GCodeGen(data.type, data.params);
      currentGCode = gcode;
      currentType = data.type;
      currentParams = data.params;

      gcodeOut.textContent = gcode;

      const lines = gcode.split('\n').length;
      codeStats.textContent = 'строк: ' + lines + ', символов: ' + gcode.length;

      btnCopy.disabled = false;
      btnDownload.disabled = false;

      // визуализация
      DrawPath.draw('toolpath', 'legend', gcode);

      // показать кнопку сохранения только если залогинен
      if (API.isLoggedIn()) {
        saveRow.classList.remove('hidden');
        progName.value = '';
      } else {
        saveRow.classList.add('hidden');
      }

      msg.textContent = 'G-код сформирован';
      msg.classList.add('ok');

    } catch (e) {
      msg.textContent = 'Ошибка генерации: ' + e.message;
      msg.classList.add('err');
    }
  });

  // сброс
  btnReset.addEventListener('click', function () {
    document.querySelectorAll('input[type="number"]').forEach(function (inp) {
      inp.value = inp.defaultValue || '';
    });
    document.querySelectorAll('input[type="checkbox"]').forEach(function (inp) {
      inp.checked = inp.defaultChecked;
    });
    document.querySelectorAll('select').forEach(function (sel) {
      sel.selectedIndex = 0;
    });

    gcodeOut.textContent = '— здесь появится G-код —';
    codeStats.textContent = 'код не сформирован';
    btnCopy.disabled = true;
    btnDownload.disabled = true;
    saveRow.classList.add('hidden');
    msg.textContent = '';

    const canvas = document.getElementById('toolpath');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#11162a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    document.getElementById('legend').innerHTML = '';
  });

  // копировать
  btnCopy.addEventListener('click', function () {
    navigator.clipboard.writeText(currentGCode).then(function () {
      msg.textContent = 'Код скопирован в буфер обмена';
      msg.className = 'msg ok';
    }).catch(function () {
      msg.textContent = 'Не удалось скопировать';
      msg.className = 'msg err';
    });
  });

  // скачать
  btnDownload.addEventListener('click', function () {
    const blob = new Blob([currentGCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    let filename = 'program.txt';
    if (currentType === 'plane') filename = 'plane.txt';
    if (currentType === 'hole') filename = 'hole.txt';
    if (currentType === 'thread') filename = 'thread.txt';

    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    msg.textContent = 'Файл скачан';
    msg.className = 'msg ok';
  });

  // сохранить в кабинет
  btnSave.addEventListener('click', async function () {
    if (!API.isLoggedIn()) {
      msg.textContent = 'Войдите в аккаунт, чтобы сохранять программы';
      msg.className = 'msg err';
      return;
    }

    const name = progName.value.trim() || ('Программа от ' + new Date().toLocaleString('ru-RU'));

    const payload = {
      name: name,
      type: currentType,
      params: currentParams,
      gcode: currentGCode
    };

    try {
      await API.saveProgram(payload);
      msg.textContent = 'Программа сохранена в личный кабинет';
      msg.className = 'msg ok';
      progName.value = '';
    } catch (e) {
      msg.textContent = 'Ошибка сохранения: ' + e.message;
      msg.className = 'msg err';
    }
  });

})();