import { useRef, useCallback, useEffect } from 'react';

export default function TechUI({ progress = 0, message = '' }) {
  const canvasRef = useRef(null);
  const progressRef = useRef(progress);
  const messageRef = useRef(message);

  progressRef.current = progress;
  messageRef.current = message;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);
    const cx = W / 2, cy = H / 2;
    const t = { val: 0 };

    // ── Particle sphere ──
    const sphereR = Math.min(W, H) * 0.18;
    const sphereDots = [];
    for (let i = 0; i < 220; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      sphereDots.push({ theta, phi, r: 0.95 + Math.random() * 0.05 });
    }

    // ── Fine particle grid ──
    const gridSpacing = 28;
    const gridDots = [];
    for (let gx = 0; gx < W; gx += gridSpacing) {
      for (let gy = 0; gy < H; gy += gridSpacing) {
        const dx = gx - cx, dy = gy - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < sphereR * 2.2) continue;
        gridDots.push({ x: gx, y: gy, dist, baseAlpha: Math.max(0.01, 0.04 - dist / (W * 2)) });
      }
    }

    function render() {
      t.val += 0.016;
      ctx.clearRect(0, 0, W, H);

      // ── Background ──
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // ── Particle dot grid ──
      for (const d of gridDots) {
        const pulse = Math.sin(t.val * 1.5 + d.dist * 0.005) * 0.5 + 0.5;
        const alpha = d.baseAlpha * (0.5 + pulse * 0.5);
        ctx.fillStyle = `rgba(0, 180, 255, ${alpha})`;
        ctx.fillRect(d.x, d.y, 1.2, 1.2);
      }

      // ── 3D Particle Sphere ──
      const rotY = t.val * 0.3;
      const rotX = t.val * 0.15;

      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      const projected = [];
      for (const dot of sphereDots) {
        const r = sphereR * dot.r;
        let x = r * Math.sin(dot.phi) * Math.cos(dot.theta);
        let y = r * Math.sin(dot.phi) * Math.sin(dot.theta);
        let z = r * Math.cos(dot.phi);

        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const scale = 300 / (300 + z2);
        projected.push({ sx: cx + x1 * scale, sy: cy + y1 * scale, z: z2, scale });
      }

      projected.sort((a, b) => a.z - b.z);

      for (const p of projected) {
        const depth = (p.z + sphereR) / (2 * sphereR);
        const alpha = 0.08 + depth * 0.55;
        const size = (1 + depth * 2) * p.scale;
        const glow = 4 + depth * 10;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 200, 255, 0.7)';
        ctx.shadowBlur = glow;
        ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Sphere glow halo
      ctx.save();
      const haloGrad = ctx.createRadialGradient(cx, cy, sphereR * 0.5, cx, cy, sphereR * 1.6);
      haloGrad.addColorStop(0, 'rgba(0, 150, 255, 0.04)');
      haloGrad.addColorStop(0.5, 'rgba(0, 100, 200, 0.02)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      const pad = 24;

      // ── Timestamp ──
      const now = new Date();
      const ts = [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0'), String(now.getSeconds()).padStart(2, '0')].join(':');
      ctx.font = "11px 'IBM Plex Mono', monospace";
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'center';
      ctx.fillText(ts, cx, pad + 14);
      ctx.textAlign = 'left';

      // ── Progress bar ──
      if (progressRef.current > 0 || messageRef.current) {
        const barW = Math.min(420, W * 0.5);
        const barH = 6;
        const barX = cx - barW / 2;
        const barY = H - pad - 40;

        ctx.font = "13px 'IBM Plex Mono', monospace";
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(messageRef.current || 'Submitting…', cx, barY - 14);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 3);
        ctx.fill();

        if (progressRef.current > 0) {
          const fillW = (barW * Math.min(progressRef.current, 100)) / 100;
          ctx.save();
          ctx.shadowColor = 'rgba(0, 200, 255, 0.6)';
          ctx.shadowBlur = 8;
          ctx.fillStyle = 'rgba(0, 200, 255, 0.8)';
          ctx.beginPath();
          ctx.roundRect(barX, barY, fillW, barH, 3);
          ctx.fill();
          ctx.restore();
        }

        ctx.font = "11px 'IBM Plex Mono', monospace";
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillText(`${Math.round(progressRef.current)}%`, cx, barY + barH + 16);
        ctx.textAlign = 'left';
      }

      canvas._raf = requestAnimationFrame(render);
    }
    render();
  }, []);

  useEffect(() => {
    draw();
    return () => { if (canvasRef.current && canvasRef.current._raf) cancelAnimationFrame(canvasRef.current._raf); };
  }, [draw]);

  return <canvas ref={canvasRef} className="stl__techui" />;
}
