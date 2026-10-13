const taskForm = document.querySelector("#task-form");
const titleInput = document.querySelector("#task-title");
const descriptionInput = document.querySelector("#task-description");
const priorityInput = document.querySelector("#task-priority");
const dueDateInput = document.querySelector("#task-due-date");
const searchInput = document.querySelector("#task-search");
const statusFilter = document.querySelector("#status-filter");
const priorityFilter = document.querySelector("#priority-filter");
const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const formMessage = document.querySelector("#form-message");
const storageKey = "task-flow-v1";
const taskStatuses = ["TODO", "DOING", "DONE"];
const taskPriorities = ["HIGH", "NORMAL", "LOW"];

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function persistTasks(tasksToSave) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasksToSave));
    return true;
  } catch {
    formMessage.textContent = "할 일을 저장하지 못했습니다. 저장 공간을 확인해 주세요.";
    formMessage.dataset.error = "true";
    return false;
  }
}

function loadTasks() {
  let savedTasks;

  try {
    const savedValue = localStorage.getItem(storageKey);
    if (savedValue === null) {
      return { tasks: [], error: null };
    }
    savedTasks = JSON.parse(savedValue);
  } catch {
    return {
      tasks: [],
      error: "저장된 데이터를 읽을 수 없습니다. 데이터 보호를 위해 등록을 중지했습니다.",
    };
  }

  if (
    !Array.isArray(savedTasks) ||
    !savedTasks.every(
      (task) =>
        task !== null &&
        typeof task === "object" &&
        !Array.isArray(task) &&
        typeof task.title === "string" &&
        task.title === task.title.trim() &&
        task.title.length >= 1 &&
        task.title.length <= 100 &&
        ((!Object.hasOwn(task, "id") &&
          !Object.hasOwn(task, "status")) ||
          (typeof task.id === "string" &&
            task.id.length > 0 &&
            taskStatuses.includes(task.status))) &&
        (!Object.hasOwn(task, "description") ||
          (typeof task.description === "string" &&
            task.description.length <= 2000)) &&
        (!Object.hasOwn(task, "priority") ||
          taskPriorities.includes(task.priority)) &&
        (!Object.hasOwn(task, "due_date") ||
          task.due_date === null ||
          isValidDate(task.due_date)) &&
        (!Object.hasOwn(task, "created_at") ||
          (typeof task.created_at === "string" &&
            Number.isFinite(Date.parse(task.created_at)))),
    )
  ) {
    return {
      tasks: [],
      error: "저장된 데이터 형식이 올바르지 않습니다. 데이터 보호를 위해 등록을 중지했습니다.",
    };
  }

  const taskIds = savedTasks
    .filter((task) => typeof task.id === "string")
    .map((task) => task.id);
  if (new Set(taskIds).size !== taskIds.length) {
    return {
      tasks: [],
      error: "저장된 데이터 형식이 올바르지 않습니다. 데이터 보호를 위해 등록을 중지했습니다.",
    };
  }

  const migratedTasks = savedTasks.map((task) => ({
    id: task.id ?? crypto.randomUUID(),
    title: task.title,
    description: task.description ?? "",
    status: task.status ?? "TODO",
    priority: task.priority ?? "NORMAL",
    due_date: task.due_date ?? null,
    created_at: task.created_at ?? new Date().toISOString(),
  }));

  if (JSON.stringify(migratedTasks) !== JSON.stringify(savedTasks)) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(migratedTasks));
    } catch {
      return {
        tasks: migratedTasks,
        error: "기존 할 일을 새 형식으로 저장하지 못했습니다. 데이터 보호를 위해 변경을 중지했습니다.",
      };
    }
  }

  return { tasks: migratedTasks, error: null };
}

const loadedTasks = loadTasks();
let tasks = loadedTasks.tasks;
let storageReady = loadedTasks.error === null;
let editingTaskId = null;
let confirmingTaskId = null;

if (loadedTasks.error) {
  formMessage.textContent = loadedTasks.error;
  formMessage.dataset.error = "true";
  titleInput.disabled = true;
  descriptionInput.disabled = true;
  priorityInput.disabled = true;
  dueDateInput.disabled = true;
  taskForm.querySelector('button[type="submit"]').disabled = true;
  searchInput.disabled = true;
  statusFilter.disabled = true;
  priorityFilter.disabled = true;
}

renderTasks();

function getVisibleTasks() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    const matchesTitle = task.title.toLocaleLowerCase().includes(query);
    const matchesStatus =
      statusFilter.value === "" || task.status === statusFilter.value;
    const matchesPriority =
      priorityFilter.value === "" || task.priority === priorityFilter.value;
    return matchesTitle && matchesStatus && matchesPriority;
  });
}

function getLocalDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function appendSelectOptions(select, options, selectedValue) {
  for (const [value, label] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = selectedValue === value;
    select.append(option);
  }
}

