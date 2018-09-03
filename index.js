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
    if (req.method == 'GET') {
      return authClient.requestAuth(req, res);
    } else {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return;
    }
  }

  if (req.url.pathname == '/oauth2callback') {
    if (req.method == 'GET') {
      return authClient.acceptAuthCallback(req, res);
    } else {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return;
    }
  }

  for (var key in config) {
    if (req.url.pathname == `/${key}`) {
      if (req.method == 'GET') {
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
      } else if (req.method == 'POST') {
        // read request body
        let rawData = '';
        req.on('data', (chunk) => { rawData += chunk; });
        req.on('end', () => {
          const sheetId = config[key].sheetId;
          const range = config[key].range;
          const values = JSON.parse(data);
          pushValuesToSheet(sheetId, range, values)
            .then((resp) => {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(resp));
            })
            .catch((err) => {
              res.statusCode = 500;
              console.log(err);
              res.end('Internal Server Error');
            });
        });
        req.on('error', (err) => {
          res.statusCode = 500;
          console.log(err);
          res.end('Internal Server Error');
        });
        return;
      }
      else {
        res.statusCode = 405;
        res.end("Method Not Allowed");
        return;
      }
    }
  }
  
  // default handler
  res.statusCode = 404;
  res.end("Not Found");
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

async function pushValuesToSheet(sheetId, range, values) {
  const auth = await authClient.getAuthClient();
  const resp = await appendToSheet(auth, sheetId, range, values);
  return resp;
}

function appendToSheet(auth, sheetId, range, values) {
  return new Promise((resolve, reject) => {
    const sheets = google.sheets({version: 'v4', auth});
    const request = {
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: "RAW",
      resource: {
        range: range,
        majorDimension: "ROWS",
        values: values
      }
    };
    sheets.spreadsheets.values.append(request, (err, res) => {
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
