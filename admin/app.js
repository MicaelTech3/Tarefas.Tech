import { db } from '../firebase-config.js';
import { ref, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ----- Constantes de role -----
const ROLE = 'admin';

// Elementos da interface
const tpl = document.getElementById('card-tpl');
const cols = {
  todo: document.getElementById('col-todo'),
  doing: document.getElementById('col-doing'),
  done: document.getElementById('col-done')
};
const counts = {
  todo: document.getElementById('c-todo'),
  doing: document.getElementById('c-doing'),
  done: document.getElementById('c-done'),
  total: document.getElementById('total')
};
const q = document.getElementById('q');
const addBtn = document.getElementById('add');
const filterBtns = [...document.querySelectorAll('[data-dept]')];

// Elementos do diálogo de tarefa
const taskDlg = document.getElementById('task-dlg');
const taskForm = document.getElementById('task-form');
const formFields = {
  id: document.getElementById('taskId'),
  title: document.getElementById('title'),
  dept: document.getElementById('dept'),
  assignees: document.getElementById('assignees'),
  dueDate: document.getElementById('dueDate'),
  dueTime: document.getElementById('dueTime'),
  status: document.getElementById('status'),
  priority: document.getElementById('priority'),
  desc: document.getElementById('desc')
};

// Elementos do chat
const chatDlg = document.getElementById('chat-dlg');
const chatMsgs = document.getElementById('msgs');
const chatInput = document.getElementById('msgText');
const sendMsgBtn = document.getElementById('sendMsg');
const chatTaskId = document.getElementById('chatTaskId');
const chatTaskTitle = document.getElementById('chatTaskTitle');

let tasks = {};
let messages = {}; // messages[taskId] = {...}
let reads = {};    // reads[taskId] = { admin: ts, user: ts }
let filterDept = 'ALL';

// ---- Realtime listeners ----
const tasksRef = ref(db, 'tasks');
onValue(tasksRef, snap => {
  tasks = snap.val() || {};
  render();
});

onValue(ref(db, 'messages'), snap => {
  messages = snap.val() || {};
  render();
});

onValue(ref(db, 'reads'), snap => {
  reads = snap.val() || {};
  render();
});

// Event Listeners
addBtn.addEventListener('click', () => openTask());
q.addEventListener('input', render);
filterBtns.forEach(b => b.addEventListener('click', () => {
  filterDept = b.dataset.dept;
  render();
}));

taskForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = collectFormData();
  if (!data.title) { alert('Informe um título'); return; }

  try {
    if (!formFields.id.value) {
      await set(push(tasksRef), withAudit(data));
    } else {
      await update(ref(db, 'tasks/' + formFields.id.value), withAudit(data));
    }
    taskDlg.close();
    taskForm.reset();
    formFields.id.value = '';
  } catch (error) {
    console.error('Erro ao salvar tarefa:', error);
    alert('Erro ao salvar tarefa');
  }
});

// Funções auxiliares
function collectFormData() {
  const assignees = (formFields.assignees.value || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    title: formFields.title.value.trim(),
    department: formFields.dept.value,
    assignees,
    dueDate: formFields.dueDate.value || null,
    dueTime: formFields.dueTime.value || null,
    status: formFields.status.value,
    priority: formFields.priority.value,
    description: formFields.desc.value.trim()
  };
}

function withAudit(data) {
  const now = Date.now();
  return { ...data, updatedAt: now, createdAt: data.createdAt || now };
}

function openTask(task = null) {
  taskForm.reset();
  formFields.id.value = '';

  if (task) {
    formFields.id.value = task.$id;
    formFields.title.value = task.title || '';
    formFields.dept.value = task.department || 'TI';
    formFields.assignees.value = (task.assignees || []).join(', ');
    formFields.dueDate.value = task.dueDate || '';
    formFields.dueTime.value = task.dueTime || '';
    formFields.status.value = task.status || 'todo';
    formFields.priority.value = task.priority || 'medium';
    formFields.desc.value = task.description || '';
  }

  taskDlg.showModal();
}

function render() {
  const term = (q.value || '').toLowerCase().trim();
  Object.values(cols).forEach(c => c.innerHTML = '');

  let total = 0;
  const byStatus = { todo: [], doing: [], done: [] };

  for (const [id, task] of Object.entries(tasks)) {
    if (filterDept !== 'ALL' && task.department !== filterDept) continue;

    const searchText = [
      task.title, task.description, task.department, ...(task.assignees || [])
    ].join(' ').toLowerCase();

    if (term && !searchText.includes(term)) continue;

    const card = {
      $id: id,
      title: task.title || '(Sem título)',
      department: task.department || 'TI',
      assignees: task.assignees || [],
      dueDate: task.dueDate || null,
      dueTime: task.dueTime || null,
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      description: task.description || ''
    };

    byStatus[card.status].push(card);
  }

  ['todo', 'doing', 'done'].forEach(status => {
    byStatus[status].sort((a, b) => ((a.dueDate||'')+(a.dueTime||'')).localeCompare((b.dueDate||'')+(b.dueTime||'')));
    counts[status].textContent = byStatus[status].length;
    total += byStatus[status].length;
    byStatus[status].forEach(task => cols[status].appendChild(buildCard(task)));
  });

  counts.total.textContent = total;
}

