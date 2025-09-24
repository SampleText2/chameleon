const socket = io('/mafia-io');

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
const startGameBtn = document.getElementById('startGameBtn');

const roleInfo = document.getElementById('roleInfo');
const gameInfo = document.getElementById('gameInfo');
const actionArea = document.getElementById('actionArea');
const targetInput = document.getElementById('targetInput');
const submitActionBtn = document.getElementById('submitActionBtn');

const votesArea = document.getElementById('votesArea');
const voteList = document.getElementById('voteList');
const resultArea = document.getElementById('resultArea');
const backToLobbyBtn = document.getElementById('backToLobbyBtn');

let currentRoom = null;
let myId = null;
let myRole = null;

function show(screen){
  [screenJoin, screenLobby, screenGame].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function renderPlayers(players, host){
  playersList.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.textContent = `${p.name} — ${p.id === host ? '(host)' : ''}`;
    playersList.appendChild(div);
  });
}

// Join/create room
createBtn.onclick = () => {
  const name = nameInput.value || 'Player';
  socket.emit('createRoom', { name }, resp => {
    if(resp && resp.roomCode){
      currentRoom = resp.roomCode;
      roomCodeDisplay.textContent = currentRoom;
      show(screenLobby);
    }
  });
};

joinBtn.onclick = () => {
  const name = nameInput.value || 'Player';
  const code = (roomInput.value || '').trim().toUpperCase();
  if(!code) return alert('Enter a room code');
  socket.emit('joinRoom', { roomCode: code, name }, resp => {
    if(resp && resp.ok){
      currentRoom = resp.roomCode;
      roomCodeDisplay.textContent = currentRoom;
      show(screenLobby);
    } else alert(resp.error || 'Failed to join');
  });
};

// Lobby
socket.on('roomUpdate', data => {
  renderPlayers(data.players, data.host);
  hostControls.classList.toggle('hidden', data.host !== socket.id);
  if(!myId) myId = socket.id;
});

startGameBtn.onclick = () => {
  socket.emit('startGame', { roomCode: currentRoom });
};

// Game flow
socket.on('gameStarted', ({ role, roles, players }) => {
  myRole = role;
  roleInfo.textContent = role;
  gameInfo.innerHTML = `<p>Players: ${players.map(p=>p.name).join(', ')}</p>`;
  show(screenGame);

  if(role === 'Mafia'){
    actionArea.classList.remove('hidden');
    submitActionBtn.onclick = () => {
      const target = targetInput.value.trim();
      if(!target) return alert('Enter a target');
      socket.emit('mafiaAction', { roomCode: currentRoom, target });
      actionArea.classList.add('hidden');
    };
  } else {
    actionArea.classList.add('hidden');
  }
});

// Night result
socket.on('nightResult', ({ killed, messages }) => {
  gameInfo.innerHTML += `<p>${messages.join('<br>')}</p>`;
  if(myRole !== 'Mafia') actionArea.classList.add('hidden');

  // Voting phase
  votesArea.classList.remove('hidden');
  voteList.innerHTML = '';
  messages.forEach(p => {
    const btn = document.createElement('button');
    btn.textContent = `Vote ${p}`;
    btn.onclick = () => {
      socket.emit('vote', { roomCode: currentRoom, target: p });
      votesArea.classList.add('hidden');
    };
    voteList.appendChild(btn);
  });
});

// Voting result
socket.on('voteResult', ({ executed, messages }) => {
  resultArea.classList.remove('hidden');
  resultArea.innerHTML = `<h3>Executed: ${executed}</h3><p>${messages.join('<br>')}</p>`;
  backToLobbyBtn.classList.remove('hidden');
});

backToLobbyBtn.onclick = () => show(screenLobby);
