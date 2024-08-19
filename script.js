
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
uniform sampler2D noise2;

#define iChannel0 noise2
#define iTime time
#define STEP 256
#define EPS .001


// from various shader by iq

float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

const mat2 m = mat2(.8,.6,-.6,.8);

float noise( in vec2 x )
{
	return sin(1.5*x.x)*sin(1.5*x.y);
}

float fbm6( vec2 p )
{
    float f = 0.0;
    f += 0.500000*(0.5+0.5*noise( p )); p = m*p*2.02;
    f += 0.250000*(0.5+0.5*noise( p )); p = m*p*2.03;
    f += 0.125000*(0.5+0.5*noise( p )); p = m*p*2.01;
    f += 0.062500*(0.5+0.5*noise( p )); p = m*p*2.04;
    //f += 0.031250*(0.5+0.5*noise( p )); p = m*p*2.01;
    f += 0.015625*(0.5+0.5*noise( p ));
    return f/0.96875;
}


mat2 getRot(float a)
{
    float sa = sin(a), ca = cos(a);
    return mat2(ca,-sa,sa,ca);
}


vec3 _position;

float sphere(vec3 center, float radius)
{
    return distance(_position,center) - radius;
}

float hozPlane(float height)
{
    return distance(_position.y,height);
}

float swingPlane(float height)
{
    vec3 pos = _position + vec3(0.,0.,iTime * 2.5);
    float def =  fbm6(pos.xz * .25) * 1.;

    float way = pow(abs(pos.x) * 34. ,2.5) *.0000125;
    def *= way;

    float ch = height + def;
    return max(pos.y - ch,0.);
}

float map(vec3 pos)
{
    _position = pos;

    float dist;
    dist = swingPlane(0.);

    float sminFactor = 5.25;
    dist = smin(dist,sphere(vec3(0.,-15.,80.),45.),sminFactor);
    return dist;
}


vec3 getNormal(vec3 pos)
{
    vec3 nor = vec3(0.);
    vec3 vv = vec3(0.,1.,-1.)*.01;
    nor.x = map(pos + vv.zxx) - map(pos + vv.yxx);
    nor.y = map(pos + vv.xzx) - map(pos + vv.xyx);
    nor.z = map(pos + vv.xxz) - map(pos + vv.xxy);
    nor /= 2.;
    return normalize(nor);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = (fragCoord.xy-.5*resolution.xy)*2./resolution.y;

    vec3 rayOrigin = vec3(uv + vec2(0.,6.), -1. );

    vec3 rayDir = normalize(vec3(uv , 1.));

   	rayDir.zy = getRot(.05) * rayDir.zy;
   	rayDir.xy = getRot(.075) * rayDir.xy;

    vec3 position = rayOrigin;


    float curDist;
    int nbStep = 0;

    for(; nbStep < STEP;++nbStep)
    {
        curDist = map(position + (texture(iChannel0, position.xz) - .5).xyz * .005);

        if(curDist < EPS)
            break;
        position += rayDir * curDist * .5;
    }

    float f;

    //sound = sin(iTime) * .5 + .5;

    float dist = distance(rayOrigin,position);
    f = dist /(98.);
    f = float(nbStep) / float(STEP);

    f *= .8;
    vec3 col = vec3(f);


    //float shouldColor = 1.- step(f,threshold);
    //col = mix(col,vec3(1.,0.,0.) ,shouldColor);

    fragColor = vec4(col,1.0);
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

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTexture);
    gl.uniform1i(noise2UniformLocation, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fontTexture);
    gl.uniform1i(font1UniformLocation, 1);

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
