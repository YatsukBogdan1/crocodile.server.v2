const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
// $FlowFixMe
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

const DEBUG = true;
const MAX_PLAYERS_PER_TABLE = 6;
const PLAYERS_NUMBER_TO_START_GAME = 3;

let users: Array<User> = [];
let usersCounter = 0;
let tables: Array<Table> = [];
let tablesCounter = 0;

const getSystemMessageObject = (text: string): Message => ({
  userId: null,
  username: 'System',
  text,
  timestamp: Date.now()
})

const words = ["сантехник","сурдопереводчик","крупье","пожарный","дальнобойщик","психиатр","лифтер","прокурор","акушерка","скульптор","режиссер","кинолог","космонавт","инкассатор","дипломат","крановщик", "химик", "стюардесса", "мерчандайзер", "шахтер", "гинеколог", "пчеловод", "дизайнер", "электрик", "дрессировщик", "промоутер", "археолог", "ветеринар", "дровосек", "хамелеон", "ротвейлер", "краб"]

app.use(cors());
// $FlowFixMe
app.use(bodyParser());
// $FlowFixMe
app.post('/login', (req, res) => {
  const username = req.body.username;
  const socketId = req.body.socketId;

  if (!username) {
    return res.json({
      success: false,
      message: 'There is no username in request'
    });
  }

  if (!socketId) {
    return res.json({
      success: false,
      message: 'There is socketId in request'
    });
  }

  const userId = addNewUser(username, socketId);
  let tableId;
  const table = getTableWithFreeSeats();
  if (!table) {
    tableId = addNewTable();
  } else {
    tableId = table.id;
  }

  addUserToTable(userId, tableId)
  sendSystemMessageToTable(tableId, `User ${username} joined the game`);
  res.json({
    success: true,
    user: {
      id: userId,
      tableId
    }
  })
  if (table && table.userIds.length === PLAYERS_NUMBER_TO_START_GAME) startGameOnTable(tableId);
});

// $FlowFixMe
app.get('/table/:tableId/messages', (req, res) => {
  if (!req.params.tableId) {
    return res.json({
      success: false,
      message: 'There is no table id in request params'
    });
  }
  
  const tableId = Number(req.params.tableId);
  const table = getTableById(tableId);
  if (!table) {
    return res.json({
      success: false,
      message: `There is no table with id=${tableId}`
    });
  }

  res.json({
    success: true,
    payload: {
      messages: table.messages
    }
  })
})

const addUserToTable = (userId: number, tableId: number) => {
  const tableIndex = getTableIndexById(tableId);
  if (tableIndex === -1) {
    return;
  }
  tables[tableIndex].userIds.push(userId);
}

const startGameOnTable = (tableId: number, painterId?: number) => {
  const tableIndex = getTableIndexById(tableId);
  if (tableIndex === -1) return;

  const table = tables[tableIndex];
  let _painterId;
  if (painterId == null) {
    const randomIndex = getRandomInt(0, table.userIds.length - 1);
    _painterId = table.userIds[randomIndex];
  } else {
    _painterId = painterId;
  }
  
  let painter;
  tables[tableIndex].painterId = _painterId;
  const word = getRandomWord();
  tables[tableIndex].word = word;
  table.userIds.forEach((userId) => {
    const user = getUserById(userId);
    if (user) {
      if (userId === _painterId) {
        painter = user;
        io.to(user.socketId).emit('gameStarted', { isPainter: true, word });
      } else {
        io.to(user.socketId).emit('gameStarted', { isPainter: false, word: null });
      }
    }
  });
  if (painter) {
    // $FlowFixMe
    setTimeout(() => sendSystemMessageToTable(tableId, `Game started. Painter is ${painter.username}`), 1000);
  }
}

const getUserById = (id: number): ?User => users.find(user => user.id === id)
const getTableById = (id: number): ?Table => tables.find(table => table.id === id)
const getTableIndexById = (id: number): number => tables.findIndex(table => table.id === id)
const getTableWithFreeSeats = (): ?Table => tables.find(table => table.userIds.length < MAX_PLAYERS_PER_TABLE);

