let express = require('express');
let path = require('path');
let app = express();

app.use(express.static(path.join(__dirname, '/public/')));

app.get('/smart-launch', (request, response) => {
    response.sendFile(path.join(__dirname + '/launch.html'));
});

app.get('/', (request, response) => {
    response.sendFile(path.join(__dirname + '/index.html'));
});

// Here is where we define the port for the localhost server to setup
app.listen(5000);
