# Tarefas Multi – Admin + Usuário (T.I / Manutenção)

Dois painéis (admin e user) com **Kanban**, **chat por tarefa** e **filtro por departamento** usando **Firebase Realtime Database**.

## Pastas
- `admin/` – cria tarefas, filtra por departamento, conversa com usuários.
- `user/` – usuário escolhe departamento (T.I ou Manutenção), muda status e conversa com admin.

## Banco (Realtime Database)
- `/tasks/{taskId}` – dados da tarefa (`department: "TI"|"MANUT"`, `status: "todo"|"doing"|"done"`...)
- `/messages/{taskId}/{msgId}` – mensagens do chat (`userType: "admin"|"user"`, `senderName`, `text`, `ts`).

## Como rodar
Abra `admin/index.html` ou `user/index.html` com um servidor local (ex.: Live Server). O projeto faz **login anônimo** automaticamente.
# Tarefas.Tech
