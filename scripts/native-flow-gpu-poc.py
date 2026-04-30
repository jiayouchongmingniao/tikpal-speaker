#!/usr/bin/env python3
"""
Run a native X11/EGL/GLES Flow rendering probe on the Raspberry Pi.

This intentionally uses ctypes so the target device does not need C headers or
build tools installed. It opens an X11 window, creates an EGL GLES2 context, and
draws a Flow-like shader at the requested physical size while reporting FPS.
"""

from __future__ import annotations

import argparse
import ctypes
import json
import os
import sys
import time
from ctypes import byref, c_char_p, c_float, c_int, c_long, c_uint, c_ulong, c_void_p, POINTER


EGL_FALSE = 0
EGL_NONE = 0x3038
EGL_RED_SIZE = 0x3024
EGL_GREEN_SIZE = 0x3023
EGL_BLUE_SIZE = 0x3022
EGL_ALPHA_SIZE = 0x3021
EGL_DEPTH_SIZE = 0x3025
EGL_STENCIL_SIZE = 0x3026
EGL_SURFACE_TYPE = 0x3033
EGL_WINDOW_BIT = 0x0004
EGL_RENDERABLE_TYPE = 0x3040
EGL_OPENGL_ES2_BIT = 0x0004
EGL_CONTEXT_CLIENT_VERSION = 0x3098
EGL_OPENGL_ES_API = 0x30A0

GL_FALSE = 0
GL_FLOAT = 0x1406
GL_TRIANGLES = 0x0004
GL_ARRAY_BUFFER = 0x8892
GL_STATIC_DRAW = 0x88E4
GL_VERTEX_SHADER = 0x8B31
GL_FRAGMENT_SHADER = 0x8B30
GL_COMPILE_STATUS = 0x8B81
GL_LINK_STATUS = 0x8B82
GL_INFO_LOG_LENGTH = 0x8B84
GL_RENDERER = 0x1F01
GL_VERSION = 0x1F02


VERTEX_SHADER = b"""
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
"""

FRAGMENT_SHADER = b"""
precision mediump float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;

float wave(float x, float speed, float frequency, float amplitude, float phase) {
  return sin(x * frequency + u_time * speed + phase) * amplitude;
}

void main() {
  vec2 uv = v_uv;
  vec2 centered = uv * 2.0 - 1.0;
  float ridge_a = wave(centered.x, 0.58, 5.7, 0.16, 0.0);
  float ridge_b = wave(centered.x, 0.81, 9.2, 0.08, 1.6);
  float ridge = ridge_a + ridge_b;
  float band = smoothstep(0.17, 0.0, abs(centered.y - ridge));
  float glow_wave = wave(centered.x, 0.34, 3.2, 0.28, 2.2);
  float aura = smoothstep(1.0, 0.0, length(vec2(centered.x * 0.88, centered.y - glow_wave * 0.42)));
  float pulse = 0.1 + sin(u_time * 0.4) * 0.025;
  vec3 base = vec3(0.008, 0.014, 0.028);
  vec3 accent = vec3(0.34, 0.54, 0.96) * band * 0.82;
  vec3 glow = vec3(0.78, 0.42, 0.92) * aura * pulse;
  float vignette = smoothstep(1.52, 0.22, length(centered * vec2(1.0, 0.82)));
  gl_FragColor = vec4((base + accent + glow) * (0.58 + vignette * 0.42), 1.0);
}
"""


def load_library(name: str):
  try:
    return ctypes.CDLL(name)
  except OSError as exc:
    raise RuntimeError(f"failed to load {name}: {exc}") from exc


def egl_error(egl) -> str:
  egl.eglGetError.restype = c_int
  return f"0x{egl.eglGetError():04x}"


def read_gl_string(gl, token: int) -> str:
  gl.glGetString.argtypes = [c_uint]
  gl.glGetString.restype = c_char_p
  value = gl.glGetString(token)
  return value.decode("utf-8", "replace") if value else "unknown"


def configure_gl(gl):
  gl.glAttachShader.argtypes = [c_uint, c_uint]
  gl.glBindBuffer.argtypes = [c_uint, c_uint]
  gl.glBufferData.argtypes = [c_uint, c_long, c_void_p, c_uint]
  gl.glCompileShader.argtypes = [c_uint]
  gl.glDeleteBuffers.argtypes = [c_int, POINTER(c_uint)]
  gl.glDeleteProgram.argtypes = [c_uint]
  gl.glDeleteShader.argtypes = [c_uint]
  gl.glDrawArrays.argtypes = [c_uint, c_int, c_int]
  gl.glEnableVertexAttribArray.argtypes = [c_uint]
  gl.glGenBuffers.argtypes = [c_int, POINTER(c_uint)]
  gl.glLinkProgram.argtypes = [c_uint]
  gl.glUniform1f.argtypes = [c_int, c_float]
  gl.glUniform2f.argtypes = [c_int, c_float, c_float]
  gl.glUseProgram.argtypes = [c_uint]
  gl.glVertexAttribPointer.argtypes = [c_uint, c_int, c_uint, c_uint, c_int, c_void_p]
  gl.glViewport.argtypes = [c_int, c_int, c_int, c_int]


