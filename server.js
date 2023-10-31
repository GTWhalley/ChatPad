const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Store data
let dataStore = {};

// Function to load dataStore from a file
function loadDataStore() {
    if (fs.existsSync('dataStore.json')) {
        const rawData = fs.readFileSync('dataStore.json', 'utf8');
        return JSON.parse(rawData);
    }
    return {};
}

// Function to save dataStore to a file
function saveDataStore() {
    fs.writeFileSync('dataStore.json', JSON.stringify(dataStore), 'utf8');
}

// Initialize dataStore from file
dataStore = loadDataStore();

// Serve static files
app.use(express.static(path.join(__dirname)));


// For parsing application/json
app.use(bodyParser.json());

app.post('/generate', (req, res) => {
    const content = req.body.content;
    const id = crypto.randomBytes(16).toString('hex');
    dataStore[id] = {
        content: content,
        timestamp: new Date(),
        expireTimeout: setTimeout(() => {
            delete dataStore[id];
        }, 10 * 60 * 1000)
    };
    res.json({ link: `/view/${id}` });
    saveDataStore(); // Save the updated dataStore
});

app.post('/extend/:id', (req, res) => {
    const data = dataStore[req.params.id];
    if (data) {
        // Clear the previous timeout
        clearTimeout(data.expireTimeout);
        
        // Reset the timeout to 10 minutes
        data.expireTimeout = setTimeout(() => {
            delete dataStore[req.params.id];
        }, 10 * 60 * 1000);

        res.json({ success: true, remainingSeconds: 20 }); // set to 600 seconds for 10 mins
    } else {
        res.status(404).send("Not found");
    }
    saveDataStore(); // Save the updated dataStore
});

app.get('/view/:id', (req, res) => {
    const content = dataStore[req.params.id]?.content;
    if (content) {
        res.send(`<html><body>${content}</body></html>`);
    } else {
        // Redirect to expired.html if the link is not found in dataStore or has expired
        res.redirect('/expired.html');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
