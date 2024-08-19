
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

// By Jared Berghold 2022 (https://www.jaredberghold.com/)
// Based on the "Simplicity Galaxy" shader by CBS (https://www.shadertoy.com/view/MslGWN)
// The nebula effect is based on the kaliset fractal (https://softologyblog.wordpress.com/2011/05/04/kalisets-and-hybrid-ducks/)

const int MAX_ITER = 18;

float field(vec3 p, float s, int iter)
{
	float accum = s / 4.0;
	float prev = 0.0;
	float tw = 0.0;
	for (int i = 0; i < MAX_ITER; ++i)
  	{
		if (i >= iter) // drop from the loop if the number of iterations has been completed - workaround for GLSL loop index limitation
		{
			break;
		}
		float mag = dot(p, p);
		p = abs(p) / mag + vec3(-0.5, -0.4, -1.487);
		float w = exp(-float(i) / 5.0);
		accum += w * exp(-9.025 * pow(abs(mag - prev), 2.2));
		tw += w;
		prev = mag;
	}
	return max(0.0, 5.2 * accum / tw - 0.65);
}

vec3 nrand3(vec2 co)
{
	vec3 a = fract(cos(co.x*8.3e-3 + co.y) * vec3(1.3e5, 4.7e5, 2.9e5));
	vec3 b = fract(sin(co.x*0.3e-3 + co.y) * vec3(8.1e5, 1.0e5, 0.1e5));
	vec3 c = mix(a, b, 0.5);
	return c;
}

vec4 starLayer(vec2 p, float time)
{
	vec2 seed = 1.9 * p.xy;
	seed = floor(seed * max(resolution.x, 600.0) / 1.5);
	vec3 rnd = nrand3(seed);
	vec4 col = vec4(pow(rnd.y, 17.0));
	float mul = 10.0 * rnd.x;
	col.xyz *= sin(time * mul + mul) * 0.25 + 1.0;
	return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float time = iTime / (resolution.x / 1000.0);

    // first layer of the kaliset fractal
	vec2 uv = 2.0 * fragCoord / resolution.xy - 1.0;
  	vec2 uvs = uv * resolution.xy / max(resolution.x, resolution.y);
	vec3 p = vec3(uvs / 2.5, 0.0) + vec3(0.8, -1.3, 0.0);
	p += 0.45 * vec3(sin(time / 32.0), sin(time / 24.0), sin(time / 64.0));

	// adjust first layer position based on mouse movement
	p.x += mix(-0.02, 0.02, (1. / resolution.x));
	p.y += mix(-0.02, 0.02, (1. / resolution.y));

	float freqs[4];
	freqs[0] = 0.45;
	freqs[1] = 0.4;
	freqs[2] = 0.15;
	freqs[3] = 0.9;

	float t = field(p, freqs[2], 13);
	float v = (1.0 - exp((abs(uv.x) - 1.0) * 6.0)) * (1.0 - exp((abs(uv.y) - 1.0) * 6.0));

    // second layer of the kaliset fractal
	vec3 p2 = vec3(uvs / (4.0 + sin(time * 0.11) * 0.2 + 0.2 + sin(time * 0.15) * 0.3 + 0.4), 4.0) + vec3(2.0, -1.3, -1.0);
	p2 += 0.16 * vec3(sin(time / 32.0), sin(time / 24.0), sin(time / 64.0));

	// adjust second layer position based on mouse movement
	p2.x += mix(-0.01, 0.01, (1. / resolution.x));
	p2.y += mix(-0.01, 0.01, (1. / resolution.y));
	float t2 = field(p2, freqs[3], 18);
	vec4 c2 = mix(0.5, 0.2, v) * vec4(5.5 * t2 * t2 * t2, 2.1 * t2 * t2, 2.2 * t2 * freqs[0], t2);

	// add stars (source: https://glslsandbox.com/e#6904.0)
	vec4 starColour = vec4(0.0);
	starColour += starLayer(p.xy, time); // add first layer of stars
	starColour += starLayer(p2.xy, time); // add second layer of stars

	const float brightness = 1.0;
	vec4 colour = mix(freqs[3] - 0.3, 1.0, v) * vec4(1.5 * freqs[2] * t * t * t, 1.2 * freqs[1] * t * t, freqs[3] * t, 1.0) + c2 + starColour;
	fragColor = vec4(brightness * colour.xyz, 1.0);
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