function unreadCount(taskId) {
  const list = Object.values(messages[taskId] || {});
  const lastRead = (reads[taskId] && reads[taskId][ROLE]) || 0;
  // Conta mensagens do outro lado após o último read
  return list.filter(m => m.userType !== ROLE && (m.ts || 0) > lastRead).length;
}

function buildCard(task) {
  const node = tpl.content.cloneNode(true);
  const card = node.querySelector('.card');

  // Título/Depto
  card.querySelector('.card-title').textContent = task.title;
  card.querySelector('[data-dept]').textContent = task.department === 'TI' ? 'T.I' : 'Manutenção';
  card.querySelector('[data-dept]').classList.add('chip');
  card.querySelector('[data-due]').textContent = formatDue(task.dueDate, task.dueTime) || 'Sem prazo';

  // Prioridade chip
  const prChip = document.createElement('span');
  prChip.className = `chip priority ${task.priority}`;
  prChip.textContent = {low:'Baixa',medium:'Média',high:'Alta',critical:'Crítica'}[task.priority];
  card.querySelector('.card-head').appendChild(prChip);

  // Responsáveis
  const assigneesWrap = card.querySelector('[data-assignees]');
  assigneesWrap.innerHTML = '';
  (task.assignees || []).forEach(a => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = a;
    assigneesWrap.appendChild(chip);
  });

  // Botões
  const unreadBadge = card.querySelector('[data-unread]');
  const chatBtn = card.querySelector('[data-chat]');
  const n = unreadCount(task.$id);
  if (n > 0) {
    unreadBadge.textContent = n;
    unreadBadge.classList.add('show');
  } else {
    unreadBadge.textContent = '0';
    unreadBadge.classList.remove('show');
  }

  card.querySelector('[data-edit]').addEventListener('click', () => openTask(task));
  card.querySelector('[data-del]').addEventListener('click', () => onDelete(task));
  card.querySelector('[data-move="left"]').addEventListener('click', () => moveLeft(task));
  card.querySelector('[data-move="right"]').addEventListener('click', () => moveRight(task));
  chatBtn.addEventListener('click', () => openChat(task.$id, task.title));

  return node;
}

async function onDelete(task) {
  if (!confirm('Excluir esta tarefa permanentemente?')) return;
  try {
    await remove(ref(db, 'tasks/' + task.$id));
    await remove(ref(db, 'messages/' + task.$id));
    await remove(ref(db, 'reads/' + task.$id));
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error);
    alert('Erro ao excluir tarefa');
  }
}

function moveLeft(task) {
  if (task.status === 'doing') setStatus(task, 'todo');
  else if (task.status === 'done') setStatus(task, 'doing');
}
function moveRight(task) {
  if (task.status === 'todo') setStatus(task, 'doing');
  else if (task.status === 'doing') setStatus(task, 'done');
}
async function setStatus(task, status) {
  try {
    await update(ref(db, 'tasks/' + task.$id), { status, updatedAt: Date.now() });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    alert('Erro ao mover tarefa');
  }
}

function openChat(taskId, title='Chat da Tarefa') {
  chatTaskId.value = taskId;
  chatTaskTitle.textContent = title;
  chatMsgs.innerHTML = '';

  // Listener das mensagens desta tarefa
  onValue(ref(db, 'messages/' + taskId), snap => {
    chatMsgs.innerHTML = '';
    const list = Object.values(snap.val() || {}).sort((a,b)=>(a.ts||0)-(b.ts||0));
    list.forEach(msg => renderMsg(msg));
    chatMsgs.scrollTop = chatMsgs.scrollHeight;

    // Marca como lido no último timestamp recebido
    const lastTs = list.length ? (list[list.length-1].ts || Date.now()) : Date.now();
    update(ref(db, 'reads/' + taskId), { [ROLE]: lastTs });
  }, { onlyOnce:false });

  chatDlg.showModal();
}

sendMsgBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  const taskId = chatTaskId.value;
  chatInput.value = '';

  try {
    await push(ref(db, 'messages/' + taskId), {
      userType: 'admin',
      senderName: 'Admin',
      text,
      ts: Date.now()
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    alert('Erro ao enviar mensagem');
  }
});

function renderMsg(msg) {
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
  chatMsgs.appendChild(wrap);
}

function formatDue(date, time) {
  if (!date && !time) return null;
  const [Y,M,D] = (date || '').split('-');
  if (!Y) return time || null;
  const [h='00',m='00'] = (time || '').split(':');
  return `${D}/${M}/${Y} ${h}:${m}`;
}