def setup_x11(x11, width: int, height: int, title: str):
  x11.XOpenDisplay.argtypes = [c_char_p]
  x11.XOpenDisplay.restype = c_void_p
  display_name = os.environ.get("DISPLAY")
  display = x11.XOpenDisplay(display_name.encode() if display_name else None)
  if not display:
    raise RuntimeError("XOpenDisplay failed; set DISPLAY=:0 and XAUTHORITY if needed")

  x11.XDefaultScreen.argtypes = [c_void_p]
  x11.XDefaultScreen.restype = c_int
  x11.XRootWindow.argtypes = [c_void_p, c_int]
  x11.XRootWindow.restype = c_ulong
  x11.XBlackPixel.argtypes = [c_void_p, c_int]
  x11.XBlackPixel.restype = c_ulong
  x11.XCreateSimpleWindow.argtypes = [
    c_void_p,
    c_ulong,
    c_int,
    c_int,
    c_uint,
    c_uint,
    c_uint,
    c_ulong,
    c_ulong,
  ]
  x11.XCreateSimpleWindow.restype = c_ulong
  x11.XStoreName.argtypes = [c_void_p, c_ulong, c_char_p]
  x11.XMoveResizeWindow.argtypes = [c_void_p, c_ulong, c_int, c_int, c_uint, c_uint]
  x11.XMapRaised.argtypes = [c_void_p, c_ulong]
  x11.XRaiseWindow.argtypes = [c_void_p, c_ulong]
  x11.XFlush.argtypes = [c_void_p]
  x11.XDestroyWindow.argtypes = [c_void_p, c_ulong]
  x11.XCloseDisplay.argtypes = [c_void_p]

  screen = x11.XDefaultScreen(display)
  root = x11.XRootWindow(display, screen)
  black = x11.XBlackPixel(display, screen)
  window = x11.XCreateSimpleWindow(display, root, 0, 0, width, height, 0, black, black)
  if not window:
    x11.XCloseDisplay(display)
    raise RuntimeError("XCreateSimpleWindow failed")

  x11.XStoreName(display, window, title.encode("utf-8"))
  x11.XMoveResizeWindow(display, window, 0, 0, width, height)
  x11.XMapRaised(display, window)
  x11.XRaiseWindow(display, window)
  x11.XFlush(display)
  return display, window


def choose_config(egl, display):
  attribs = (c_int * 17)(
    EGL_SURFACE_TYPE,
    EGL_WINDOW_BIT,
    EGL_RENDERABLE_TYPE,
    EGL_OPENGL_ES2_BIT,
    EGL_RED_SIZE,
    8,
    EGL_GREEN_SIZE,
    8,
    EGL_BLUE_SIZE,
    8,
    EGL_ALPHA_SIZE,
    8,
    EGL_DEPTH_SIZE,
    0,
    EGL_STENCIL_SIZE,
    0,
    EGL_NONE,
  )
  config = c_void_p()
  count = c_int()
  egl.eglChooseConfig.argtypes = [c_void_p, POINTER(c_int), POINTER(c_void_p), c_int, POINTER(c_int)]
  egl.eglChooseConfig.restype = c_int
  if egl.eglChooseConfig(display, attribs, byref(config), 1, byref(count)) == EGL_FALSE or count.value < 1:
    raise RuntimeError(f"eglChooseConfig failed: {egl_error(egl)}")
  return config


