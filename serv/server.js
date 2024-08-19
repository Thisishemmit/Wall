import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

app.use((req, res, next) => {
  console.log(`${req.method} request for ${req.url}`);
  next();
});

app.post('/saveFrame', (req, res) => {
    console.log('Received a request to /saveFrame');
    const { frameData, frameNumber } = req.body;
    if (!frameData || frameNumber === undefined) {
        return res.status(400).send('Missing frameData or frameNumber');
    }
    const base64Data = frameData.replace(/^data:image\/png;base64,/, "");

    const framesDir = path.join(__dirname, 'frames');
    if (!fs.existsSync(framesDir)){
        fs.mkdirSync(framesDir);
    }

    fs.writeFile(path.join(framesDir, `frame${frameNumber}.png`), base64Data, 'base64', (err) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error saving frame');
        } else {
            res.send('Frame saved successfully');
        }
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
