// ====================
// Chameleon App Client
// ====================

const socket = io();

// ---------- UI References ----------
const screenJoin = document.getElementById('screen-join');
const screenLobby = document.getElementById('screen-lobby');
const screenGame = document.getElementById('screen-game');

const nameInput = document.getElementById('nameInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomInput');

const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const playersList = document.getElementById('playersList');
const hostControls = document.getElementById('hostControls');
const startRoundBtn = document.getElementById('startRoundBtn');

const roleInfo = document.getElementById('roleInfo');
const wordInfo = document.getElementById('wordInfo');

const clueInputContainer = document.getElementById('clueInputContainer');
const clueInput = document.getElementById('clueInput');
const submitClueBtn = document.getElementById('submitClueBtn');

const clueTurnDisplay = document.getElementById('clueTurnDisplay');
const cluesArea = document.getElementById('cluesArea');
const cluesList = document.getElementById('cluesList');

const votingArea = document.getElementById('votingArea');
const voteList = document.getElementById('voteList');

const resultArea = document.getElementById('resultArea');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');

const roundNumber = document.getElementById('roundNumber');

// ---------- State ----------
let currentRoom = null;
let myId = null;
let cluesMapping = [];

// ---------- Helpers ----------
function show(screen) {
  [screenJoin, screenLobby, screenGame].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function renderPlayers(players, host) {
  playersList.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.textContent = `${p.name} — ${p.score} pts ${p.id === host ? '(host)' : ''}`;
    playersList.appendChild(div);
  });
}

// ---------- Create / Join Room ----------
createBtn.onclick = () => {
  const name = nameInput.value || 'Player';
  socket.emit('createRoom', { name }, (resp) => {
    if (resp && resp.roomCode) {
      currentRoom = resp.roomCode;
      roomCodeDisplay.textContent = currentRoom;
      show(screenLobby);
    }
  });
};

joinBtn.onclick = () => {
  const name = nameInput.value || 'Player';
  const code = (roomInput.value || '').trim().toUpperCase();
  if (!code) return alert('Enter a room code');

  socket.emit('joinRoom', { roomCode: code, name }, (resp) => {
    if (resp && resp.ok) {
      currentRoom = resp.roomCode;
      roomCodeDisplay.textContent = currentRoom;
      show(screenLobby);
    } else {
      alert(resp.error || 'Failed to join');
    }
  });
};

// ---------- Lobby ----------
socket.on('roomUpdate', (data) => {
  renderPlayers(data.players, data.host);
  hostControls.classList.toggle('hidden', data.host !== socket.id);
  if (!myId) myId = socket.id;
});

startRoundBtn.onclick = () => {
  socket.emit('startRound', { roomCode: currentRoom }, (resp) => {
    if (resp && resp.ok) {
      show(screenGame);
    }
  });
};

// ---------- Game Flow ----------
socket.on('roundStarted', ({ role, category, word, clueTurn }) => {
  show(screenGame);

  resultArea.classList.add('hidden');
  backToLobbyBtn.classList.add('hidden');
  cluesArea.classList.add('hidden');
  votingArea.classList.add('hidden');
  clueInputContainer.classList.remove('hidden');

  cluesList.innerHTML = '';
  voteList.innerHTML = '';
  cluesMapping = [];

  roleInfo.textContent = role === 'chameleon'
    ? `You are THE CHAMELEON — category: ${category}`
    : `You are a player — category: ${category}`;

  wordInfo.textContent = role === 'chameleon'
    ? 'You do NOT see the word. Try to blend in.'
    : `Secret word: ${word}`;

  clueTurnDisplay.textContent = clueTurn;
});

submitClueBtn.onclick = () => {
  const clue = (clueInput.value || '').trim();
  if (!clue) return alert('Enter a clue');

  socket.emit('submitClue', { roomCode: currentRoom, clue }, (resp) => {
    if (resp && resp.ok) {
      clueInput.value = '';
      clueInputContainer.classList.add('hidden');
    }
  });
};

socket.on('cluesUpdate', (clues) => {
  cluesArea.classList.remove('hidden');
  cluesList.innerHTML = '';
  cluesMapping = clues.map(c => c.id);

  clues.forEach(c => {
    const li = document.createElement('li');
    li.textContent = `${c.name}: ${c.clues.join(', ')}`;
    cluesList.appendChild(li);
  });
});

socket.on('clueTurnUpdate', ({ clueTurn }) => {
  clueTurnDisplay.textContent = clueTurn;
  clueInputContainer.classList.remove('hidden');
});

// ---------- Voting ----------
socket.on('votingStart', ({ clues }) => {
  votingArea.classList.remove('hidden');
  voteList.innerHTML = '';
  cluesMapping = clues.map(c => c.id);

  clues.forEach(c => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = `Vote ${c.name}`;
    btn.onclick = () => {
      socket.emit('submitVote', { roomCode: currentRoom, targetPlayerId: c.id }, (resp) => {
        if (!resp || !resp.ok) alert('Vote failed');
      });
    };
    li.appendChild(btn);
    voteList.appendChild(li);
  });
});

socket.on('votesUpdate', (votes) => {
  console.log('Votes update:', votes);
});

// ---------- Chameleon Guess ----------
socket.on('chameleonCaught', ({ suspectId, chameleonId }) => {
  resultArea.classList.remove('hidden');
  resultArea.innerHTML = `<b>Suspect chosen</b>. If correct, chameleon will guess the word.`;
});

socket.on('promptGuess', () => {
  const guess = prompt('You were caught! Guess the secret word:');
  socket.emit('chameleonGuess', { roomCode: currentRoom, guess });
});

// ---------- Round Result ----------
socket.on('roundResult', (data) => {
  resultArea.classList.remove('hidden');
  backToLobbyBtn.classList.remove('hidden');
  votingArea.classList.add('hidden');
  cluesArea.classList.add('hidden');

  if (!data.caught) {
    resultArea.innerHTML = `
      <h3>The Chameleon escaped!</h3>
      <p>Chameleon: ${data.chameleonId}</p>
      <p>Word was: <b>${data.word}</b></p>
    `;
  } else {
    const ok = data.correct ? '✔️ Chameleon guessed correctly!' : '❌ Chameleon guessed wrong.';
    resultArea.innerHTML = `
      <h3>${ok}</h3>
      <p>Chameleon: ${data.chameleonId} guessed: "${data.guess}"</p>
      <p>Word was: <b>${data.word}</b></p>
    `;
  }

  // Show scores
  const scoreList = document.createElement('div');
  scoreList.innerHTML = '<h4>Scores</h4>';
  const ul = document.createElement('ul');
  for (const [id, info] of Object.entries(data.scores || {})) {
    const li = document.createElement('li');
    li.textContent = `${info.name}: ${info.score} pts ${id === data.chameleonId ? '(chameleon)' : ''}`;
    ul.appendChild(li);
  }
  scoreList.appendChild(ul);
  resultArea.appendChild(scoreList);
});

// ---------- Back to Lobby ----------
backToLobbyBtn.onclick = () => {
  show(screenLobby);
};