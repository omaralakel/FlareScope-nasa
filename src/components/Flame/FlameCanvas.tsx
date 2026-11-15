import { useEffect, useRef, useState } from 'react';
import fragSource from './flame.frag.glsl?raw';
import { ease, flameRegime, phaseSpeed, REGIME_LABEL, type FlameInputs } from './flameModel';
import './flame.css';

const VERT_SOURCE = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const UNIFORMS = ['u_resolution', 'u_dpr', 'u_time', 'u_phase', 'u_o2', 'u_pressure', 'u_flow', 'u_gravity'] as const;
type UniformName = (typeof UNIFORMS)[number];

type GlResources = {
  program: WebGLProgram;
  buffer: WebGLBuffer;
  loc: Record<UniformName, WebGLUniformLocation | null>;
};

const MAX_DPR = 2;
const REDUCED_MOTION_SPEED = 0.25;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

function initGl(gl: WebGLRenderingContext): GlResources {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SOURCE);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  if (!program) throw new Error('createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  // shaders can be flagged for deletion once linked
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('createBuffer failed');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // one oversized triangle covers the viewport
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const loc = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)])) as GlResources['loc'];
  return { program, buffer, loc };
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export type FlameCanvasProps = FlameInputs & { className?: string };

export function FlameCanvas({ o2, pressure, flow, gravity, className }: FlameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = useRef<FlameInputs>({ o2, pressure, flow, gravity });
  const [failed, setFailed] = useState(false);

  // the render loop reads the latest targets; easing happens there
  useEffect(() => {
    target.current = { o2, pressure, flow, gravity };
  }, [o2, pressure, flow, gravity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) {
      setFailed(true);
      return;
    }

    let res: GlResources | null = null;
    let raf = 0;
    let disposed = false;
    let last = performance.now();
    let time = 0;
    let phase = 0;
    let dpr = 1;
    const eased: FlameInputs = { ...target.current };

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced = prefersReducedMotion();
    const onMotionChange = () => {
      reduced = prefersReducedMotion();
    };
    motionQuery?.addEventListener?.('change', onMotionChange);

    const setup = (): boolean => {
      try {
        res = initGl(gl);
        return true;
      } catch (err) {
        console.error('[FlameCanvas]', err);
        res = null;
        if (!gl.isContextLost()) setFailed(true);
        return false;
      }
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const frame = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      // clamp dt so a backgrounded tab does not jump on return
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
      last = now;
      const t = target.current;
      eased.o2 = ease(eased.o2, t.o2, dt);
      eased.pressure = ease(eased.pressure, t.pressure, dt);
      eased.flow = ease(eased.flow, t.flow, dt);
      eased.gravity = ease(eased.gravity, t.gravity, dt);
      const speed = reduced ? REDUCED_MOTION_SPEED : 1;
      time += dt * speed;
      phase += dt * speed * phaseSpeed(eased.gravity, eased.flow);

      if (!res || gl.isContextLost()) return;
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      const { loc } = res;
      gl.uniform2f(loc.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(loc.u_dpr, dpr);
      gl.uniform1f(loc.u_time, time);
      gl.uniform1f(loc.u_phase, phase);
      gl.uniform1f(loc.u_o2, eased.o2);
      gl.uniform1f(loc.u_pressure, eased.pressure);
      gl.uniform1f(loc.u_flow, eased.flow);
      gl.uniform1f(loc.u_gravity, eased.gravity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onLost = (e: Event) => {
      e.preventDefault(); // allow restoration
      cancelAnimationFrame(raf);
      res = null;
    };
    const onRestored = () => {
      if (setup()) start();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    resize();
    if (setup()) start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      motionQuery?.removeEventListener?.('change', onMotionChange);
      if (res && !gl.isContextLost()) {
        gl.deleteBuffer(res.buffer);
        gl.deleteProgram(res.program);
      }
      res = null;
    };
  }, []);

  const regime = flameRegime({ o2, pressure, flow, gravity });
  const classes = ['flame-stage', className].filter(Boolean).join(' ');

  return (
    <figure className={classes} aria-label="Live flame simulation">
      {failed ? (
        <div className="flame-fallback" role="img" aria-label="WebGL not available">
          <div className="flame-fallback__glyph" aria-hidden="true" />
          <p>WebGL not available</p>
        </div>
      ) : (
        <canvas ref={canvasRef} className="flame-canvas" />
      )}
      <figcaption className="flame-hud">
        <span className="flame-hud__tag">
          <span className="flame-hud__dot" aria-hidden="true" />
          Live flame
        </span>
        <span className="flame-hud__note">qualitative</span>
      </figcaption>
      <div className={`flame-regime flame-regime--${regime}`} aria-live="polite">
        {REGIME_LABEL[regime]}
      </div>
      <dl className="flame-readout">
        <div><dt>g</dt><dd>{gravity.toFixed(gravity < 1 && gravity > 0 ? 3 : 0)}</dd></div>
        <div><dt>O2</dt><dd>{o2.toFixed(0)}%</dd></div>
        <div><dt>P</dt><dd>{pressure.toFixed(1)} psi</dd></div>
        <div><dt>flow</dt><dd>{flow.toFixed(0)} cm/s</dd></div>
      </dl>
    </figure>
  );
}

export default FlameCanvas;
