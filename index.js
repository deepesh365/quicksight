// server.js
// importing express 
const express = require('express');
const users = require('./users.json');
const fs = require("fs");

const awsCredentials = require('./aws_config.json');
// creating express instance
const app = express();
const AWS = require('aws-sdk');
const https = require('https');
const jwt = require('jsonwebtoken');
var md5 = require('md5');
var cors = require('cors');



 
// importing body-parser, which will handle the user input bodies
const bodyParser = require('body-parser');
// put access token and secret here
const accessTokenSecret = '';
const refreshTokenSecret = '';

/*
const jsonString = fs.readFileSync("./users.json");
const users = JSON.parse(jsonString);
*/
const refreshTokens = [];


const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, accessTokenSecret, (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};
app.use(cors());
app.options('*', cors()); 

app.use(bodyParser.json()); // only parses json data
app.use(bodyParser.urlencoded({ // handles the urlencoded bodies
    extended: true
}));
 
app.get('/', (req, res) => {
   res.json({
        'ping': 'pong'
    });
});
 
app.post('/login', (req, res) => {
    // Read username and password from request body
    const { username, password } = req.body;

    // Filter user from the users array by username and password
    // const user = users.find(u => { return u.username === username && md5(u.password) === md5(password) });
    const user = users.find(u => { return u.username === username && u.password === password });

    if (user) {
        // Generate an access token
        const accessToken = jwt.sign({ username: user.username,  role: user.dashboards }, accessTokenSecret, { expiresIn: '5m' });
        const refreshToken = jwt.sign({ username: user.username, role: user.dashboards }, refreshTokenSecret);

        refreshTokens.push(refreshToken);

        res.json({
            accessToken,
            refreshToken
        });
    } else {
        res.send('Username or password incorrect');
    }
});

app.post('/logout', (req, res) => {
    const { token } = req.body;
    refreshTokens = refreshTokens.filter(token => t !== token);

    res.send("Logout successful");
});

app.post('/token', (req, res) => {
    const { token } = req.body;
    console.log(res);
    if (!token) {
        return res.sendStatus(401);
    }

    if (!refreshTokens.includes(token)) {
        return res.sendStatus(403);
    }

    jwt.verify(token, refreshTokenSecret, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }

        const accessToken = jwt.sign({ username: user.username, role: user.role }, accessTokenSecret, { expiresIn: '30m' });

        res.json({
            accessToken
        });
    });
});

app.get('/embeddedUrl', (req, res) => {
    getEmbedUrl().then(function(data) {
        res.send(data);
    });

});

// secure url for getting dashboard
app.post('/embeddedUrl',  authenticateJWT,  (req, res) => {
    const result = getUserDashBoards(req.user.role);
    console.log(result);
    Promise.all(result).then((values) => {
        res.send(values);
        console.log(values);
      }).catch(error => console.log('Error in executing ${error}'));    
});

 function getUserDashBoards (boards){
    return boards.map(async  board => {
        return getEmbedUrlParams(board);
    });
}
 

function getEmbedUrl() {
    return new Promise(function(resolve,reject) {
        AWS.config.update(awsCredentials);
            var quicksight = new AWS.QuickSight();  
            quicksight.getDashboardEmbedUrl({
                'AwsAccountId': '204538904702', 
                'DashboardId': '09f50c69-c814-46c9-ac42-d121c2e6b35f',
                'IdentityType': 'QUICKSIGHT',
                'ResetDisabled': true,
                'SessionLifetimeInMinutes': 100,
                'UndoRedoDisabled': false,
                'UserArn':'arn:aws:quicksight:us-east-1:204538904702:user/default/vikas.saroha@eyecareleaders.com'
            
            }, function(err, data) {
                if (err) reject(err); // an error occurred
                else     resolve(data);           // successful response
            });
    });
}


function getEmbedUrlParams(board) {
    return new Promise(function(resolve,reject) {
        AWS.config.update(awsCredentials);
            var quicksight = new AWS.QuickSight();
            let quickSightConfig = {
                'AwsAccountId': board.AwsAccountId, 
                'DashboardId': board.DashboardId,
                'IdentityType': 'QUICKSIGHT',
                'ResetDisabled': true,
                'SessionLifetimeInMinutes': 100,
                'UndoRedoDisabled': false,
                'UserArn': board.userARN
                };  
            quicksight.getDashboardEmbedUrl(quickSightConfig, function(err, data) {
                if (err) reject(err); // an error occurred
                else    {
                    resolve({'EmbedUrl':data.EmbedUrl, 'board': board.dashboardname}); 
                }           // successful response
            });
    });
}




app.listen(3000, () => {
    console.log(`Server is running at: 3000`);
});
