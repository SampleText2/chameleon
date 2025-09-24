/// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('client'));


/* ---------- WORDS: small starter packs ---------- */
/*
const WORDS = {
  Fruits: ['Apple','Mango','Kiwi','Pineapple','Strawberry','Banana'],
  Movies: ['Inception','Titanic','Avatar','Frozen','The Matrix','Jaws'],
  Animals: ['Lion','Elephant','Giraffe','Penguin','Kangaroo','Dolphin'],
  Singers: ["Beyoncé","Adele","Ed Sheeran","Taylor Swift","Bruno Mars","Lady Gaga","Justin Bieber","Rihanna","Ariana Grande",,"Michael Jackson","Billie Eilish","Elton John","Shakira","Frank Sinatra","Katy Perry","Madonna","Elvis Presley","David Bowie","Dua Lipa","Post Malone","Sam Smith","The Weeknd","Harry Styles","Selena Gomez","Drake","Jennifer Lopez","Celine Dion","Whitney Houston","Prince","Khalid","Miley Cyrus","John Lennon","Paul McCartney","Alicia Keys","Cardi B","Camila Cabello","Travis Scott","Lizzo","Nicki Minaj","Usher","Mariah Carey","Christina Aguilera","Shawn Mendes","Sia","Cher","Bob Dylan","Amy Winehouse","Stevie Wonder"],
  Celebrities: ["Kim Kardashian","Kanye West","Oprah Winfrey","Ellen DeGeneres","Dwayne Johnson","Taylor Swift","Beyoncé","Brad Pitt","Angelina Jolie","Leonardo DiCaprio","Johnny Depp","Rihanna","Justin Bieber","Ariana Grande","Will Smith","Chris Hemsworth","Chris Evans","Scarlett Johansson","Gal Gadot","Kylie Jenner","Kendall Jenner","Selena Gomez","Demi Lovato","Miley Cyrus","Robert Downey Jr.","Tom Cruise","Emma Watson","Jennifer Lawrence","Natalie Portman","Charlize Theron","Keanu Reeves","Zendaya","Harry Styles","Drake","Cardi B","Nicki Minaj","Megan Thee Stallion","Chris Pratt","Galileo Paltrow","Jason Momoa","Matt Damon","George Clooney","Hugh Jackman","Margot Robbie","Timothée Chalamet","Zendaya","Shakira","Elon Musk","Oprah Winfrey"],
  Foods: ["Pizza","Burger","Sushi","Pasta","Salad","Chocolate","Ice Cream","Steak","Sandwich","Pancakes","Tacos","Fries","Doughnut","Soup","Rice","Noodles","Cheeseburger","Hot Dog","Bagel","Omelette"]
};
*/
const WORDS = {
  Fruits: ['Apple','Mango','Kiwi','Pineapple','Strawberry','Banana', 'Lemon', 'Lime'],
  Movies: ['Lion King','Titanic','Mean Girls','Frozen','Brokeback Mountian','KPop Demon Hunters', 'Legally Blonde'],
  Animals: ['Lion','Elephant','Giraffe','Penguin','Kangaroo','Dolphin', 'Zebra'],
  Singers: ["Beyoncé","Adele","Ed Sheeran","Taylor Swift","Bruno Mars","Lady Gaga","Justin Bieber","Rihanna","Ariana Grande","Michael Jackson","Billie Eilish","Elton John","Shakira","Frank Sinatra","Katy Perry","Madonna","Elvis Presley","David Bowie","Dua Lipa","Post Malone","The Weeknd","Harry Styles","Selena Gomez","Drake","Celine Dion","Whitney Houston","Prince","Khalid","Miley Cyrus","John Lennon","Paul McCartney","Alicia Keys","Cardi B","Camila Cabello","Travis Scott","Lizzo","Nicki Minaj","Usher","Mariah Carey","Christina Aguilera","Shawn Mendes","Sia","Bob Dylan","Amy Winehouse","Stevie Wonder"],
  Celebrities: ["Kim Kardashian","Kanye West","Oprah Winfrey","Ellen DeGeneres","Dwayne Johnson","Taylor Swift","Beyoncé","Brad Pitt","Angelina Jolie","Leonardo DiCaprio","Johnny Depp","Rihanna","Justin Bieber","Ariana Grande","Will Smith","Scarlett Johansson","Kylie Jenner","Kendall Jenner","Selena Gomez","Demi Lovato","Miley Cyrus","Robert Downey Jr.","Tom Cruise","Emma Watson","Keanu Reeves","Zendaya","Harry Styles","Drake","Cardi B","Nicki Minaj","Megan Thee Stallion","Chris Pratt","Jason Momoa","Margot Robbie","Timothée Chalamet","Zendaya","Shakira","Elon Musk","Oprah Winfrey"],
  Foods: ["Pizza","Burger","Sushi","Pasta","Salad","Chocolate","Ice Cream","Steak","Sandwich","Pancakes","Tacos","Fries","Donut","Soup","Rice","Noodles","Cheeseburger","Hot Dog","Bagel","Omelette"]
  

};
const chameleonRooms = {}; // roomCode -> room state