def setup_egl(egl, x_display, x_window):
  egl.eglGetDisplay.argtypes = [c_void_p]
  egl.eglGetDisplay.restype = c_void_p
  egl_display = egl.eglGetDisplay(x_display)
  if not egl_display:
    raise RuntimeError(f"eglGetDisplay failed: {egl_error(egl)}")

  major = c_int()
  minor = c_int()
  egl.eglInitialize.argtypes = [c_void_p, POINTER(c_int), POINTER(c_int)]
  egl.eglInitialize.restype = c_int
  if egl.eglInitialize(egl_display, byref(major), byref(minor)) == EGL_FALSE:
    raise RuntimeError(f"eglInitialize failed: {egl_error(egl)}")

  egl.eglBindAPI.argtypes = [c_uint]
  egl.eglBindAPI.restype = c_int
  if egl.eglBindAPI(EGL_OPENGL_ES_API) == EGL_FALSE:
    raise RuntimeError(f"eglBindAPI failed: {egl_error(egl)}")

  config = choose_config(egl, egl_display)
  egl.eglCreateWindowSurface.argtypes = [c_void_p, c_void_p, c_ulong, c_void_p]
  egl.eglCreateWindowSurface.restype = c_void_p
  surface = egl.eglCreateWindowSurface(egl_display, config, x_window, None)
  if not surface:
    raise RuntimeError(f"eglCreateWindowSurface failed: {egl_error(egl)}")

  context_attribs = (c_int * 3)(EGL_CONTEXT_CLIENT_VERSION, 2, EGL_NONE)
  egl.eglCreateContext.argtypes = [c_void_p, c_void_p, c_void_p, POINTER(c_int)]
  egl.eglCreateContext.restype = c_void_p
  context = egl.eglCreateContext(egl_display, config, None, context_attribs)
  if not context:
    raise RuntimeError(f"eglCreateContext failed: {egl_error(egl)}")

  egl.eglMakeCurrent.argtypes = [c_void_p, c_void_p, c_void_p, c_void_p]
  egl.eglMakeCurrent.restype = c_int
  if egl.eglMakeCurrent(egl_display, surface, surface, context) == EGL_FALSE:
    raise RuntimeError(f"eglMakeCurrent failed: {egl_error(egl)}")

  egl.eglSwapInterval.argtypes = [c_void_p, c_int]
  egl.eglSwapInterval.restype = c_int
  egl.eglSwapBuffers.argtypes = [c_void_p, c_void_p]
  egl.eglSwapBuffers.restype = c_int
  egl.eglDestroyContext.argtypes = [c_void_p, c_void_p]
  egl.eglDestroySurface.argtypes = [c_void_p, c_void_p]
  egl.eglTerminate.argtypes = [c_void_p]
  return egl_display, surface, context, (major.value, minor.value)


def shader_log(gl, shader):
  length = c_int()
  gl.glGetShaderiv(shader, GL_INFO_LOG_LENGTH, byref(length))
  if length.value <= 1:
    return ""
  buffer = ctypes.create_string_buffer(length.value)
  gl.glGetShaderInfoLog(shader, length, None, buffer)
  return buffer.value.decode("utf-8", "replace")


def program_log(gl, program):
  length = c_int()
  gl.glGetProgramiv(program, GL_INFO_LOG_LENGTH, byref(length))
  if length.value <= 1:
    return ""
  buffer = ctypes.create_string_buffer(length.value)
  gl.glGetProgramInfoLog(program, length, None, buffer)
  return buffer.value.decode("utf-8", "replace")


def compile_shader(gl, shader_type: int, source: bytes):
  gl.glCreateShader.argtypes = [c_uint]
  gl.glCreateShader.restype = c_uint
  shader = gl.glCreateShader(shader_type)
  source_ptr = c_char_p(source)
  gl.glShaderSource.argtypes = [c_uint, c_int, POINTER(c_char_p), c_void_p]
  gl.glShaderSource(shader, 1, byref(source_ptr), None)
  gl.glCompileShader.argtypes = [c_uint]
  gl.glCompileShader(shader)
  status = c_int()
  gl.glGetShaderiv.argtypes = [c_uint, c_uint, POINTER(c_int)]
  gl.glGetShaderiv(shader, GL_COMPILE_STATUS, byref(status))
  if status.value == GL_FALSE:
    log = shader_log(gl, shader)
    gl.glDeleteShader(shader)
    raise RuntimeError(f"shader compile failed: {log}")
  return shader


def create_program(gl):
  vertex = compile_shader(gl, GL_VERTEX_SHADER, VERTEX_SHADER)
  fragment = compile_shader(gl, GL_FRAGMENT_SHADER, FRAGMENT_SHADER)
  gl.glCreateProgram.restype = c_uint
  program = gl.glCreateProgram()
  gl.glAttachShader(program, vertex)
  gl.glAttachShader(program, fragment)
  gl.glLinkProgram(program)
  status = c_int()
  gl.glGetProgramiv.argtypes = [c_uint, c_uint, POINTER(c_int)]
  gl.glGetProgramiv(program, GL_LINK_STATUS, byref(status))
  gl.glDeleteShader(vertex)
  gl.glDeleteShader(fragment)
  if status.value == GL_FALSE:
    log = program_log(gl, program)
    gl.glDeleteProgram(program)
    raise RuntimeError(f"program link failed: {log}")
  return program


