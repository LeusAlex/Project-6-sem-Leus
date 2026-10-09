/* draw.js — визуализация траектории инструмента на canvas */

const DrawPath = (function () {
  'use strict';

  function parseGCode(gcode) {
    const lines = gcode.split('\n');
    const moves = [];
    let x = 0, y = 0, z = 0;

    for (let line of lines) {
      line = line.trim().toUpperCase();
      if (!line || line.startsWith('(') || line.startsWith(';')) continue;

      const rapid = line.startsWith('G0') || line.startsWith('G00');
      const linear = line.startsWith('G1') || line.startsWith('G01');
      const cw = line.startsWith('G2') || line.startsWith('G02');
      const ccw = line.startsWith('G3') || line.startsWith('G03');

      if (!rapid && !linear && !cw && !ccw) continue;

      const tokens = line.match(/[A-Z]-?[\d.]+/g) || [];
      let nx = x, ny = y, nz = z;
      let i = null, j = null;

      for (let t of tokens) {
        const code = t[0];
        const val = parseFloat(t.slice(1));
        if (code === 'X') nx = val;
        if (code === 'Y') ny = val;
        if (code === 'Z') nz = val;
        if (code === 'I') i = val;
        if (code === 'J') j = val;
      }

      if (cw || ccw) {
        if (i !== null && j !== null) {
          const arcCx = x + i;
          const arcCy = y + j;
          const r = Math.sqrt(i * i + j * j);
          const a1 = Math.atan2(y - arcCy, x - arcCx);
          const a2 = Math.atan2(ny - arcCy, nx - arcCx);

          let delta = a2 - a1;
          if (cw && delta > 0) delta -= 2 * Math.PI;
          if (ccw && delta < 0) delta += 2 * Math.PI;

          if (Math.abs(delta) < 1e-9 && r > 1e-9) {
            delta = cw ? -2 * Math.PI : 2 * Math.PI;
          }

          const segments = Math.max(32, Math.ceil(Math.abs(delta) * r / 2));
          const step = delta / segments;

          for (let s = 1; s <= segments; s++) {
            const angle = a1 + step * s;
            const px = arcCx + r * Math.cos(angle);
            const py = arcCy + r * Math.sin(angle);
            const pz = z + (nz - z) * (s / segments);
            moves.push({ x: px, y: py, z: pz, rapid: false });
          }

          x = nx; y = ny; z = nz;
        }
      } else {
        moves.push({ x: nx, y: ny, z: nz, rapid: rapid });
        x = nx; y = ny; z = nz;
      }
    }

    return moves;
  }

  function draw(canvasId, legendId, gcode) {
    const canvas = document.getElementById(canvasId);
    const legend = document.getElementById(legendId);

    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#11162a';
    ctx.fillRect(0, 0, w, h);

    const moves = parseGCode(gcode);
    if (moves.length === 0) {
      ctx.fillStyle = '#7a8aa5';
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Нет команд перемещения', w / 2, h / 2);
      if (legend) legend.innerHTML = '';
      return;
    }

    const xs = moves.map(m => m.x);
    const ys = moves.map(m => m.y);
    const zs = moves.map(m => m.z);

    const x_min = Math.min(...xs);
    const x_max = Math.max(...xs);
    const y_min = Math.min(...ys);
    const y_max = Math.max(...ys);
    const z_min = Math.min(...zs);
    const z_max = Math.max(...zs);

    const x_range = x_max - x_min || 1;
    const y_range = y_max - y_min || 1;

    const pad = 40;
    const scale_x = (w - pad * 2) / x_range;
    const scale_y = (h - pad * 2) / y_range;
    const scale = Math.min(scale_x, scale_y);

    const cx = w / 2;
    const cy = h / 2;

    function toScreen(x, y) {
      const sx = cx + (x - (x_min + x_max) / 2) * scale;
      const sy = cy - (y - (y_min + y_max) / 2) * scale;
      return { x: sx, y: sy };
    }

    function colorZ(z) {
      if (z_min === z_max) return '#4fb3ff';
      const t = (z - z_min) / (z_max - z_min);
      if (t < 0.5) {
        const r = Math.floor(63 + (79 - 63) * (t / 0.5));
        const g = Math.floor(136 + (179 - 136) * (t / 0.5));
        const b = Math.floor(255);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
      } else {
        const r = Math.floor(79 + (102 - 79) * ((t - 0.5) / 0.5));
        const g = Math.floor(179 + (204 - 179) * ((t - 0.5) / 0.5));
        const b = Math.floor(255 + (102 - 255) * ((t - 0.5) / 0.5));
        return 'rgb(' + r + ',' + g + ',' + b + ')';
      }
    }

    const origin = toScreen(0, 0);
    ctx.strokeStyle = '#4a5a7a';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(origin.x - 12, origin.y);
    ctx.lineTo(origin.x + 12, origin.y);
    ctx.moveTo(origin.x, origin.y - 12);
    ctx.lineTo(origin.x, origin.y + 12);
    ctx.stroke();

    ctx.fillStyle = '#7a8aa5';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('X0 Y0', origin.x + 5, origin.y - 5);

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let prev = toScreen(0, 0);

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const curr = toScreen(m.x, m.y);

      if (m.rapid) {
        ctx.strokeStyle = '#4a5a7a';
        ctx.setLineDash([4, 3]);
      } else {
        ctx.strokeStyle = colorZ(m.z);
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();

      prev = curr;
    }

    if (legend) {
      const depth_range = z_max - z_min;
      let html = '';

      if (depth_range === 0) {
        html = '<span><i style="background:' + colorZ(z_min) + '"></i>Z = ' + z_min.toFixed(2) + ' мм</span>';
      } else {
        const steps = 4;
        for (let s = 0; s <= steps; s++) {
          const z = z_min + (depth_range * s / steps);
          const color = colorZ(z);
          html += '<span><i style="background:' + color + '"></i>Z = ' + z.toFixed(2) + ' мм</span>';
        }
      }

      html += '<span><i style="background:#4a5a7a; height:1px; margin-top:1px;"></i>ускоренное (G0)</span>';
      legend.innerHTML = html;
    }
  }

  return { draw: draw };
})();