function renderTasks() {
  taskList.replaceChildren();
  const visibleTasks = getVisibleTasks();
  taskCount.textContent =
    visibleTasks.length === tasks.length
      ? `${tasks.length}개`
      : `${visibleTasks.length}개 / ${tasks.length}개`;

  if (visibleTasks.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent =
      tasks.length === 0
        ? "아직 등록된 할 일이 없습니다."
        : "조건에 맞는 할 일이 없습니다.";
    taskList.append(emptyState);
    return;
  }

  const today = getLocalDateString();
  for (const task of visibleTasks) {
    const item = document.createElement("li");
    const isOverdue =
      task.due_date !== null &&
      task.due_date < today &&
      task.status !== "DONE";
    item.className = isOverdue ? "task-item is-overdue" : "task-item";

    const marker = document.createElement("span");
    marker.className = "task-marker";
    marker.setAttribute("aria-hidden", "true");

    const controls = document.createElement("div");
    controls.className = "task-controls";

    if (editingTaskId === task.id) {
      const editForm = document.createElement("form");
      editForm.className = "task-edit-form";
      editForm.dataset.taskId = task.id;

      const title = document.createElement("input");
      title.className = "task-edit-input";
      title.type = "text";
      title.maxLength = 100;
      title.value = task.title;
      title.setAttribute("aria-label", `수정할 제목: ${task.title}`);
      title.required = true;

      const description = document.createElement("textarea");
      description.className = "task-edit-description";
      description.maxLength = 2000;
      description.value = task.description;
      description.setAttribute("aria-label", `설명 수정: ${task.title}`);

      const priority = document.createElement("select");
      priority.className = "task-edit-priority";
      priority.setAttribute("aria-label", `우선순위 수정: ${task.title}`);
      appendSelectOptions(
        priority,
        [
          ["HIGH", "높음"],
          ["NORMAL", "보통"],
          ["LOW", "낮음"],
        ],
        task.priority,
      );

      const dueDate = document.createElement("input");
      dueDate.className = "task-edit-due-date";
      dueDate.type = "date";
      dueDate.value = task.due_date ?? "";
      dueDate.setAttribute("aria-label", `마감일 수정: ${task.title}`);

      const saveButton = document.createElement("button");
      saveButton.type = "submit";
      saveButton.className = "task-action";
      saveButton.textContent = "저장";

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "task-action";
      cancelButton.dataset.action = "cancel-edit";
      cancelButton.dataset.taskId = task.id;
      cancelButton.textContent = "취소";

      editForm.append(title, description, priority, dueDate, saveButton, cancelButton);
      item.append(marker, editForm);
      taskList.append(item);
      continue;
    }

    const content = document.createElement("div");
    content.className = "task-content";

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;
    content.append(title);

    if (task.description) {
      const description = document.createElement("p");
      description.className = "task-description";
      description.textContent = task.description;
      content.append(description);
    }

    const details = document.createElement("div");
    details.className = "task-details";
    const priority = document.createElement("span");
    priority.className = `task-priority priority-${task.priority.toLowerCase()}`;
    priority.textContent = {
      HIGH: "높음",
      NORMAL: "보통",
      LOW: "낮음",
    }[task.priority];
    details.append(priority);

    if (task.due_date !== null) {
      const dueDate = document.createElement("span");
      dueDate.className = "task-due-date";
      dueDate.textContent = `마감 ${task.due_date}`;
      details.append(dueDate);
    }

    if (isOverdue) {
      const overdue = document.createElement("span");
      overdue.className = "task-overdue";
      overdue.textContent = "지연";
      details.append(overdue);
    }
    content.append(details);

    const status = document.createElement("select");
    status.className = "task-status";
    status.dataset.taskId = task.id;
    status.setAttribute("aria-label", `상태: ${task.title}`);
    status.disabled = !storageReady;
    appendSelectOptions(
      status,
      [
        ["TODO", "할 일"],
        ["DOING", "진행 중"],
        ["DONE", "완료"],
      ],
      task.status,
    );

    if (confirmingTaskId === task.id) {
      const confirmation = document.createElement("span");
      confirmation.className = "task-confirmation-text";
      confirmation.textContent = "삭제할까요?";
      controls.append(confirmation);

      for (const [action, label, className] of [
        ["confirm-delete", "삭제 확인", "task-action-delete"],
        ["cancel-delete", "취소", ""],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `task-action ${className}`;
        button.disabled = !storageReady;
        button.dataset.action = action;
        button.dataset.taskId = task.id;
        button.textContent = label;
        controls.append(button);
      }
    } else {
      for (const [action, label] of [
        ["edit", "수정"],
        ["delete", "삭제"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `task-action task-action-${action}`;
        button.disabled = !storageReady;
        button.dataset.action = action;
        button.dataset.taskId = task.id;
        button.setAttribute("aria-label", `${label}: ${task.title}`);
        button.textContent = label;
        controls.append(button);
      }
    }

    item.append(marker, content, status, controls);
    taskList.append(item);
  }
}

for (const filter of [searchInput, statusFilter, priorityFilter]) {
  filter.addEventListener("input", renderTasks);
  filter.addEventListener("change", renderTasks);
}

taskList.addEventListener("change", (event) => {
  if (
    !storageReady ||
    !(event.target instanceof HTMLSelectElement) ||
    !event.target.classList.contains("task-status")
  ) {
    return;
  }

  const { taskId } = event.target.dataset;
  const status = event.target.value;
  if (taskId && taskStatuses.includes(status)) {
    const updatedTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, status } : task,
    );
    if (persistTasks(updatedTasks)) {
      tasks = updatedTasks;
      formMessage.textContent = "";
      delete formMessage.dataset.error;
    }
    renderTasks();
  }
});

taskList.addEventListener("submit", (event) => {
  if (!storageReady || !(event.target instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();
  const taskId = event.target.dataset.taskId;
  const titleInput = event.target.querySelector(".task-edit-input");
  const descriptionInput = event.target.querySelector(".task-edit-description");
  const priorityInput = event.target.querySelector(".task-edit-priority");
  const dueDateInput = event.target.querySelector(".task-edit-due-date");
  if (!taskId || !titleInput || !descriptionInput || !priorityInput || !dueDateInput) {
    return;
  }

  const title = titleInput.value.trim();
  const description = descriptionInput.value;
  const priority = priorityInput.value;
  const dueDate = dueDateInput.value || null;
  if (title.length === 0 || title.length > 100) {
    formMessage.textContent = "제목은 공백을 제외하고 1~100자로 입력해 주세요.";
    formMessage.dataset.error = "true";
    titleInput.focus();
    return;
  }
  if (description.length > 2000) {
    formMessage.textContent = "설명은 2000자 이내로 입력해 주세요.";
    formMessage.dataset.error = "true";
    descriptionInput.focus();
    return;
  }
  if (!taskPriorities.includes(priority) || (dueDate !== null && !isValidDate(dueDate))) {
    formMessage.textContent = "우선순위나 마감일을 확인해 주세요.";
    formMessage.dataset.error = "true";
    return;
  }

  const updatedTasks = tasks.map((task) =>
    task.id === taskId
      ? { ...task, title, description, priority, due_date: dueDate }
      : task,
  );
  if (persistTasks(updatedTasks)) {
    tasks = updatedTasks;
    editingTaskId = null;
    formMessage.textContent = "";
    delete formMessage.dataset.error;
    renderTasks();
  }
});

taskList.addEventListener("click", (event) => {
  if (!storageReady || !(event.target instanceof HTMLButtonElement)) {
    return;
  }

  const { action, taskId } = event.target.dataset;
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    return;
  }

  if (action === "edit") {
    editingTaskId = taskId;
    confirmingTaskId = null;
    renderTasks();
    const input = taskList.querySelector(".task-edit-input");
    input.focus();
    input.select();
    return;
  }

  if (action === "cancel-edit") {
    editingTaskId = null;
    renderTasks();
    return;
  }

  if (action === "delete") {
    confirmingTaskId = taskId;
    renderTasks();
    return;
  }

  if (action === "cancel-delete") {
    confirmingTaskId = null;
    renderTasks();
    return;
  }

  if (action === "confirm-delete") {
    const updatedTasks = tasks.filter((candidate) => candidate.id !== taskId);
    if (persistTasks(updatedTasks)) {
      tasks = updatedTasks;
      confirmingTaskId = null;
      formMessage.textContent = "";
      delete formMessage.dataset.error;
      renderTasks();
    }
  }
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!storageReady) {
    return;
  }

  const title = titleInput.value.trim();
  const description = descriptionInput.value;
  const priority = priorityInput.value;
  const dueDate = dueDateInput.value || null;
  if (title.length === 0 || title.length > 100) {
    formMessage.textContent = "제목을 공백 제외 1~100자로 입력해 주세요.";
    formMessage.dataset.error = "true";
    titleInput.focus();
    return;
  }
  if (description.length > 2000) {
    formMessage.textContent = "설명은 2000자 이내로 입력해 주세요.";
    formMessage.dataset.error = "true";
    descriptionInput.focus();
    return;
  }
  if (!taskPriorities.includes(priority) || (dueDate !== null && !isValidDate(dueDate))) {
    formMessage.textContent = "우선순위나 마감일을 확인해 주세요.";
    formMessage.dataset.error = "true";
    return;
  }

  const updatedTasks = [
    ...tasks,
    {
      id: crypto.randomUUID(),
      title,
      description,
      status: "TODO",
      priority,
      due_date: dueDate,
      created_at: new Date().toISOString(),
    },
  ];
  if (!persistTasks(updatedTasks)) {
    return;
  }

  tasks = updatedTasks;
  taskForm.reset();
  priorityInput.value = "NORMAL";
  formMessage.textContent = "";
  delete formMessage.dataset.error;
  renderTasks();
  titleInput.focus();
});
