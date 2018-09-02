const http = require('http');
const fs = require('fs');
const {google} = require('googleapis');
const authClient = require('./auth-client');

const config = JSON.parse(fs.readFileSync("config.json"));

const server = http.createServer((req, res) => {
  res.on('close', () => {
    console.log(`${new Date().toUTCString()} - ${req.method} ${req.url} : ${res.statusCode}`);
  });

  req.url = new URL(req.url, 'http://localhost:8000/');

  if (req.url.pathname == '/admin/oauth2request') {
    return authClient.requestAuth(req, res);
  }

  if (req.url.pathname == '/oauth2callback') {
    return authClient.acceptAuthCallback(req, res);
  }

  for (var key in config) {
    console.log(key);
    if (req.url.pathname == `/${key}`) {
      const sheetId = config[key].sheetId;
      const range = config[key].range;
      readSheet(sheetId, range)
        .then((rows) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(rows));
        })
        .catch((err) => {
          res.statusCode = 500;
          console.log(err);
          res.end('Internal Server Error');
        });
      return;
    }
  }
  
  // default handler
  res.statusCode = 400;
  res.end("Bad Request");
});


async function readSheet(sheetId, range) {
  const auth = await authClient.getAuthClient();
  const sheet = await getSheet(auth, sheetId, range);
  const rows = sheet.values;
  return rows;
}

function getSheet(auth, sheetId, range) {
  return new Promise((resolve, reject) => {
    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    }, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res.data);
      }
    });
  });
}
                    

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

console.log('start http server at localhost:8000...');
console.log('OAuth2 auth URL: http://localhost:8000/admin/oauth2request');
server.listen(8000);