def setup_geometry(gl, program):
  vertices = (c_float * 12)(-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0)
  buffer = c_uint()
  gl.glGenBuffers(1, byref(buffer))
  gl.glBindBuffer(GL_ARRAY_BUFFER, buffer)
  gl.glBufferData(GL_ARRAY_BUFFER, ctypes.sizeof(vertices), vertices, GL_STATIC_DRAW)

  gl.glGetAttribLocation.argtypes = [c_uint, c_char_p]
  gl.glGetAttribLocation.restype = c_int
  position = gl.glGetAttribLocation(program, b"a_position")
  if position < 0:
    raise RuntimeError("attribute a_position not found")
  gl.glEnableVertexAttribArray(position)
  gl.glVertexAttribPointer(position, 2, GL_FLOAT, GL_FALSE, 0, c_void_p(0))
  return buffer


def run_probe(args):
  if not os.environ.get("DISPLAY"):
    os.environ["DISPLAY"] = ":0"
  os.environ.setdefault("XAUTHORITY", os.path.expanduser("~/.Xauthority"))

  x11 = load_library("libX11.so.6")
  egl = load_library("libEGL.so.1")
  gl = load_library("libGLESv2.so.2")
  configure_gl(gl)

  x_display = None
  x_window = None
  egl_display = None
  surface = None
  context = None
  try:
    x_display, x_window = setup_x11(x11, args.width, args.height, args.title)
    egl_display, surface, context, egl_version = setup_egl(egl, x_display, x_window)
    egl.eglSwapInterval(egl_display, args.swap_interval)

    program = create_program(gl)
    gl.glUseProgram(program)
    buffer = setup_geometry(gl, program)

    gl.glViewport(0, 0, args.width, args.height)
    gl.glGetUniformLocation.argtypes = [c_uint, c_char_p]
    gl.glGetUniformLocation.restype = c_int
    resolution_loc = gl.glGetUniformLocation(program, b"u_resolution")
    time_loc = gl.glGetUniformLocation(program, b"u_time")

    renderer = read_gl_string(gl, GL_RENDERER)
    version = read_gl_string(gl, GL_VERSION)
    started = time.monotonic()
    deadline = started + args.duration
    frames = 0
    slowest_frame_ms = 0.0
    last_frame = started

    while time.monotonic() < deadline:
      now = time.monotonic()
      frame_delta_ms = (now - last_frame) * 1000
      slowest_frame_ms = max(slowest_frame_ms, frame_delta_ms)
      last_frame = now

      gl.glUseProgram(program)
      gl.glUniform2f(resolution_loc, float(args.width), float(args.height))
      gl.glUniform1f(time_loc, float(now - started))
      gl.glDrawArrays(GL_TRIANGLES, 0, 6)
      if egl.eglSwapBuffers(egl_display, surface) == EGL_FALSE:
        raise RuntimeError(f"eglSwapBuffers failed: {egl_error(egl)}")
      frames += 1

    elapsed = time.monotonic() - started
    fps = frames / elapsed if elapsed > 0 else 0.0
    result = {
      "ok": True,
      "renderer": renderer,
      "glVersion": version,
      "eglVersion": f"{egl_version[0]}.{egl_version[1]}",
      "width": args.width,
      "height": args.height,
      "durationSec": round(elapsed, 3),
      "frames": frames,
      "avgFps": round(fps, 2),
      "slowestFrameMs": round(slowest_frame_ms, 2),
      "swapInterval": args.swap_interval,
    }
    gl.glDeleteBuffers(1, byref(buffer))
    gl.glDeleteProgram(program)
    return result
  finally:
    if egl_display and context and surface:
      egl.eglMakeCurrent(egl_display, None, None, None)
      egl.eglDestroyContext(egl_display, context)
      egl.eglDestroySurface(egl_display, surface)
      egl.eglTerminate(egl_display)
    if x_display and x_window:
      x11.XDestroyWindow(x_display, x_window)
      x11.XFlush(x_display)
      x11.XCloseDisplay(x_display)


def parse_args(argv):
  parser = argparse.ArgumentParser(description="Run the native Flow GPU PoC on an X11/EGL/GLES device.")
  parser.add_argument("--width", type=int, default=2560)
  parser.add_argument("--height", type=int, default=720)
  parser.add_argument("--duration", type=float, default=30.0)
  parser.add_argument("--swap-interval", type=int, default=1)
  parser.add_argument("--title", default="Tikpal Native Flow GPU PoC")
  parser.add_argument("--out", default="")
  return parser.parse_args(argv)


def main(argv):
  args = parse_args(argv)
  try:
    result = run_probe(args)
  except Exception as exc:
    result = {
      "ok": False,
      "error": str(exc),
      "width": args.width,
      "height": args.height,
      "durationSec": args.duration,
      "swapInterval": args.swap_interval,
    }
  payload = json.dumps(result, indent=2, sort_keys=True)
  if args.out:
    with open(args.out, "w", encoding="utf-8") as handle:
      handle.write(payload + "\n")
  print(payload)
  return 0 if result.get("ok") else 1


if __name__ == "__main__":
  sys.exit(main(sys.argv[1:]))
