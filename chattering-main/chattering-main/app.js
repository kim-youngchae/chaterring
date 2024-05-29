'use strict';

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const bodyParser = require('body-parser');
const sharedSession = require('express-socket.io-session');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const sessionMiddleware = session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
});

/* Configuration */
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public')); // public 디렉터리의 정적 파일 제공
app.set('port', 3000);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(sessionMiddleware);

if (process.env.NODE_ENV === 'development') {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}

/* Routes */
app.get('/signup', (req, res) => {
  res.sendFile(__dirname + '/public/signup.html');
});

app.post('/signup', (req, res) => {
  const username = req.body.username;
  if (username) {
    if (!req.session.users) {
      req.session.users = [];
    }
    const userExists = req.session.users.find(user => user.username === username);
    if (userExists) {
      res.send('<script>alert("이미 가입되어 있습니다."); window.location.href="/signup";</script>');
    } else {
      req.session.users.push({ username: username });
      res.send('<script>alert("가입되었습니다."); window.location.href="/login";</script>');
    }
  } else {
    res.redirect('/signup');
  }
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

app.post('/login', (req, res) => {
  const username = req.body.username;
  if (username) {
    if (req.session.users && req.session.users.find(user => user.username === username)) {
      req.session.username = username;
      res.redirect('/chat');
    } else {
      res.send('<script>alert("회원가입되지 않은 사용자입니다."); window.location.href="/login";</script>');
    }
  } else {
    res.redirect('/login');
  }
});

app.get('/chat', (req, res) => {
  if (!req.session.username) {
    res.redirect('/login');
  } else {
    res.sendFile(__dirname + '/public/index.html');
  }
});

/* Socket.io Communication */
io.use(sharedSession(sessionMiddleware, {
  autoSave: true
}));

// In-memory storage for rooms
const rooms = new Set();

function checkRoomExists(roomName) {
  return rooms.has(roomName);
}

function createNewRoom(roomName) {
  rooms.add(roomName);
}

io.on('connection', (socket) => {
  const username = socket.handshake.session.username;
  if (username) {
    socket.emit('init', { users: [username], name: username });
  }

  socket.on('send:message', (message) => {
    io.emit('send:message', message);
  });

  socket.on('change:name', ({ name }, callback) => {
    const oldName = socket.handshake.session.username;
    socket.handshake.session.username = name;
    socket.handshake.session.save();
    callback(true);
    io.emit('change:name', { oldName, newName: name });
  });

  socket.on('create:room', ({ roomName }, callback) => {
    const roomExists = checkRoomExists(roomName);
    if (!roomExists) {
      createNewRoom(roomName);
      callback(true);
      socket.emit('room:created', { roomName });
    } else {
      callback(false);
    }
  });
});

/* Start the server */
server.listen(app.get('port'), () => {
  console.log('Express server listening on port ' + app.get('port'));
});