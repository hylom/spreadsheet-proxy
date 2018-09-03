const fs = require('fs');
const {google} = require('googleapis');

const SCOPES = [ 'https://www.googleapis.com/auth/spreadsheets' ];
const TOKEN_PATH = 'token.json';
const REFRESH_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';

exports.requestAuth = function requestAuth(req, res) {
  _getAuthClient().then(
    (authClient) => { // succeed
      const authUrl = authClient.generateAuthUrl(
        { scope: SCOPES, access_type: 'offline' });
      res.statusCode = 302;
      res.setHeader('Location', authUrl);
      res.end('ok');
    },
    (err) => { //failed
      res.statusCode = 500;
      console.log(err);
      res.end('Internal Server Error');
    }
  );
};

exports.acceptAuthCallback = function acceptAuthCallback(req, res) {
  const code = req.url.searchParams.get('code');
  _getAuthClient().then(
    (authClient) => {
      return authClient.getToken(code).then(
        (tokens) => {
          authClient.setCredentials(tokens);
          console.log(tokens);
          return fs.promises.writeFile(TOKEN_PATH,
                                       JSON.stringify({ tokens: tokens.tokens }));
        }
      );
    }
  ).then(
    () => { // all works succeed
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: 'authorize succeed' }));
    }
  ).catch(
    (err) => {
      res.statusCode = 500;
      console.log(err);
      res.end('Internal Server Error');
    }
  );
};



async function _getAuthClient() {
  const cred_json = await fs.promises.readFile(CREDENTIALS_PATH);
  const credentials = JSON.parse(cred_json);
  const {client_secret, client_id, redirect_uris} = credentials.web;

  const authClient = new google.auth.OAuth2(client_id,
                                            client_secret,
                                            redirect_uris[0]);
  authClient.on('tokens', (tokens) => {
    fs.promises.writeFile(TOKEN_PATH,
                          JSON.stringify(tokens));
  });
  return authClient;
}

exports.getAuthClient = async function getAuthClient() {
  const auth = await _getAuthClient();
  const token = await fs.promises.readFile(TOKEN_PATH);
  auth.setCredentials(JSON.parse(token).tokens);
  return auth;
};

