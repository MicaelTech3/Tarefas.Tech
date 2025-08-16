import { db, onAuthReady } from "../firebase-config.js";
import { ref, onValue, set, push, off, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const ROLE = 'user';

let tasks = {};
let messages = {};
let reads = {};
let unsubMsgs = null;

// Elements
const cols = {
  todo: document.getElementById('col-todo'),
  doing: document.getElementById('col-doing'),
  done: document.getElementById('col-done')
};
const counts = {
  todo: document.getElementById('c-todo'),
  doing: document.getElementById('c-doing'),
  done: document.getElementById('c-done')
};

onAuthReady(() => {
  const tasksRef = ref(db, 'tasks');
  onValue(tasksRef, (snap) => {
    tasks = snap.val() || {};
    render();
  });

  onValue(ref(db, 'messages'), (snap) => {
    messages = snap.val() || {};
    render();
  });

  onValue(ref(db, 'reads'), (snap) => {
    reads = snap.val() || {};
    render();
  });
});

// senha para voltar aos departamentos
document.addEventListener('click', (e) => {
  const a = e.target.closest('.back-btn');
  if (!a) return;
  const pass = prompt('Informe a senha para voltar aos departamentos:');
  if (pass !== '8989') {
    e.preventDefault();
    alert('Senha incorreta.');
  }
});

function render() {
  const colsArr = Object.values(cols);
  colsArr.forEach(col => col.innerHTML = '');
  Object.values(counts).forEach(c => c.textContent = '0');

  const filterDept = window.FILTER_DEPT; // "TI" ou "MANUT"

  Object.entries(tasks).forEach(([id, task]) => {
    if (task.department !== filterDept) return;

    const tpl = document.getElementById('card-tpl');
    const node = tpl.content.cloneNode(true);
    const card = node.querySelector('.card');

    card.querySelector('.card-title').textContent = task.title || 'Sem título';
    card.querySelector('[data-dept]').textContent = task.department === 'TI' ? 'T.I' : 'Manutenção';
    card.querySelector('[data-due]').textContent = formatDue(task.dueDate, task.dueTime) || 'Sem prazo';

    // Prioridade chip
    const prChip = document.createElement('span');
    prChip.className = `chip priority ${task.priority || 'medium'}`;
    prChip.textContent = {low:'Baixa',medium:'Média',high:'Alta',critical:'Crítica'}[task.priority || 'medium'];
    card.querySelector('.card-head').appendChild(prChip);

    // Responsáveis
    const assWrap = card.querySelector('[data-assignees]');
    assWrap.innerHTML = '';
    (task.assignees || []).forEach(name => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = name;
      assWrap.appendChild(chip);
    });

    // Navegação entre colunas (somente status no DB)
    card.querySelector('[data-move="left"]').addEventListener('click', () => moveTask(id, 'left'));
    card.querySelector('[data-move="right"]').addEventListener('click', () => moveTask(id, 'right'));

    // Chat
    const chatBtn = card.querySelector('[data-chat]');
    const unreadBadge = card.querySelector('[data-unread]');
    const n = unreadCount(id);
    if (n > 0) {
      unreadBadge.textContent = n;
      unreadBadge.classList.add('show');
    } else {
      unreadBadge.textContent = '0';
      unreadBadge.classList.remove('show');
    }
    chatBtn.addEventListener('click', () => openChat(id, task.title || 'Chat da Tarefa'));

    // Coluna
    const status = task.status || 'todo';
    cols[status].appendChild(node);
    counts[status].textContent = String(parseInt(counts[status].textContent) + 1);
  });
}

function unreadCount(taskId) {
  const list = Object.values(messages[taskId] || {});
  const lastRead = (reads[taskId] && reads[taskId][ROLE]) || 0;
  return list.filter(m => m.userType !== ROLE && (m.ts || 0) > lastRead).length;
}

async function moveTask(taskId, direction) {
  const task = tasks[taskId];
  if (!task) return;
  const order = ['todo','doing','done'];
  let i = order.indexOf(task.status || 'todo');
  if (direction === 'left' && i>0) i--;
  if (direction === 'right' && i<order.length-1) i++;
  const newStatus = order[i];
  try {
    await set(ref(db, `tasks/${taskId}/status`), newStatus);
    await set(ref(db, `tasks/${taskId}/updatedAt`), Date.now());
  } catch (err) {
    console.error('Erro ao mover tarefa:', err);
  }
}

// ---- Chat ----
const dlg = document.getElementById('chat-dlg');
const msgs = document.getElementById('msgs');
const input = document.getElementById('msgText');
const sendBtn = document.getElementById('sendMsg');
const taskIdInput = document.getElementById('chatTaskId');
const chatTaskTitle = document.getElementById('chatTaskTitle');

function openChat(taskId, title) {
  taskIdInput.value = taskId;
  chatTaskTitle.textContent = title;
  msgs.innerHTML = '';
  dlg.showModal();

  if (unsubMsgs) off(unsubMsgs);

  const messagesRef = ref(db, `messages/${taskId}`);
  unsubMsgs = onValue(messagesRef, snap => {
    msgs.innerHTML = '';
    const list = Object.values(snap.val() || {}).sort((a,b)=>(a.ts||0)-(b.ts||0));
    list.forEach(msg => renderMsg(msg, msgs));
    msgs.scrollTop = msgs.scrollHeight;

    const lastTs = list.length ? (list[list.length-1].ts || Date.now()) : Date.now();
    update(ref(db, 'reads/' + taskId), { [ROLE]: lastTs });
  });

  // Envio
  sendBtn.onclick = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    try {
      await push(ref(db, `messages/${taskId}`), {
        userType: 'user',
        senderName: 'Usuário',
        text,
        ts: Date.now()
      });
      input.value = '';
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };
}

function renderMsg(msg, container) {
  const wrap = document.createElement('div');
  wrap.className = 'msg' + (msg.userType === ROLE ? ' you' : '');
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msg.text;
  const time = document.createElement('div');
  time.className = 'meta-time';
  time.textContent = new Date(msg.ts || Date.now()).toLocaleString();
  wrap.appendChild(bubble);
  wrap.appendChild(time);
  container.appendChild(wrap);
}

function formatDue(date, time) {
  if (!date && !time) return null;
  const [Y,M,D] = (date || '').split('-');
  if (!Y) return time || null;
  const [h='00',m='00'] = (time || '').split(':');
  return `${D}/${M}/${Y} ${h}:${m}`;
}
