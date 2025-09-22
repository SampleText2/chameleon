const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // serves index.html, app.js, styles.css

// -----------------
// Game State
// -----------------
const rooms = {};

// Helper: pick random element
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}


/* ---------- WORDS: small starter packs ---------- */
const WORDS = {
  Fruits: ['Apple','Mango','Kiwi','Pineapple','Strawberry','Banana'],
  Movies: ['Inception','Titanic','Avatar','Frozen','The Matrix','Jaws'],
  Animals: ['Lion','Elephant','Giraffe','Penguin','Kangaroo','Dolphin'],
  Singers: ["Beyoncé","Adele","Ed Sheeran","Taylor Swift","Bruno Mars","Lady Gaga","Justin Bieber","Rihanna","Ariana Grande",,"Michael Jackson","Billie Eilish","Elton John","Shakira","Frank Sinatra","Katy Perry","Madonna","Elvis Presley","David Bowie","Dua Lipa","Post Malone","Sam Smith","The Weeknd","Harry Styles","Selena Gomez","Drake","Jennifer Lopez","Celine Dion","Whitney Houston","Prince","Khalid","Miley Cyrus","John Lennon","Paul McCartney","Alicia Keys","Cardi B","Camila Cabello","Travis Scott","Lizzo","Nicki Minaj","Usher","Mariah Carey","Christina Aguilera","Shawn Mendes","Sia","Cher","Bob Dylan","Amy Winehouse","Stevie Wonder"],
  Celebrities: ["Kim Kardashian","Kanye West","Oprah Winfrey","Ellen DeGeneres","Dwayne Johnson","Taylor Swift","Beyoncé","Brad Pitt","Angelina Jolie","Leonardo DiCaprio","Johnny Depp","Rihanna","Justin Bieber","Ariana Grande","Will Smith","Chris Hemsworth","Chris Evans","Scarlett Johansson","Gal Gadot","Kylie Jenner","Kendall Jenner","Selena Gomez","Demi Lovato","Miley Cyrus","Robert Downey Jr.","Tom Cruise","Emma Watson","Jennifer Lawrence","Natalie Portman","Charlize Theron","Keanu Reeves","Zendaya","Harry Styles","Drake","Cardi B","Nicki Minaj","Megan Thee Stallion","Chris Pratt","Galileo Paltrow","Jason Momoa","Matt Damon","George Clooney","Hugh Jackman","Margot Robbie","Timothée Chalamet","Zendaya","Shakira","Elon Musk","Oprah Winfrey"],
  Foods: ["Pizza","Burger","Sushi","Pasta","Salad","Chocolate","Ice Cream","Steak","Sandwich","Pancakes","Tacos","Fries","Doughnut","Soup","Rice","Noodles","Cheeseburger","Hot Dog","Bagel","Omelette"]
};


// -----------------
// Socket Handling
// -----------------
io.on('connection', (socket) => {
  console.log('Player connected', socket.id);

  // Create room
  socket.on('createRoom', ({ name }, callback) => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    rooms[roomCode] = {
      host: socket.id,
      players: [],
      word: null,
      category: null,
      chameleon: null,
      clues: {},
      votes: {},
      clueTurn: 1,
      submittedThisTurn: new Set(),
    };

    socket.join(roomCode);

    const player = { id: socket.id, name, clues: [], score: 0 };
    rooms[roomCode].players.push(player);

    callback({ roomCode });
    io.to(roomCode).emit('roomUpdate', rooms[roomCode]);
  });

  // Join room
  socket.on('joinRoom', ({ roomCode, name }, callback) => {
    const room = rooms[roomCode];
    if (!room) return callback({ ok: false, error: 'Room not found' });

    socket.join(roomCode);
    const player = { id: socket.id, name, clues: [], score: 0 };
    room.players.push(player);

    callback({ ok: true, roomCode });
    io.to(roomCode).emit('roomUpdate', room);
  });

  // Start round
  socket.on('startRound', ({ roomCode }, callback) => {
    const room = rooms[roomCode];
    if (!room) return;

    const category = pick(Object.keys(categories));
    const word = pick(categories[category]);

    room.category = category;
    room.word = word;
    room.clueTurn = 1;
    room.submittedThisTurn = new Set();

    room.players.forEach(p => (p.clues = []));
    const cham = pick(room.players);
    room.chameleon = cham.id;

    // Tell each player their role
    room.players.forEach((p) => {
      io.to(p.id).emit('roundStarted', {
        role: p.id === room.chameleon ? 'chameleon' : 'player',
        category,
        word: p.id === room.chameleon ? null : word,
        clueTurn: room.clueTurn,
      });
    });

    callback({ ok: true });
  });

  // Submit clue
  socket.on('submitClue', ({ roomCode, clue }, callback) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Enforce max 3 clues
    if (player.clues.length >= 3) {
      return callback({ ok: false, error: 'Max 3 clues already given' });
    }

    // Prevent duplicate submission in same turn
    if (room.submittedThisTurn.has(socket.id)) {
      return callback({ ok: false, error: 'Already gave a clue this turn' });
    }

    // Save clue
    player.clues.push(clue);
    room.submittedThisTurn.add(socket.id);

    // Broadcast updated clues to players who already submitted
    room.players.forEach(p => {
      if (room.submittedThisTurn.has(p.id)) {
        io.to(p.id).emit('cluesUpdate', room.players.map(pl => ({
          id: pl.id,
          name: pl.name,
          clues: pl.clues
        })));
      }
    });

    // If all players gave clue → next turn
    if (room.submittedThisTurn.size === room.players.length) {
      room.submittedThisTurn.clear();
      room.clueTurn++;

      if (room.clueTurn > 3) {
        // All 3 turns done → voting
        io.to(roomCode).emit('votingStart', {
          clues: room.players.map(p => ({
            id: p.id,
            name: p.name,
            clues: p.clues
          }))
        });
        return;
      }

      io.to(roomCode).emit('clueTurnUpdate', { clueTurn: room.clueTurn });
    }

    callback({ ok: true });
  });

  // Submit vote
  socket.on('submitVote', ({ roomCode, targetPlayerId }, callback) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.votes[socket.id] = targetPlayerId;
    io.to(roomCode).emit('votesUpdate', room.votes);

    if (Object.keys(room.votes).length === room.players.length) {
      const tally = {};
      for (const v of Object.values(room.votes)) {
        tally[v] = (tally[v] || 0) + 1;
      }
      const suspectId = Object.keys(tally).reduce((a, b) =>
        tally[a] > tally[b] ? a : b
      );

      io.to(roomCode).emit('chameleonCaught', {
        suspectId,
        chameleonId: room.chameleon
      });

      if (suspectId === room.chameleon) {
        io.to(room.chameleon).emit('promptGuess');
      } else {
        io.to(roomCode).emit('roundResult', {
          caught: false,
          chameleonId: room.chameleon,
          word: room.word,
        });
      }
    }

    callback({ ok: true });
  });

  // Chameleon guess
  socket.on('chameleonGuess', ({ roomCode, guess }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const correct = guess.toLowerCase() === room.word.toLowerCase();
    io.to(roomCode).emit('roundResult', {
      caught: true,
      chameleonId: room.chameleon,
      guess,
      correct,
      word: room.word,
    });
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected', socket.id);
    for (const code in rooms) {
      const room = rooms[code];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) delete rooms[code];
      else io.to(code).emit('roomUpdate', room);
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});