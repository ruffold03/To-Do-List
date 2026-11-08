# Список задач (To-Do List)

Простой и быстрый список задач на чистом HTML, CSS и JavaScript. Без сборки и зависимостей.

## Возможности

- ✅ Добавление задач
- ✅ Отметка выполненных задач
- ✅ Удаление задач
- ✅ Сохранение задач в `localStorage` — данные не пропадают после обновления страницы
- 🔎 Фильтры: все / активные / выполненные
- 🧹 Очистка выполненных задач
- 🌙 Тёмная и светлая тема (запоминается)
- 📱 Адаптивный дизайн

## Запуск локально

Откройте `index.html` в браузере или запустите простой сервер:

```bash
npx serve .
```

## Публикация на GitHub

```bash
git init
git add .
git commit -m "Initial commit: To-Do List"
git branch -M main
git remote add origin https://github.com/ruffold03/To-Do-List.git
git push -u origin main
```

## Деплой на Vercel

1. Зайдите на [vercel.com](https://vercel.com) и нажмите **Add New → Project**.
2. Импортируйте репозиторий `ruffold03/To-Do-List`.
3. Framework Preset: **Other**. Build Command и Output Directory оставьте пустыми.
4. Нажмите **Deploy** — сайт будет доступен по адресу вида `to-do-list.vercel.app`.

Альтернатива через CLI:

```bash
npm i -g vercel
vercel
```

## Структура

```
index.html   — разметка
styles.css   — стили
app.js       — логика и работа с localStorage
```