function generateRoomCode() {
  let code;
  do { code = Math.random().toString(36).slice(2,6).toUpperCase(); } while (chameleonRooms[code]);
  return code;
}

function pickCategoryAndWord() {
  const categories = Object.keys(WORDS);
  const category = categories[Math.floor(Math.random()*categories.length)];
  const word = WORDS[category][Math.floor(Math.random()*WORDS[category].length)];
  return { category, word };
}

function getRoomPublic(room) {
  return {
    players: Object.values(room.players).map(p => ({ id: p.id, name: p.name, score: p.score })),
    host: room.host,
    state: room.state,
    round: room.round,
    category: room.category || null,
    clueTurn: room.clueTurn || 0
  };
}

function getCluesPublic(room) {
  const out = [];
  for (const p of Object.values(room.players)) {
    out.push({ id: p.id, name: p.name, clues: p.clues });
  }
  return out;
}

function getScores(room) {
  const out = {};
  for (const p of Object.values(room.players)) out[p.id] = { name: p.name, score: p.score };
  return out;
}

io.on('connection', (socket) => {
  console.log('Socket connected', socket.id);

  /* ---------- Chameleon Handlers ---------- */
  socket.on('createRoom', ({ name }, cb) => {
    const roomCode = generateRoomCode();
    chameleonRooms[roomCode] = { players: {}, host: socket.id, state: 'lobby', round: 0, clueTurn: 1 };
    socket.join(roomCode);
    chameleonRooms[roomCode].players[socket.id] = { id: socket.id, name: name || 'Player', score: 0, clues: [], votedFor: null };
    cb({ ok:true, roomCode });
    io.to(roomCode).emit('roomUpdate', getRoomPublic(chameleonRooms[roomCode]));
  });

  socket.on('joinRoom', ({ roomCode, name }, cb) => {
    const room = chameleonRooms[roomCode];
    if (!room) return cb({ ok:false, error:'Room not found' });
    socket.join(roomCode);
    room.players[socket.id] = { id: socket.id, name: name || 'Player', score: 0, clues: [], votedFor: null };
    cb({ ok:true, roomCode });
    io.to(roomCode).emit('roomUpdate', getRoomPublic(room));
  });

  socket.on('startRound', ({ roomCode }, cb) => {
    const room = chameleonRooms[roomCode];
    if (!room) return;
    const playerIds = Object.keys(room.players);
    if (playerIds.length < 3) return cb({ ok:false, error:'Need at least 3 players' });
    const { category, word } = pickCategoryAndWord();
    const chameleonId = playerIds[Math.floor(Math.random()*playerIds.length)];
    room.category = category;
    room.word = word;
    room.chameleonId = chameleonId;
    room.state = 'clues';
    room.round = (room.round || 0) + 1;
    room.clueTurn = 1;
    for (const p of Object.values(room.players)) { p.clues = []; p.votedFor = null; }

    for (const pid of playerIds) {
      if (pid === chameleonId) io.to(pid).emit('roundStarted', { role: 'chameleon', category, clueTurn:1 });
      else io.to(pid).emit('roundStarted', { role: 'player', category, word, clueTurn:1 });
    }
    io.to(roomCode).emit('roomUpdate', getRoomPublic(room));
    if (cb) cb({ ok: true });
  });

  socket.on('submitClue', ({ roomCode, clue }, cb) => {
    const room = chameleonRooms[roomCode];
    if (!room || room.state !== 'clues') return cb({ ok:false });
    const player = room.players[socket.id];
    if (!player) return cb({ ok:false });

    clue = String(clue || '').trim().slice(0,30);
    player.clues.push(clue || '(no clue)');

    const playerIds = Object.keys(room.players);
    const allSubmittedThisRound = playerIds.every(pid => room.players[pid].clues.length >= room.clueTurn);

    if (allSubmittedThisRound) {
      room.clueTurn += 1;
      room.currentTurnPlayer = playerIds[0];
    } else {
      let currentIndex = playerIds.indexOf(room.currentTurnPlayer);
      let nextIndex = (currentIndex + 1) % playerIds.length;
      while (room.players[playerIds[nextIndex]].clues.length >= room.clueTurn) {
        nextIndex = (nextIndex + 1) % playerIds.length;
      }
      room.currentTurnPlayer = playerIds[nextIndex];
    }

    io.to(roomCode).emit('cluesUpdate', getCluesPublic(room));
    io.to(roomCode).emit('clueTurnUpdate', {
      clueTurn: room.clueTurn,
      currentPlayerId: room.currentTurnPlayer
    });

    const allDone = Object.values(room.players).every(p => p.clues.length >= 3);
    if (allDone) {
      room.state = 'voting';
      io.to(roomCode).emit('votingStart', { clues: getCluesPublic(room) });
    }

    if (cb) cb({ ok: true });
  });

  socket.on('submitVote', ({ roomCode, targetPlayerId }, cb) => {
    const room = chameleonRooms[roomCode];
    if (!room || room.state !== 'voting') return cb({ ok:false });
    const player = room.players[socket.id];
    if (!player) return cb({ ok:false });
    player.votedFor = targetPlayerId;

    const allVoted = Object.values(room.players).every(p => p.votedFor !== null);
    io.to(roomCode).emit('votesUpdate', Object.values(room.players).map(p => ({ id:p.id, votedFor:p.votedFor })));

    if (allVoted) {
      const counts = {};
      for (const p of Object.values(room.players)) counts[p.votedFor] = (counts[p.votedFor]||0)+1;
      let suspectId=null,max=-1;
      for (const [id,c] of Object.entries(counts)) if(c>max){max=c;suspectId=id;}
      const caught = suspectId === room.chameleonId;
      if (caught) {
        room.state = 'guess';
        io.to(roomCode).emit('chameleonCaught', { suspectId, chameleonId: room.chameleonId });
        io.to(room.chameleonId).emit('promptGuess',{});
      } else {
        room.state = 'reveal';
        room.players[room.chameleonId].score += 2;
        io.to(roomCode).emit('roundResult',{ caught:false, chameleonId:room.chameleonId, word: room.word, scores:getScores(room) });
      }
    }
    if (cb) cb({ ok: true });
  });

  socket.on('chameleonGuess', ({ roomCode, guess }, cb) => {
    const room = chameleonRooms[roomCode];
    if (!room || room.state !== 'guess') return cb({ ok:false });
    const correct = String(guess||'').trim().toLowerCase() === String(room.word).toLowerCase();
    if (correct) room.players[room.chameleonId].score += 3;
    else {
      for(const pid of Object.keys(room.players)) if(pid!==room.chameleonId) room.players[pid].score += 1;
    }
    room.state='reveal';
    io.to(roomCode).emit('roundResult',{ caught:true, correct, guess, chameleonId:room.chameleonId, word: room.word, scores:getScores(room) });
    if (cb) cb({ ok: true });
  });

  /* ---------- Disconnect ---------- */
  socket.on('disconnect', () => {
    for (const [code, room] of Object.entries(chameleonRooms)) {
      if(room.players[socket.id]){
        delete room.players[socket.id];
        io.to(code).emit('roomUpdate', getRoomPublic(room));
        if(room.host===socket.id){
          const ids=Object.keys(room.players);
          room.host=ids[0]||null;
          io.to(code).emit('hostChanged', room.host);
        }
        if(Object.keys(room.players).length===0) delete chameleonRooms[code];
      }
    }
  });
});


