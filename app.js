(() => {
  "use strict";

  /* ============================================================
     Константы и утилиты
     ============================================================ */

  const STORAGE_KEY = "todo-tasks-v1"; // тот же ключ, что и в прежней версии
  const MAX_TITLE = 200;

  const MONTHS_NOM = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  const MONTHS_GEN = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const WEEKDAYS_FULL = [
    "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье",
  ];

  const pad2 = (value) => String(value).padStart(2, "0");

  // Локальная дата в формате YYYY-MM-DD (без сдвига часового пояса)
  const dateKey = (date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  const parseDateKey = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const isValidDateKey = (key) =>
    typeof key === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(key) &&
    !Number.isNaN(parseDateKey(key).getTime());

  const todayKey = () => dateKey(new Date());

  const addDays = (date, amount) => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  };

  // Понедельник — первый день недели
  const startOfWeek = (date) => {
    const next = new Date(date);
    const offset = (next.getDay() + 6) % 7;
    next.setDate(next.getDate() - offset);
    next.setHours(0, 0, 0, 0);
    return next;
  };

  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  const plural = (count, one, few, many) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  };

  const pluralTasks = (count) => plural(count, "задача", "задачи", "задач");
  const pluralDays = (count) => plural(count, "день", "дня", "дней");

  const formatDayTitle = (key) => {
    const date = parseDateKey(key);
    return `${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`;
  };

  const relativeDayLabel = (key) => {
    const today = todayKey();
    if (key === today) return "Сегодня";
    if (key === dateKey(addDays(new Date(), 1))) return "Завтра";
    if (key === dateKey(addDays(new Date(), -1))) return "Вчера";
    const date = parseDateKey(key);
    return capitalize(WEEKDAYS_FULL[(date.getDay() + 6) % 7]);
  };

  const formatRange = (start, end) => {
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${MONTHS_GEN[start.getMonth()]}`;
    }
    return `${start.getDate()} ${MONTHS_GEN[start.getMonth()]} — ${end.getDate()} ${MONTHS_GEN[end.getMonth()]}`;
  };

  const formatTodayLabel = () => {
    const date = new Date();
    return `${capitalize(WEEKDAYS_FULL[(date.getDay() + 6) % 7])}, ${date.getDate()} ${MONTHS_GEN[date.getMonth()]}`;
  };

  const createId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  /* ============================================================
     DOM-элементы
     ============================================================ */

  const form = document.getElementById("addForm");
  const input = document.getElementById("taskInput");
  const dateInput = document.getElementById("taskDate");
  const list = document.getElementById("taskList");
  const template = document.getElementById("taskTemplate");
  const emptyState = document.getElementById("emptyState");
  const emptyTitle = document.getElementById("emptyTitle");
  const emptyText = document.getElementById("emptyText");
  const clearCompletedButton = document.getElementById("clearCompleted");

  const dayEyebrow = document.getElementById("dayEyebrow");
  const dayTitle = document.getElementById("dayTitle");
  const dayCount = document.getElementById("dayCount");
  const todayLabel = document.getElementById("todayLabel");

  const progressLabel = document.getElementById("progressLabel");
  const progressPercent = document.getElementById("progressPercent");
  const progressTrack = document.getElementById("progressTrack");
  const progressBar = document.getElementById("progressBar");

  const calendarTitle = document.getElementById("calendarTitle");
  const calendarGrid = document.getElementById("calendarGrid");
  const prevMonthButton = document.getElementById("prevMonth");
  const nextMonthButton = document.getElementById("nextMonth");
  const todayButton = document.getElementById("todayBtn");

  const tasksView = document.getElementById("tasksView");
  const statsView = document.getElementById("statsView");
  const statsRangeLabel = document.getElementById("statsRange");
  const statPercent = document.getElementById("statPercent");
  const statTotal = document.getElementById("statTotal");
  const statDone = document.getElementById("statDone");
  const statStreak = document.getElementById("statStreak");
  const statStreakHint = document.getElementById("statStreakHint");
  const statsEmpty = document.getElementById("statsEmpty");
  const chart = document.getElementById("chart");

  const viewButtons = Array.from(document.querySelectorAll("[data-view]"));
  const filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  const rangeButtons = Array.from(document.querySelectorAll("[data-range]"));

  /* ============================================================
     Состояние приложения
     ============================================================ */

  let tasks = loadTasks();
  let selectedDate = todayKey();
  let calendarYear = parseDateKey(selectedDate).getFullYear();
  let calendarMonth = parseDateKey(selectedDate).getMonth();
  let filter = "all";
  let statsRange = "week";
  let dragState = null;

  /* ============================================================
     Хранилище и миграция данных
     ============================================================ */

  function persist(nextTasks = tasks) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
    } catch (error) {
      console.warn("Не удалось сохранить задачи:", error);
    }
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      let changed = false;
      const normalized = [];

      for (const item of parsed) {
        if (!item || typeof item !== "object") {
          changed = true;
          continue;
        }

        // Совместимость: раньше поле называлось text, но поддерживаем и title
        const rawText =
          typeof item.text === "string"
            ? item.text
            : typeof item.title === "string"
              ? item.title
              : "";
        const text = rawText.trim();

        if (!text) {
          changed = true;
          continue;
        }

        // Старые задачи без даты аккуратно переносим на сегодня
        let date = item.date;
        if (!isValidDateKey(date)) {
          date = todayKey();
          changed = true;
        }

        let id = item.id != null ? String(item.id) : "";
        if (!id) {
          id = createId();
          changed = true;
        }

        if (text !== item.text || typeof item.completed !== "boolean") {
          changed = true;
        }

        normalized.push({
          id,
          text,
          completed: Boolean(item.completed),
          date,
        });
      }

      if (changed) persist(normalized);
      return normalized;
    } catch (error) {
      console.warn("Не удалось загрузить задачи:", error);
      return [];
    }
  }

  /* ============================================================
     Работа с задачами
     ============================================================ */

  const tasksForDay = (key) => tasks.filter((task) => task.date === key);

  function renderAll() {
    renderDayHead();
    renderTasks();
    renderCalendar();
    if (!statsView.hidden) renderStats();
  }

  function renderDayHead() {
    const total = tasksForDay(selectedDate).length;

    dayEyebrow.textContent = relativeDayLabel(selectedDate);
    dayTitle.textContent = formatDayTitle(selectedDate);
    dayCount.textContent = total === 0 ? "Нет задач" : `${total} ${pluralTasks(total)}`;
  }

  function renderTasks() {
    const dayTasks = tasksForDay(selectedDate);
    const visible = dayTasks.filter((task) => {
      if (filter === "active") return !task.completed;
      if (filter === "completed") return task.completed;
      return true;
    });

    const fragment = document.createDocumentFragment();
    visible.forEach((task) => fragment.append(createTaskNode(task)));
    list.replaceChildren(fragment);

    updateProgress();
    updateEmptyState(dayTasks, visible);
  }

  function createTaskNode(task) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.classList.toggle("is-completed", task.completed);

    const checkbox = node.querySelector(".task__checkbox");
    checkbox.checked = task.completed;
    updateCheckboxLabel(checkbox, task);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const text = node.querySelector(".task__text");
    text.textContent = task.text;
    text.title = "Двойной клик для редактирования";
    text.tabIndex = 0;
    bindTextEditing(text, task.id);

    node.querySelector(".task__delete").addEventListener("click", () => removeTask(task.id, node));
    setupDrag(node, task.id);

    return node;
  }

  function updateCheckboxLabel(checkbox, task) {
    const action = task.completed ? "Вернуть в работу" : "Отметить выполненной";
    checkbox.setAttribute("aria-label", `${action}: ${task.text}`);
  }

  function addTask(text, date) {
    tasks.unshift({
      id: createId(),
      text: text.slice(0, MAX_TITLE),
      completed: false,
      date,
    });
    persist();
  }

  function toggleTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    task.completed = !task.completed;
    persist();

    // Обновляем карточку на месте, чтобы сохранить анимацию чекбокса
    const node = Array.from(list.children).find((element) => element.dataset.id === id);
    if (node) {
      node.classList.toggle("is-completed", task.completed);
      const checkbox = node.querySelector(".task__checkbox");
      if (checkbox) {
        checkbox.checked = task.completed;
        updateCheckboxLabel(checkbox, task);
      }
    }

    updateProgress();
    renderCalendar();
    if (!statsView.hidden) renderStats();

    // При активном фильтре задача должна исчезнуть из списка — даём анимации доиграть
    if (filter !== "all") {
      window.setTimeout(() => {
        if (!dragState) renderTasks();
      }, 220);
    }
  }

  function removeTask(id, node) {
    const finish = () => {
      tasks = tasks.filter((task) => task.id !== id);
      persist();
      renderAll();
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }

    node.classList.add("is-removing");
    window.setTimeout(finish, 180);
  }

  function updateProgress() {
    const dayTasks = tasksForDay(selectedDate);
    const total = dayTasks.length;
    const done = dayTasks.filter((task) => task.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    progressLabel.textContent = `${done} из ${total} выполнено`;
    progressPercent.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;
    progressTrack.setAttribute("aria-valuenow", String(percent));

    clearCompletedButton.disabled = done === 0;
  }

  function updateEmptyState(dayTasks, visible) {
    const isEmpty = visible.length === 0;
    emptyState.hidden = !isEmpty;
    if (!isEmpty) return;

    if (dayTasks.length === 0) {
      emptyTitle.textContent = "На этот день задач нет";
      emptyText.textContent =
        "Добавьте первую задачу — или выберите другую дату в календаре.";
    } else if (filter === "active") {
      emptyTitle.textContent = "Всё выполнено";
      emptyText.textContent = "На этот день не осталось активных задач.";
    } else {
      emptyTitle.textContent = "Нет выполненных задач";
      emptyText.textContent = "Отметьте задачу галочкой, и она появится здесь.";
    }
  }

  /* ============================================================
     Inline-редактирование
     ============================================================ */

  function bindTextEditing(textElement, id) {
    textElement.addEventListener("dblclick", () => startEditing(textElement, id));
    textElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "F2") {
        event.preventDefault();
        startEditing(textElement, id);
      }
    });
  }

  function startEditing(textElement, id) {
    const task = tasks.find((item) => item.id === id);
    const node = textElement.closest(".task");
    if (!task || !node || node.classList.contains("is-editing")) return;

    node.classList.add("is-editing");

    const editor = document.createElement("input");
    editor.type = "text";
    editor.className = "task__edit";
    editor.value = task.text;
    editor.maxLength = MAX_TITLE;
    editor.setAttribute("aria-label", "Название задачи");
    textElement.replaceWith(editor);
    editor.focus();
    editor.select();

    let finished = false;

    // commit=true — сохранить (Enter / blur), commit=false — отменить (Escape)
    const finish = (commit) => {
      if (finished) return;
      finished = true;

      const value = editor.value.trim();
      if (commit && value) {
        task.text = value;
        persist();
      }

      const restored = document.createElement("span");
      restored.className = "task__text";
      restored.textContent = task.text;
      restored.title = "Двойной клик для редактирования";
      restored.tabIndex = 0;
      bindTextEditing(restored, id);
      editor.replaceWith(restored);
      node.classList.remove("is-editing");

      const checkbox = node.querySelector(".task__checkbox");
      if (checkbox) updateCheckboxLabel(checkbox, task);
    };

    editor.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      } else if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    });
    editor.addEventListener("blur", () => finish(true));
  }

  /* ============================================================
     Drag & Drop (Pointer Events — мышь и touch)
     ============================================================ */

  function setupDrag(node, id) {
    const handle = node.querySelector(".task__handle");

    // Начинаем перетаскивание:
    // — мышью — с любого места карточки (кроме чекбокса, текста в режиме
    //   редактирования и кнопки удаления);
    // — touch/pen — только за ручку, чтобы не мешать прокрутке страницы.
    node.addEventListener("pointerdown", (event) => {
      if (dragState) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (list.children.length < 2) return;
      if (node.classList.contains("is-editing")) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const isHandle = Boolean(target.closest(".task__handle"));
      const isControl = Boolean(
        target.closest(".task__check, .task__delete, .task__edit, input, textarea, select")
      );

      if (isControl) return;
      if (event.pointerType !== "mouse" && !isHandle) return;

      if (isHandle) {
        // Ручка не должна выделять текст или запускать прокрутку
        event.preventDefault();
      }

      dragState = {
        id,
        node,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        started: false,
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("blur", cleanupDrag);
    });

    function cleanupDrag() {
      if (!dragState || dragState.id !== id) return false;

      const wasStarted = dragState.started;
      node.classList.remove("is-dragging");
      list.classList.remove("is-dragging");
      document.body.classList.remove("is-dragging");
      dragState = null;

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", cleanupDrag);

      if (wasStarted) persistOrderFromDom();
      return true;
    }

    function onPointerMove(event) {
      if (
        !dragState ||
        dragState.id !== id ||
        event.pointerId !== dragState.pointerId
      ) {
        return;
      }

      if (!dragState.started) {
        const dx = event.clientX - dragState.startX;
        const dy = event.clientY - dragState.startY;

        // Небольшой порог, чтобы обычный клик и двойной клик не превращались в drag
        if (Math.hypot(dx, dy) < 5) return;

        dragState.started = true;
        node.classList.add("is-dragging");
        list.classList.add("is-dragging");
        document.body.classList.add("is-dragging");

        const selection = window.getSelection();
        if (selection) selection.removeAllRanges();
      }

      if (event.cancelable) event.preventDefault();

      const after = getDragAfterElement(list, event.clientY);
      if (after == null) {
        if (list.lastElementChild !== node) list.appendChild(node);
      } else if (after !== node) {
        list.insertBefore(node, after);
      }
    }

    function onPointerUp(event) {
      if (
        !dragState ||
        dragState.id !== id ||
        event.pointerId !== dragState.pointerId
      ) {
        return;
      }

      cleanupDrag();
    }
  }

  // Возвращает элемент, перед которым нужно вставить перетаскиваемый
  function getDragAfterElement(container, pointerY) {
    const elements = Array.from(container.querySelectorAll(".task:not(.is-dragging)"));

    return elements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = pointerY - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  // Сохраняем новый порядок. Работает и при активном фильтре:
  // меняем местами только видимые задачи, скрытые остаются на своих позициях.
  function persistOrderFromDom() {
    const visibleIds = Array.from(list.querySelectorAll(".task")).map(
      (element) => element.dataset.id
    );
    if (visibleIds.length === 0) return;

    const visibleSet = new Set(visibleIds);
    const ordered = visibleIds
      .map((id) => tasks.find((task) => task.id === id))
      .filter(Boolean);

    let index = 0;
    tasks = tasks.map((task) =>
      visibleSet.has(task.id) ? ordered[index++] : task
    );

    persist();
  }

  /* ============================================================
     Календарь
     ============================================================ */

  function renderCalendar() {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Пн = 0
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    calendarTitle.textContent = `${MONTHS_NOM[calendarMonth]} ${calendarYear}`;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < startOffset; i += 1) {
      const blank = document.createElement("span");
      blank.className = "calendar__blank";
      blank.setAttribute("aria-hidden", "true");
      fragment.append(blank);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${calendarYear}-${pad2(calendarMonth + 1)}-${pad2(day)}`;
      const dayTasks = tasksForDay(key);
      const done = dayTasks.filter((task) => task.completed).length;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar__day";
      button.dataset.date = key;
      button.textContent = String(day);
      button.setAttribute("aria-pressed", String(key === selectedDate));

      if (key === todayKey()) button.classList.add("is-today");
      if (key === selectedDate) button.classList.add("is-selected");

      let label = `${capitalize(WEEKDAYS_FULL[(parseDateKey(key).getDay() + 6) % 7])}, ${formatDayTitle(key)}`;
      if (dayTasks.length > 0) {
        button.classList.add("has-tasks");

        const dot = document.createElement("span");
        dot.className = "calendar__dot";
        dot.setAttribute("aria-hidden", "true");
        button.append(dot);

        label += `, задач: ${dayTasks.length}, выполнено: ${done}`;
        button.title = `${done} из ${dayTasks.length} выполнено`;
      }
      button.setAttribute("aria-label", label);

      button.addEventListener("click", () => setSelectedDate(key));
      fragment.append(button);
    }

    calendarGrid.replaceChildren(fragment);
  }

  function setSelectedDate(key) {
    if (!isValidDateKey(key)) return;

    selectedDate = key;
    const date = parseDateKey(key);
    calendarYear = date.getFullYear();
    calendarMonth = date.getMonth();
    dateInput.value = key;

    renderDayHead();
    renderTasks();
    renderCalendar();
    if (!statsView.hidden) renderStats();
  }

  function shiftMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth < 0) {
      calendarMonth = 11;
      calendarYear -= 1;
    } else if (calendarMonth > 11) {
      calendarMonth = 0;
      calendarYear += 1;
    }
    renderCalendar();
  }

  /* ============================================================
     Статистика
     ============================================================ */

  function getStatsPeriod() {
    const base = parseDateKey(selectedDate);

    if (statsRange === "week") {
      const start = startOfWeek(base);
      const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
      return {
        days,
        startKey: dateKey(start),
        endKey: dateKey(days[6]),
        label: formatRange(start, days[6]),
      };
    }

    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const days = Array.from(
      { length: daysInMonth },
      (_, index) => new Date(start.getFullYear(), start.getMonth(), index + 1)
    );

    return {
      days,
      startKey: dateKey(start),
      endKey: dateKey(days[days.length - 1]),
      label: `${MONTHS_NOM[start.getMonth()]} ${start.getFullYear()}`,
    };
  }

  // Дни подряд с хотя бы одной выполненной задачей
  function computeStreak() {
    const completedDays = new Set(
      tasks.filter((task) => task.completed).map((task) => task.date)
    );

    let cursor = new Date();
    if (!completedDays.has(dateKey(cursor))) {
      cursor = addDays(cursor, -1);
    }

    let streak = 0;
    while (completedDays.has(dateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function renderStats() {
    const period = getStatsPeriod();
    const periodTasks = tasks.filter(
      (task) => task.date >= period.startKey && task.date <= period.endKey
    );
    const total = periodTasks.length;
    const done = periodTasks.filter((task) => task.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    const streak = computeStreak();

    statsRangeLabel.textContent = period.label;
    statPercent.textContent = `${percent}%`;
    statTotal.textContent = String(total);
    statDone.textContent = String(done);
    statStreak.textContent = String(streak);
    statStreakHint.textContent = `${pluralDays(streak)} подряд`;
    statsEmpty.hidden = total !== 0;

    renderChart(period);
  }

  function renderChart(period) {
    const isWeek = statsRange === "week";
    chart.style.setProperty("--cols", String(period.days.length));

    const fragment = document.createDocumentFragment();

    period.days.forEach((day) => {
      const key = dateKey(day);
      const dayTasks = tasksForDay(key);
      const done = dayTasks.filter((task) => task.completed).length;
      const percent =
        dayTasks.length === 0 ? 0 : Math.round((done / dayTasks.length) * 100);

      const column = document.createElement("div");
      column.className = "chart__col";
      if (key === todayKey()) column.classList.add("is-today");
      if (key === selectedDate) column.classList.add("is-selected");
      column.title = `${capitalize(WEEKDAYS_FULL[(day.getDay() + 6) % 7])}, ${formatDayTitle(key)} — ${done} из ${dayTasks.length}`;

      const barArea = document.createElement("div");
      barArea.className = "chart__bar-area";

      const bar = document.createElement("div");
      bar.className = "chart__bar";
      if (dayTasks.length === 0) {
        bar.classList.add("is-empty");
        bar.style.height = "3px";
      } else {
        bar.style.height = `${Math.max(percent, 3)}%`;
      }
      barArea.append(bar);

      const label = document.createElement("span");
      label.className = "chart__label";
      label.textContent = isWeek
        ? WEEKDAYS_SHORT[(day.getDay() + 6) % 7]
        : String(day.getDate());

      const value = document.createElement("span");
      value.className = "chart__value";
      value.textContent = isWeek ? `${done}/${dayTasks.length}` : "";

      column.append(barArea, label, value);
      fragment.append(column);
    });

    chart.replaceChildren(fragment);
  }

  /* ============================================================
     Переключение разделов и фильтров
     ============================================================ */

  function setView(view) {
    const isStats = view === "stats";

    viewButtons.forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    tasksView.hidden = isStats;
    statsView.hidden = !isStats;

    if (isStats) renderStats();
  }

  function setFilter(nextFilter) {
    filter = nextFilter;

    filterButtons.forEach((button) => {
      const active = button.dataset.filter === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    renderTasks();
  }

  function setStatsRange(nextRange) {
    statsRange = nextRange;

    rangeButtons.forEach((button) => {
      const active = button.dataset.range === statsRange;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    renderStats();
  }

  /* ============================================================
     Обработчики
     ============================================================ */

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    // Дата из поля формы, иначе — выбранный день
    const date = isValidDateKey(dateInput.value) ? dateInput.value : selectedDate;

    addTask(text, date);
    input.value = "";

    if (filter === "completed") setFilter("all");

    if (date !== selectedDate) {
      setSelectedDate(date);
    } else {
      renderAll();
    }

    input.focus();
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => setFilter(button.dataset.filter));
  });

  clearCompletedButton.addEventListener("click", () => {
    const before = tasks.length;
    tasks = tasks.filter(
      (task) => !(task.date === selectedDate && task.completed)
    );

    if (tasks.length !== before) {
      persist();
      renderAll();
    }
  });

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  rangeButtons.forEach((button) => {
    button.addEventListener("click", () => setStatsRange(button.dataset.range));
  });

  prevMonthButton.addEventListener("click", () => shiftMonth(-1));
  nextMonthButton.addEventListener("click", () => shiftMonth(1));
  todayButton.addEventListener("click", () => setSelectedDate(todayKey()));

  // Синхронизация между вкладками браузера
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    tasks = loadTasks();
    renderAll();
  });

  /* ============================================================
     Инициализация
     ============================================================ */

  todayLabel.textContent = formatTodayLabel();
  dateInput.value = selectedDate;
  renderAll();
  input.focus();
})();
