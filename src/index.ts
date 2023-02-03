const fs = require('fs').promises;
const path = require('path');
const proc = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google, gmail_v1 } = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(proc.cwd(), '/src/token.json');
const CREDENTIALS_PATH = path.join(proc.cwd(), '/src/credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function getStarredMessages(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const messagesList = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['STARRED'],
    maxResults: 5,
  });
  return messagesList;
}

async function getMessageIds(messages) {
  return messages.data.messages.map((value) => value.id);
}

async function readMessageById(messageId) {
  return google.gmail.users.messages.get({
    userId: 'me',
    id: messageId,
  });
}

async function getMessageSubjectById(message) {
  return message.data.payload.headers.find((a) => a.name === 'Subject').value;
}

authorize().then((res) =>
  getStarredMessages(res)
    .then((messages) => messages.map(readMessageById))
    .then((message) => message.map(getMessageSubjectById))
    .catch((error) => console.log(error))
);
