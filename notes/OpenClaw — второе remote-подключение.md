---
title: OpenClaw / Cursor — второе удалённое подключение
created: 2026-07-31
tags:
  - openclaw
  - cursor
  - ssh
  - remote
  - how-to
source: cursor-cloud-agent
---

# OpenClaw / Cursor — второе удалённое подключение

Как добавить ещё одно remote-подключение (если уже есть `.openclaw [SSH: openclaw-server]`).

## Вариант A — второй SSH в Cursor

Для второго сервера в UI Cursor (как уже был `openclaw-server`).

1. **File → New Window** (или стартовый экран).
2. Нажать **Connect via SSH**.
3. **Add New SSH Host…**
4. Ввести, например: `ssh user@IP_ИЛИ_ДОМЕН` → Enter.
5. Выбрать файл конфига: обычно `C:\Users\gboya\.ssh\config`.
6. Добавить **второй** блок, не затирая старый:

```ssh
Host openclaw-server-2
    HostName 123.45.67.89
    User ВАШ_ЮЗЕР
    IdentityFile C:\Users\gboya\.ssh\id_ed25519
```

7. Сохранить (`Ctrl+S`).
8. Снова **Connect via SSH** → выбрать `openclaw-server-2`.
9. Открыть папку на сервере (`~/.openclaw` или проект).

В Recent появятся оба хоста.

## Вариант B — второй OpenClaw Gateway

OpenClaw по умолчанию: `127.0.0.1:18789`.  
Второе подключение = другой SSH-хост + **другой локальный порт**, чтобы не конфликтовать с первым.

### SSH config

```ssh
Host openclaw-gw-1
    HostName IP_ПЕРВОГО
    User user1
    LocalForward 18789 127.0.0.1:18789
    IdentityFile ~/.ssh/id_ed25519

Host openclaw-gw-2
    HostName IP_ВТОРОГО
    User user2
    LocalForward 18790 127.0.0.1:18789
    IdentityFile ~/.ssh/id_ed25519
```

### Туннель ко второму

```powershell
ssh -N openclaw-gw-2
```

Окно не закрывать.

### Указать второй remote в OpenClaw

```bash
openclaw config set gateway.remote.url "ws://127.0.0.1:18790"
openclaw config set gateway.remote.sshTarget "user2@IP_ВТОРОГО"
openclaw config set gateway.remote.token "ТОКЕН_ВТОРОГО_СЕРВЕРА"
```

Или в приложении: **Settings → General → Remote** → SSH target / URL → **Test remote**.

Доки: https://docs.openclaw.ai/gateway/remote

## Что выбрать

| Цель | Вариант |
| --- | --- |
| Второй сервер в Cursor (как `openclaw-server`) | A |
| Второй OpenClaw Gateway / daemon | B |

Нужны от второго сервера: IP, SSH-логин, ключ (и токен Gateway для B).

## Связанные заметки

- [[Open Design]]
- [[Open Design — как пользоваться]]
- [[Open Design — UI после запуска]]
