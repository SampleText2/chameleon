// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static client files from /client
app.use(express.static('client'));

/* ---------- WORDS: small starter packs ---------- */
const WORDS = {
  Fruits: ['Apple','Mango','Kiwi','Pineapple','Strawberry','Banana'],
  Movies: ['Inception','Titanic','Avatar','Frozen','The Matrix','Jaws'],
  Animals: ['Lion','Elephant','Giraffe','Penguin','Kangaroo','Dolphin'],
  Singers: ["Beyoncé","Adele","Ed Sheeran","Taylor Swift","Bruno Mars","Lady Gaga","Justin Bieber","Rihanna","Ariana Grande",,"Michael Jackson","Billie Eilish","Elton John","Shakira","Frank Sinatra","Katy Perry","Madonna","Elvis Presley","David Bowie","Dua Lipa","Post Malone","Sam Smith","The Weeknd","Harry Styles","Selena Gomez","Drake","Jennifer Lopez","Celine Dion","Whitney Houston","Prince","Khalid","Miley Cyrus","John Lennon","Paul McCartney","Alicia Keys","Cardi B","Camila Cabello","Travis Scott","Lizzo","Nicki Minaj","Usher","Mariah Carey","Christina Aguilera","Shawn Mendes","Sia","Cher","Bob Dylan","Amy Winehouse","Stevie Wonder"],
  Celebrities: ["Kim Kardashian","Kanye West","Oprah Winfrey","Ellen DeGeneres","Dwayne Johnson","Taylor Swift","Beyoncé","Brad Pitt","Angelina Jolie","Leonardo DiCaprio","Johnny Depp","Rihanna","Justin Bieber","Ariana Grande","Will Smith","Chris Hemsworth","Chris Evans","Scarlett Johansson","Gal Gadot","Kylie Jenner","Kendall Jenner","Selena Gomez","Demi Lovato","Miley Cyrus","Robert Downey Jr.","Tom Cruise","Emma Watson","Jennifer Lawrence","Natalie Portman","Charlize Theron","Keanu Reeves","Zendaya","Harry Styles","Drake","Cardi B","Nicki Minaj","Megan Thee Stallion","Chris Pratt","Galileo Paltrow","Jason Momoa","Matt Damon","George Clooney","Hugh Jackman","Margot Robbie","Timothée Chalamet","Zendaya","Shakira","Elon Musk","Oprah Winfrey"],
  Foods: ["Pizza","Burger","Sushi","Pasta","Salad","Chocolate","Ice Cream","Steak","Sandwich","Pancakes","Tacos","Fries","Doughnut","Soup","Rice","Noodles","Cheeseburger","Hot Dog","Bagel","Omelette"]
};

/* ---------- In-memory rooms ---------- */
const rooms = {}; // { ROOMCODE: { players: {socketId: {id,name,score,clue,votedFor}}, host, state, category, word, chameleonId, round } }

/* ---------- Helpers ---------- */
function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).slice(2,6).toUpperCase();
  } while (rooms[code]);
  return code;
}

function pickCategoryAndWord() {
  const cats = Object.keys(WORDS);
  const category = cats[Math.floor(Math.random()*cats.length)];
  const words = WORDS[category];
  const word = words[Math.floor(Math.random()*words.length)];
  return { category, word };
}

function getRoomPublic(room) {
  return {
    players: Object.values(room.players).map(p => ({ id: p.id, name: p.name, score: p.score })),
    host: room.host,
    state: room.state,
    round: room.round,
    category: room.category || null
  };
}

function getCluesPublic(room) {
  // return anonymized list with index + clue and mapping to real player id (kept intentionally)
  return Object.values(room.players).map((p, i) => ({ index: i+1, clue: p.clue, playerId: p.id }));
}

function getScores(room) {
  const out = {};
  for (const p of Object.values(room.players)) out[p.id] = { name: p.name, score: p.score };
  return out;
}

