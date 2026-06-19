/* mesh.js — a purpose-built, on-palette ambient mesh-gradient for the dark
   "hidden half" interstitial (#mesh-canvas). Brass + petrol blobs drifting on a
   dark ground — the Hidden SF duotone, not the harness's default vermilion.
   Raw WebGL, no deps. Static single frame under reduced motion; the rAF loop is
   fully cancelled off-screen and when the tab is hidden. */
(function () {
  "use strict";
  FX.add("mesh-gradient", function (fx) {
    var canvas = document.getElementById("mesh-canvas");
    if (!canvas) return;
    var gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) return;

    var VS = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }";
    var FS = [
      "precision highp float;",
      "uniform vec2 u_res; uniform float u_t;",
      "const vec3 base    = vec3(0.043,0.106,0.125);", // #0b1b20
      "const vec3 brass   = vec3(0.725,0.518,0.169);", // #b9842b
      "const vec3 brassS  = vec3(0.890,0.757,0.447);", // #e3c172
      "const vec3 petrol  = vec3(0.122,0.294,0.329);", // #1f4b54
      "const vec3 petrolS = vec3(0.357,0.541,0.565);", // #5b8a90
      "float blob(vec2 uv, vec2 c, float r){ return smoothstep(r, 0.0, length(uv-c)); }",
      "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }",
      "void main(){",
      "  float ar = u_res.x/u_res.y;",
      "  vec2 uv = gl_FragCoord.xy/u_res; uv.x *= ar;",
      "  float t = u_t*0.06;",
      "  vec2 c1 = vec2((0.30+0.12*sin(t*1.1))*ar, 0.40+0.10*cos(t*0.9));",
      "  vec2 c2 = vec2((0.78+0.10*cos(t*0.8))*ar, 0.62+0.12*sin(t*1.2));",
      "  vec2 c3 = vec2((0.55+0.14*sin(t*0.7+1.0))*ar, 0.30+0.08*cos(t*1.3));",
      "  vec2 c4 = vec2((0.20+0.10*cos(t*1.0+2.0))*ar, 0.78+0.09*sin(t*0.6));",
      "  vec3 col = base;",
      "  col = mix(col, brass,   blob(uv,c1,0.55*ar)*0.85);",
      "  col = mix(col, petrol,  blob(uv,c2,0.62*ar)*0.80);",
      "  col = mix(col, brassS,  blob(uv,c3,0.40*ar)*0.55);",
      "  col = mix(col, petrolS, blob(uv,c4,0.46*ar)*0.50);",
      "  col += (hash(gl_FragCoord.xy)-0.5)*0.022;", // fine grain
      "  gl_FragColor = vec4(col, 1.0);",
      "}",
    ].join("\n");

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn("[mesh] shader:", gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("[mesh] link:", gl.getProgramInfoLog(prog)); return; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(prog, "u_res");
    var uT = gl.getUniformLocation(prog, "u_t");

    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    function size() {
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    function draw(tsec) {
      size();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uT, tsec);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    if (fx.reduced) { draw(0); return; } // one static frame, no loop

    var raf = 0, t0 = null, visible = true, awake = !document.hidden;
    function loop(t) { if (t0 === null) t0 = t; draw((t - t0) / 1000); raf = requestAnimationFrame(loop); }
    function on() { if (visible && awake && !raf) raf = requestAnimationFrame(loop); }
    function off() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    try {
      var io = new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? on() : off(); });
      io.observe(canvas);
    } catch (e) { /* no IO: run anyway */ }
    document.addEventListener("visibilitychange", function () { awake = !document.hidden; awake ? on() : off(); });
    window.addEventListener("resize", function () { if (!raf) draw(0); });
    on();
  });
})();