const addNewUser = (username: string, socketId: string) => {
  const userId = usersCounter;
  const newUser = {
    socketId,
    username,
    id: userId
  };

  users.push(newUser);
  usersCounter++;
  return userId;
}

const addNewTable = () => {
  const tableId = tablesCounter
  const newTable = {
    name: `Table#${tableId}`,
    id: tableId,
    painterId: null,
    userIds: [],
    messages: [],
    word: ''
  };
  tables.push(newTable);
  tablesCounter++;
  return tableId;
}

// Listen application request on port 3000
http.listen(3001, () => console.log('listening on *:3001'));

const logMessage = (message: string, data?: any) => {
  console.log(`\n---------------${(new Date()).toISOString()}----------------`);
  console.log(`---------------${message}----------------`);
  if (data) {
    console.log(data);
  }
}

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomWord = () => {
  const index = getRandomInt(0, words.length - 1);
  return words[index];
}

const appendMessageToTable = (tableId: number, message: Message) => {
  const tableIndex = getTableIndexById(tableId);
  if (tableIndex === -1) return;
  
  tables[tableIndex].messages.push(message);
}

const sendMessageToTable = (tableId: number, message: Message) => {
  appendMessageToTable(tableId, message);
  const table = getTableById(tableId);
  if (!table) return;

  table.userIds.forEach((userId) => {
    const user = getUserById(userId);
    if (user && user.socketId) {
      io.to(user.socketId).emit('message', message);
    }
  });

}

const getFormatedMessageFromSocket = (data: UserMessageFromSocket): ?Message => {
  const user = getUserById(data.userId);
  if (!user) return null;

  return {
    username: user.username,
    userId: user.id,
    text: data.text,
    timestamp: Date.now()
  }
}

const isMessageRightWord = (tableId: number, text: string) => {
  const table = getTableById(tableId);
  if (table == null || table.word == null) return false;

  return table.word.toLowerCase() === text.toLowerCase();
}

const finishGameOnTable = (tableId: number, winnerId: number) => {
  const tableIndex = getTableIndexById(tableId);
  if (tableIndex === -1) return;

  const table = tables[tableIndex];
  tables[tableIndex].painterId = null;
  tables[tableIndex].word = null;
  table.userIds.forEach((userId) => {
    const user = getUserById(userId);
    if (user) {
      if (userId === winnerId) {
        io.to(user.socketId).emit('gameFinished', { isWinner: true });
        const systemMessage = `Winner: ${user.username}`;
        sendSystemMessageToTable(tableId, systemMessage);
      } else {
        io.to(user.socketId).emit('gameFinished', { isWinner: false });
      }
    }
  });
  setTimeout(() => startGameOnTable(tableId, winnerId), 1000);
}

const sendSystemMessageToTable = (tableId: number, text: string) => sendMessageToTable(tableId, getSystemMessageObject(text));
const onMessageFromSocket = (data: UserMessageFromSocket) => {
  const {tableId} = data;

  const table = getTableById(tableId);
  if (!table) return;

  const message = getFormatedMessageFromSocket(data);
  if (!message) return;

  sendMessageToTable(tableId, message);
  if (isMessageRightWord(tableId, message.text) && message.userId != null) {
    finishGameOnTable(tableId, message.userId);
  }
}

const onSocketDraw = (data: DrawImageData) => {
  const table = getTableById(data.tableId);
  if (!table || table.painterId !== data.userId) return;

  table.userIds.forEach((userId) => {
    const user = getUserById(userId);
    if (user && userId !== data.userId) {
      io.to(user.socketId).emit('drawImage', {
        x: data.x,
        y: data.y,
        color: data.color,
        size: data.size,
        type: data.type
      });
    }
  });
}


io.on('connection', socket => {
  socket.on('message', onMessageFromSocket);
  socket.on('drawImage', onSocketDraw);
  socket.on('notifyUser', function(user){
    io.emit('notifyUser', user);
  });
});

const readline = require('readline');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
    process.exit();
  } else {
    switch(key.name) {
      case 't': console.log(tables); return;
      case 'u': console.log(users); return;
    }
  }
});