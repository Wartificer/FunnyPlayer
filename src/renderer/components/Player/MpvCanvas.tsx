import { useEffect, useRef, useCallback } from 'react'
import { getMpv } from '../../mpv'

// WebGL-accelerated canvas that displays frames from mpv's software renderer
export function MpvCanvas({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const texRef = useRef<WebGLTexture | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const rafRef = useRef<number>(0)

  // Initialize WebGL
  const initGL = useCallback((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
    if (!gl) {
      console.error('[MpvCanvas] WebGL not available')
      return
    }
    glRef.current = gl

    // Vertex shader
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, `
      attribute vec2 aPos;
      attribute vec2 aUV;
      varying vec2 vUV;
      void main() {
        gl_Position = vec4(aPos, 0.0, 1.0);
        vUV = aUV;
      }
    `)
    gl.compileShader(vs)

    // Fragment shader — rgb0 means R,G,B,X (ignore alpha channel)
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D uTex;
      void main() {
        vec4 c = texture2D(uTex, vUV);
        gl_FragColor = vec4(c.rgb, 1.0);
      }
    `)
    gl.compileShader(fs)

    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.useProgram(prog)
    programRef.current = prog

    // Full-screen quad (two triangles)
    // UV is flipped vertically because mpv renders top-to-bottom
    const verts = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ])
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)

    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0)

    const aUV = gl.getAttribLocation(prog, 'aUV')
    gl.enableVertexAttribArray(aUV)
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8)

    // Texture
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    texRef.current = tex
  }, [])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    initGL(canvas)

    const mpv = getMpv()
    if (!mpv) return

    mpv.setRenderSize(width, height)

    let running = true
    let frameCount = 0
    const render = () => {
      if (!running) return
      rafRef.current = requestAnimationFrame(render)

      const gl = glRef.current
      if (!gl) return

      const frame = mpv.renderFrame()
      if (!frame) return

      if (frameCount === 0) {
        console.log(`[MpvCanvas] First frame received, size=${frame.length}, canvas=${width}x${height}`)
      }
      frameCount++

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.bindTexture(gl.TEXTURE_2D, texRef.current)
      // renderFrame() already hands back a freshly allocated ArrayBuffer that
      // WebGL can upload directly — copying it again here would duplicate a
      // full frame (~8MB at 1080p) on every single rAF.
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA,
        width, height, 0,
        gl.RGBA, gl.UNSIGNED_BYTE,
        frame
      )
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    rafRef.current = requestAnimationFrame(render)

    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [width, height, initGL])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block'
      }}
    />
  )
}
