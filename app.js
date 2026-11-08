(() => {
  "use strict";

  const STORAGE_KEY = "todo-tasks-v1";
  const THEME_KEY = "todo-theme";

  const form = document.getElementById("addForm");
  const input = document.getElementById("taskInput");
  const list = document.getElementById("taskList");
  const template = document.getElementById("taskTemplate");
  const emptyState = document.getElementById("emptyState");
  const emptyTitle = document.getElementById("emptyTitle");
  const emptyText = document.getElementById("emptyText");
  const counter = document.getElementById("counter");
  const subtitle = document.getElementById("subtitle");
  const clearCompletedButton = document.getElementById("clearCompleted");
  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const themeToggle = document.getElementById("themeToggle");

  /** @type {{ id: string, text: string, completed: boolean }[]} */
  let tasks = loadTasks();
  let filter = "all";

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((task) => task && typeof task.text === "string")
        .map((task) => ({
          id: String(task.id ?? crypto.randomUUID()),
          text: task.text,
          completed: Boolean(task.completed),
        }));
    } catch (error) {
      console.warn("Не удалось загрузить задачи:", error);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.warn("Не удалось сохранить задачи:", error);
    }
  }

  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function pluralizeTasks(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "задача";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "задачи";
    return "задач";
  }

  function visibleTasks() {
    if (filter === "active") return tasks.filter((task) => !task.completed);
    if (filter === "completed") return tasks.filter((task) => task.completed);
    return tasks;
  }

  function render() {
    const items = visibleTasks();
    list.replaceChildren();

    items.forEach((task) => {
      const node = template.content.firstElementChild.cloneNode(true);
      const checkbox = node.querySelector(".task__checkbox");
      const text = node.querySelector(".task__text");
      const deleteButton = node.querySelector(".task__delete");

      node.dataset.id = task.id;
      node.classList.toggle("is-completed", task.completed);
      checkbox.checked = task.completed;
      checkbox.setAttribute("aria-label", task.completed ? `Отметить «${task.text}» как активную` : `Отметить «${task.text}» как выполненную`);
      text.textContent = task.text;

      checkbox.addEventListener("change", () => toggleTask(task.id));
      deleteButton.addEventListener("click", () => removeTask(task.id, node));

      list.appendChild(node);
    });

    updateEmptyState(items.length);
    updateSummary();
  }

  function updateEmptyState(visibleCount) {
    const isEmpty = visibleCount === 0;
    emptyState.hidden = !isEmpty;
    if (!isEmpty) return;

    if (tasks.length === 0) {
      emptyTitle.textContent = "Пока пусто";
      emptyText.textContent = "Добавьте первую задачу — и она появится здесь.";
    } else if (filter === "active") {
      emptyTitle.textContent = "Все задачи выполнены";
      emptyText.textContent = "Отличная работа! Активных задач не осталось.";
    } else {
      emptyTitle.textContent = "Нет выполненных задач";
      emptyText.textContent = "Отметьте задачу галочкой, чтобы она оказалась здесь.";
    }
  }

  function updateSummary() {
    const total = tasks.length;
    const done = tasks.filter((task) => task.completed).length;
    const left = total - done;

    counter.textContent = `${total} ${pluralizeTasks(total)} · выполнено ${done}`;
    clearCompletedButton.disabled = done === 0;

    if (total === 0) {
      subtitle.textContent = "Всё под контролем";
    } else if (left === 0) {
      subtitle.textContent = "Все задачи выполнены 🎉";
    } else {
      subtitle.textContent = `Осталось: ${left}`;
    }
  }

  function addTask(text) {
    tasks.unshift({ id: createId(), text, completed: false });
    saveTasks();
    if (filter === "completed") setFilter("all");
    else render();
  }

  function toggleTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    render();
  }

  function removeTask(id, node) {
    node.classList.add("is-removing");
    const finish = () => {
      tasks = tasks.filter((task) => task.id !== id);
      saveTasks();
      render();
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
    } else {
      setTimeout(finish, 180);
    }
  }

  function setFilter(nextFilter) {
    filter = nextFilter;
    filterButtons.forEach((button) => {
      const isActive = button.dataset.filter === filter;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    render();
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.querySelector(".theme-toggle__icon").textContent = theme === "dark" ? "☀️" : "🌙";
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему");
  }

  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch (error) {
      console.warn("Не удалось прочитать тему:", error);
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }
    addTask(text);
    form.reset();
    input.focus();
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => setFilter(button.dataset.filter));
  });

  clearCompletedButton.addEventListener("click", () => {
    if (!tasks.some((task) => task.completed)) return;
    tasks = tasks.filter((task) => !task.completed);
    saveTasks();
    render();
  });

  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      console.warn("Не удалось сохранить тему:", error);
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    tasks = loadTasks();
    render();
  });

  initTheme();
  setFilter("all");
  input.focus();
})();