/* ================================
   Mafia Game (separate namespace)
================================= */
const mafiaIO = io.of('/mafia');
const mafiaRooms = {}; // roomCode -> mafia state

function generateMafiaRoomCode() {
  let code;
  do { code = Math.random().toString(36).slice(2,6).toUpperCase(); } while (mafiaRooms[code]);
  return code;
}

function getMafiaRoomPublic(room) {
  return {
    players: Object.values(room.players).map(p => ({ id:p.id, name:p.name, role:p.role, alive:p.alive })),
    host: room.host,
    state: room.state
  };
}

mafiaIO.on('connection', (socket) => {
  console.log('Mafia socket connected', socket.id);

  socket.on('createRoom', ({ name }, cb) => {
    const roomCode = generateMafiaRoomCode();
    mafiaRooms[roomCode] = { players: {}, host: socket.id, state:'lobby', round:0 };
    socket.join(roomCode);
    mafiaRooms[roomCode].players[socket.id] = { id: socket.id, name: name||'Player', role:null, alive:true, votedFor:null };
    cb({ ok:true, roomCode });
    mafiaIO.to(roomCode).emit('roomUpdate', getMafiaRoomPublic(mafiaRooms[roomCode]));
  });

  socket.on('joinRoom', ({ roomCode, name }, cb) => {
    const room = mafiaRooms[roomCode];
    if(!room) return cb({ ok:false, error:'Room not found' });
    socket.join(roomCode);
    room.players[socket.id] = { id: socket.id, name: name||'Player', role:null, alive:true, votedFor:null };
    cb({ ok:true, roomCode });
    mafiaIO.to(roomCode).emit('roomUpdate', getMafiaRoomPublic(room));
  });

  socket.on('startGame', ({ roomCode }, cb) => {
    const room = mafiaRooms[roomCode];
    if(!room) return;
    const ids = Object.keys(room.players);
    if(ids.length < 4) return cb({ ok:false, error:'Need at least 4 players' });

    // Assign roles: 1 Mafia, rest civilians
    const mafiaIndex = Math.floor(Math.random()*ids.length);
    ids.forEach((id,i)=>{
      const role = i===mafiaIndex ? 'mafia' : 'civilian';
      room.players[id].role = role;
      mafiaIO.to(id).emit('roleAssigned', role);
    });

    room.state = 'night';
    room.round = 1;
    mafiaIO.to(roomCode).emit('gameStarted', { round: room.round });
    if(cb) cb({ ok:true });
  });

  // Night vote by mafia
  socket.on('nightKill', ({ roomCode, targetId }, cb) => {
    const room = mafiaRooms[roomCode];
    if(!room || room.state!=='night') return cb({ ok:false });
    const mafia = Object.values(room.players).find(p=>p.role==='mafia');
    if(socket.id!==mafia.id) return cb({ ok:false, error:'Only mafia can kill' });
    if(!room.players[targetId] || !room.players[targetId].alive) return cb({ ok:false, error:'Target invalid' });
    room.players[targetId].alive = false;
    room.state='day';
    mafiaIO.to(roomCode).emit('nightResult', { killedId: targetId });
    mafiaIO.to(roomCode).emit('updatePlayers', getMafiaRoomPublic(room));
    if(cb) cb({ ok:true });
  });

  // Day vote
  socket.on('dayVote', ({ roomCode, targetId }, cb) => {
    const room = mafiaRooms[roomCode];
    if(!room || room.state!=='day') return cb({ ok:false });
    const player = room.players[socket.id];
    if(!player || !player.alive) return cb({ ok:false });

    player.votedFor = targetId;

    const allAlive = Object.values(room.players).filter(p=>p.alive);
    const allVoted = allAlive.every(p=>p.votedFor!==null);
    mafiaIO.to(roomCode).emit('votesUpdate', Object.values(room.players).map(p=>({id:p.id, votedFor:p.votedFor})));

    if(allVoted){
      const counts = {};
      allAlive.forEach(p=>{ counts[p.votedFor]=(counts[p.votedFor]||0)+1; });
      let max=0, lynched=null;
      for(const [id,c] of Object.entries(counts)) if(c>max){max=c; lynched=id;}
      if(lynched) room.players[lynched].alive=false;

      // Reset votes
      allAlive.forEach(p=>p.votedFor=null);

      // Check win condition
      const mafiaAlive = Object.values(room.players).some(p=>p.alive && p.role==='mafia');
      const civiliansAlive = Object.values(room.players).some(p=>p.alive && p.role==='civilian');
      let winner=null;
      if(!mafiaAlive) winner='Civilians';
      else if(mafiaAlive && !civiliansAlive) winner='Mafia';

      if(winner){
        room.state='ended';
        mafiaIO.to(roomCode).emit('gameEnded', { winner });
      }else{
        room.state='night';
        room.round+=1;
        mafiaIO.to(roomCode).emit('newRound', { round: room.round });
      }
    }

    if(cb) cb({ ok:true });
  });

  socket.on('disconnect', () => {
    for(const [code, room] of Object.entries(mafiaRooms)){
      if(room.players[socket.id]){
        delete room.players[socket.id];
        mafiaIO.to(code).emit('roomUpdate', getMafiaRoomPublic(room));
        if(room.host===socket.id){
          const ids = Object.keys(room.players);
          room.host = ids[0]||null;
          mafiaIO.to(code).emit('hostChanged', room.host);
        }
        if(Object.keys(room.players).length===0) delete mafiaRooms[code];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`));