/* ---------- Socket.IO game logic ---------- */
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('createRoom', ({ name }, cb) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = { players: {}, host: socket.id, state: 'lobby', round: 0 };
    socket.join(roomCode);
    rooms[roomCode].players[socket.id] = { id: socket.id, name: name || 'Player', score: 0, clue: null, votedFor: null };
    cb && cb({ ok: true, roomCode });
    io.to(roomCode).emit('roomUpdate', getRoomPublic(rooms[roomCode]));
  });

  socket.on('joinRoom', ({ roomCode, name }, cb) => {
    const room = rooms[roomCode];
    if (!room) return cb && cb({ ok: false, error: 'Room not found' });
    socket.join(roomCode);
    room.players[socket.id] = { id: socket.id, name: name || 'Player', score: 0, clue: null, votedFor: null };
    cb && cb({ ok: true, roomCode });
    io.to(roomCode).emit('roomUpdate', getRoomPublic(room));
  });

  socket.on('startRound', ({ roomCode }, cb) => {
    const room = rooms[roomCode];
    if (!room) return;
    const playerIds = Object.keys(room.players);
    if (playerIds.length < 3) {
      return cb && cb({ ok: false, error: 'Need at least 3 players' });
    }
    const { category, word } = pickCategoryAndWord();
    const chameleonId = playerIds[Math.floor(Math.random()*playerIds.length)];
    room.category = category;
    room.word = word;
    room.chameleonId = chameleonId;
    room.state = 'clue';
    room.round = (room.round || 0) + 1;
    // reset per-player fields
    for (const p of Object.values(room.players)) { p.clue = null; p.votedFor = null; }
    // send each player their view
    for (const pid of playerIds) {
      if (pid === chameleonId) io.to(pid).emit('roundStarted', { role: 'chameleon', category });
      else io.to(pid).emit('roundStarted', { role: 'player', category, word });
    }
    io.to(roomCode).emit('roomUpdate', getRoomPublic(room));
    cb && cb({ ok: true });
  });

  socket.on('submitClue', ({ roomCode, clue }, cb) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'clue') return cb && cb({ ok: false });
    if (!room.players[socket.id]) return cb && cb({ ok: false });
    clue = String(clue || '').trim().slice(0, 30);
    room.players[socket.id].clue = clue || '(no clue)';
    io.to(roomCode).emit('cluesUpdate', getCluesPublic(room));
    // if all clues submitted -> go to voting
    const all = Object.values(room.players).every(p => p.clue !== null);
    if (all) {
      room.state = 'voting';
      io.to(roomCode).emit('votingStart', { clues: getCluesPublic(room) });
    }
    cb && cb({ ok: true });
  });

  socket.on('submitVote', ({ roomCode, targetPlayerId }, cb) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'voting') return cb && cb({ ok: false });
    if (!room.players[socket.id]) return cb && cb({ ok: false });
    room.players[socket.id].votedFor = targetPlayerId;
    io.to(roomCode).emit('votesUpdate', Object.values(room.players).map(p => ({ id: p.id, votedFor: p.votedFor })));
    // if all votes in -> tally
    const all = Object.values(room.players).every(p => p.votedFor !== null);
    if (all) {
      const counts = {};
      for (const p of Object.values(room.players)) {
        counts[p.votedFor] = (counts[p.votedFor] || 0) + 1;
      }
      // pick highest voted id (if tie, choose one of them arbitrarily — you can improve later)
      let suspectId = null, max = -1;
      for (const [id, c] of Object.entries(counts)) if (c > max) { max = c; suspectId = id; }
      const caught = suspectId === room.chameleonId;
      if (caught) {
        room.state = 'guess';
        io.to(roomCode).emit('chameleonCaught', { suspectId, chameleonId: room.chameleonId });
        io.to(room.chameleonId).emit('promptGuess', {});
      } else {
        room.state = 'reveal';
        // chameleon wins the round
        room.players[room.chameleonId].score += 2;
        io.to(roomCode).emit('roundResult', { caught: false, chameleonId: room.chameleonId, word: room.word, scores: getScores(room) });
      }
    }
    cb && cb({ ok: true });
  });

  socket.on('chameleonGuess', ({ roomCode, guess }, cb) => {
    const room = rooms[roomCode];
    if (!room || room.state !== 'guess') return cb && cb({ ok: false });
    const correct = String(guess || '').trim().toLowerCase() === String(room.word).toLowerCase();
    if (correct) {
      room.players[room.chameleonId].score += 3;
    } else {
      for (const pid of Object.keys(room.players)) {
        if (pid !== room.chameleonId) room.players[pid].score += 1;
      }
    }
    room.state = 'reveal';
    io.to(roomCode).emit('roundResult', { caught: true, correct, guess, chameleonId: room.chameleonId, word: room.word, scores: getScores(room) });
    cb && cb({ ok: true });
  });

  socket.on('disconnect', () => {
    // remove socket from any room
    for (const [code, room] of Object.entries(rooms)) {
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(code).emit('roomUpdate', getRoomPublic(room));
        // pick new host if needed
        if (room.host === socket.id) {
          const ids = Object.keys(room.players);
          room.host = ids[0] || null;
          io.to(code).emit('hostChanged', room.host);
        }
        if (Object.keys(room.players).length === 0) delete rooms[code];
      }
    }
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
