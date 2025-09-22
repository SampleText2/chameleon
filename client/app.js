// client/app.js
const socket = io();

// UI refs
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
const cluesArea = document.getElementById('cluesArea');
const cluesList = document.getElementById('cluesList');
const votingArea = document.getElementById('votingArea');
const voteList = document.getElementById('voteList');
const resultArea = document.getElementById('resultArea');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');
const roundNumber = document.getElementById('roundNumber');

let currentRoom = null;
let myId = null;
let cluesMapping = []; // index -> playerId

/* ---------- Helpers ---------- */
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

/* ---------- Create / Join ---------- */
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

/* ---------- Lobby events ---------- */
socket.on('roomUpdate', (data) => {
  // data: { players: [{id,name,score}], host, state, round }
  renderPlayers(data.players, data.host);
  roomCodeDisplay.textContent = currentRoom || roomCodeDisplay.textContent;
  // show host start button if I'm host
  if (!myId) myId = socket.id;
  hostControls.classList.toggle('hidden', data.host !== socket.id);
  // show simple lobby info
});

startRoundBtn.onclick = () => {
  socket.emit('startRound', { roomCode: currentRoom }, (resp) => {
    if (resp && resp.ok) {
      show(screenGame);
      roundNumber.textContent = "…";
      // UI will update from 'roundStarted'
    } else {
      alert(resp.error || 'Could not start');
    }
  });
};

/* ---------- Round flow ---------- */
socket.on('roundStarted', ({ role, category, word }) => {
  show(screenGame);
  resultArea.classList.add('hidden'); backToLobbyBtn.classList.add('hidden');
  cluesArea.classList.add('hidden'); votingArea.classList.add('hidden');
  clueInputContainer.classList.remove('hidden');
  cluesList.innerHTML = ''; voteList.innerHTML = '';
  cluesMapping = [];

  roleInfo.textContent = role === 'chameleon' ? `You are THE CHAMELEON — category: ${category}` : `You are a player — category: ${category}`;
  if (role === 'chameleon') {
    wordInfo.textContent = 'You do NOT see the word. Try to blend in.';
  } else {
    wordInfo.textContent = `Secret word: ${word}`;
  }
});

submitClueBtn.onclick = () => {
  const clue = (clueInput.value || '').trim();
  if (!clue) return alert('Enter a clue');
  socket.emit('submitClue', { roomCode: currentRoom, clue }, (resp) => {
    if (resp && resp.ok) {
      clueInput.value = '';
      clueInputContainer.classList.add('hidden'); // one clue per round
    }
  });
};

socket.on('cluesUpdate', (clues) => {
  // clues: [{index, clue, playerId}]
  cluesArea.classList.remove('hidden');
  cluesList.innerHTML = '';
  cluesMapping = clues.map(c => c.playerId);
  clues.forEach(c => {
    const li = document.createElement('li');
    li.textContent = `${c.index}. ${c.clue || '(no clue submitted)'}`;
    cluesList.appendChild(li);
  });
});

socket.on('votingStart', ({ clues }) => {
  // show voting UI with clue indices; clicking an index votes for that player's id
  votingArea.classList.remove('hidden');
  voteList.innerHTML = '';
  cluesMapping = clues.map(c => c.playerId);
  clues.forEach(c => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = `${c.index}. Vote this clue`;
    btn.onclick = () => {
      const targetId = c.playerId;
      socket.emit('submitVote', { roomCode: currentRoom, targetPlayerId: targetId }, (resp) => {
        if (!resp || !resp.ok) alert('Vote failed');
      });
    };
    li.appendChild(btn);
    const span = document.createElement('span');
    span.textContent = ' ' + (c.clue || '(no clue)');
    li.appendChild(span);
    voteList.appendChild(li);
  });
});

socket.on('votesUpdate', (votes) => {
  // optional: could show counts or feedback; for prototype we keep simple
  console.log('votesUpdate', votes);
});

socket.on('chameleonCaught', ({ suspectId, chameleonId }) => {
  // show who was pointed to as suspect, and prompt chameleon to guess (chameleon gets special socket prompt)
  resultArea.classList.remove('hidden');
  resultArea.innerHTML = `<b>Suspect chosen</b>. If the suspect was the chameleon they will get to guess the word.`;
});

socket.on('promptGuess', () => {
  // only chameleon receives this
  const guess = prompt('You were caught! Try to guess the secret word:');
  socket.emit('chameleonGuess', { roomCode: currentRoom, guess }, (resp) => {
    // wait for roundResult
  });
});

socket.on('roundResult', (data) => {
  // data: { caught, correct?, guess, chameleonId, word, scores }
  resultArea.classList.remove('hidden');
  backToLobbyBtn.classList.remove('hidden');
  votingArea.classList.add('hidden'); cluesArea.classList.add('hidden');

  if (!data.caught) {
    resultArea.innerHTML = `<h3>The Chameleon escaped!</h3><p>Chameleon: ${data.chameleonId}</p><p>Word was: <b>${data.word}</b></p>`;
  } else {
    const ok = data.correct ? '✔️ Chameleon guessed correctly!' : '❌ Chameleon guessed wrong.';
    resultArea.innerHTML = `<h3>${ok}</h3><p>Chameleon: ${data.chameleonId} guessed: "${data.guess}"</p><p>Word was: <b>${data.word}</b></p>`;
  }
  // show scoreboard
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

backToLobbyBtn.onclick = () => {
  show(screenLobby);
};

