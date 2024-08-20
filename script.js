
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, alpha: false });

// Vertex shader program
const vsSource = `#version 300 es
        in vec4 aPosition;
        void main() {
            gl_Position = aPosition;
        }`;

// Fragment shader program
const fsSource = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 resolution;
uniform float time;

#define iTime time

float det = 0.001, t, boxhit;
vec3 adv, boxp;

float hash(vec2 p)
{
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

mat2 rot(float a)
{
    float s = sin(a), c = cos(a);
    return mat2(c, s, -s, c);
}

vec3 path(float t)
{
    vec3 p = vec3(vec2(sin(t * 0.1), cos(t * 0.05)) * 10.0, t);
    p.x += smoothstep(0.0, 0.5, abs(0.5 - fract(t * 0.02))) * 10.0;
    return p;
}

float fractal(vec2 p)
{
    p = abs(5.0 - mod(p * 0.2, 10.0)) - 5.0;
    float ot = 1000.0;
    for (int i = 0; i < 7; i++)
    {
        p = abs(p) / clamp(p.x * p.y, 0.25, 2.0) - 1.0;
        if (i > 0) ot = min(ot, abs(p.x) + 0.7 * fract(abs(p.y) * 0.05 + t * 0.05 + float(i) * 0.3));
    }
    ot = exp(-10.0 * ot);
    return ot;
}

float box(vec3 p, vec3 l)
{
    vec3 c = abs(p) - l;
    return length(max(vec3(0.0), c)) + min(0.0, max(c.x, max(c.y, c.z)));
}

float de(vec3 p)
{
    boxhit = 0.0;
    vec3 p2 = p - adv;
    p2.xz *= rot(t * 0.2);
    p2.xy *= rot(t * 0.1);
    p2.yz *= rot(t * 0.15);
    float b = box(p2, vec3(1.0));
    p.xy -= path(p.z).xy;
    float s = sign(p.y);
    p.y = -abs(p.y) - 3.0;
    p.z = mod(p.z, 20.0) - 10.0;
    for (int i = 0; i < 5; i++)
    {
        p = abs(p) - 1.0;
        p.xz *= rot(radians(s * -45.0));
        p.yz *= rot(radians(90.0));
    }
    float f = -box(p, vec3(5.0, 5.0, 10.0));
    float d = min(f, b);
    if (d == b) boxp = p2, boxhit = 1.0;
    return d * 0.7;
}

vec3 march(vec3 from, vec3 dir)
{
    vec3 p, n, g = vec3(0.0);
    float d, td = 0.0;
    for (int i = 0; i < 80; i++)
    {
        p = from + td * dir;
        d = de(p) * (1.0 - hash(gl_FragCoord.xy + t) * 0.3);
        if (d < det && boxhit < 0.5) break;
        td += max(det, abs(d));
        float f = fractal(p.xy) + fractal(p.xz) + fractal(p.yz);
        float b = fractal(boxp.xy) + fractal(boxp.xz) + fractal(boxp.yz);
        vec3 colf = vec3(f);
        vec3 colb = vec3(b + 0.1, b * b + 0.05, 0.0);
        g += colf / (3.0 + d * d * 2.0) * exp(-0.0015 * td * td) * step(5.0, td) / 2.0 * (1.0 - boxhit);
        g += colb / (10.0 + d * d * 20.0) * boxhit * 0.5;
    }
    return g;
}

mat3 lookat(vec3 dir, vec3 up)
{
    dir = normalize(dir);
    vec3 rt = normalize(cross(dir, normalize(up)));
    return mat3(rt, cross(rt, dir), dir);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (fragCoord - resolution.xy * .5)*2. / resolution.y;
    t = iTime * 7.0;
    vec3 from = path(t);
    adv = path(t + 6.0 + sin(t * 0.1) * 3.0);
    vec3 dir = normalize(vec3(uv, 0.7));
    dir = lookat(adv - from, vec3(0.0, 1.0, 0.0)) * dir;
    vec3 col = march(from, dir);
    fragColor = vec4(col, 1.0);
}

out vec4 frag;

void main() {
	vec4 fragment_color;
	mainImage(fragment_color, gl_FragCoord.xy);
	frag = fragment_color;
}
`

function updateCanvasSize() {
    const disWidth = canvas.clientWidth;
    const disHeight = canvas.clientHeight;
    if (canvas.width !== disWidth || canvas.height !== disHeight) {
        canvas.width = disWidth;
        canvas.height = disHeight;
    }
}
// Create shader program
function createShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vsSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fsSource);
    gl.compileShader(fragmentShader);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    return shaderProgram;
}

const shaderProgram = createShaderProgram(gl, vsSource, fsSource);

// Create a buffer for the full-screen quad
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
const positions = [
    -1, -1,
    1, -1,
    -1, 1,
    1, 1
];
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);


const positionAttributeLocation = gl.getAttribLocation(shaderProgram, 'aPosition');
gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

// Get uniform locations
const resolutionUniformLocation = gl.getUniformLocation(shaderProgram, 'resolution');
const timeUniformLocation = gl.getUniformLocation(shaderProgram, 'time');
const noise2UniformLocation = gl.getUniformLocation(shaderProgram, 'noise2');
const font1UniformLocation = gl.getUniformLocation(shaderProgram, 'font1');

// textures
function createTexture(gl, src) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Fill the texture with a 1x1 blue pixel.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 255, 255]));

    // Asynchronously load an image
    const image = new Image();
    image.src = src;
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    };

    return texture;
}

const noiseTexture = createTexture(gl, "noise.png");
const fontTexture = createTexture(gl, "font.png");
// Set up recording

const log = document.createElement('p');
document.body.appendChild(log);
// ... (previous code remains the same)

const imageFrames = [];
let frameNumber = 0;


function sendFrameToServer(frameData, frameNumber) {
    return fetch('http://localhost:3000/saveFrame', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frameData, frameNumber }),
    })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
                });
            }
            return response.text();
        })
        .then(result => console.log(result))
        .catch(error => console.error('Error:', error));
}

let time = 0;
async function render() {
    updateCanvasSize();
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(shaderProgram);

    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(timeUniformLocation, time);

    /* gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
    gl.uniform1i(noise2UniformLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fontTexture);
    gl.uniform1i(font1UniformLocation, 1); */

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    log.textContent = `Time: ${time}, Frame: ${frameNumber}`;

    const frameData = canvas.toDataURL('image/png');
    try {
        await sendFrameToServer(frameData, frameNumber);
        console.log(`Frame ${frameNumber} sent successfully`);
        frameNumber++;
        time += 1/60;

        if (time < 20) {
            requestAnimationFrame(render);
        } else {
            console.log('Finished rendering all frames');
        }
    } catch (error) {
        console.error(`Error sending frame ${frameNumber}:`, error);
        // Optionally, you could add a retry mechanism here
    }
}

render();
