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
const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const userBar = document.querySelector("#user-bar");
const currentUser = document.querySelector("#current-user");
const logoutButton = document.querySelector("#logout-button");
const authHeading = document.querySelector("#auth-heading");
const authForm = document.querySelector("#auth-form");
const authUsername = document.querySelector("#auth-username");
const authPassword = document.querySelector("#auth-password");
const authSubmit = document.querySelector("#auth-submit");
const authHint = document.querySelector("#auth-hint");
const authMessage = document.querySelector("#auth-message");
const authTabs = document.querySelectorAll(".auth-tab");
const apiBaseUrl = "/api";
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

function showMessage(message, isError = true) {
  formMessage.textContent = message;
  if (isError) {
    formMessage.dataset.error = "true";
  } else {
    delete formMessage.dataset.error;
  }
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? ` (${body.detail})` : "";
    } catch {
      detail = "";
    }
    const error = new Error(`요청에 실패했습니다. (${response.status})${detail}`);
    error.status = response.status;
    // 로그인이 필요한 요청이 401이면 세션이 끝난 것이므로 로그인 화면으로 돌아간다.
    if (response.status === 401 && !path.startsWith("/auth/")) {
      showLoggedOut("세션이 만료되었습니다. 다시 로그인해 주세요.");
    }
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

let tasks = [];
let apiReady = false;
let apiBusy = false;
let editingTaskId = null;
let confirmingTaskId = null;
let authMode = "login";
let authBusy = false;

function showAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  if (isError) {
    authMessage.dataset.error = "true";
  } else {
    delete authMessage.dataset.error;
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === "register";
  authHeading.textContent = isRegister ? "회원가입" : "로그인";
  authSubmit.textContent = isRegister ? "가입하기" : "로그인";
  authHint.textContent = isRegister
    ? "사용자명 3~30자(영문·숫자·밑줄), 비밀번호 8~128자"
    : "로그인 정보를 입력해 주세요.";
  authPassword.autocomplete = isRegister ? "new-password" : "current-password";
  for (const tab of authTabs) {
    tab.setAttribute("aria-pressed", String(tab.dataset.mode === mode));
  }
  showAuthMessage("", false);
}

function showLoggedOut(message = "") {
  tasks = [];
  apiReady = false;
  apiBusy = false;
  editingTaskId = null;
  confirmingTaskId = null;
  taskForm.reset();
  priorityInput.value = "NORMAL";
  searchInput.value = "";
  statusFilter.value = "";
  priorityFilter.value = "";
  showMessage("", false);
  currentUser.textContent = "";
  userBar.hidden = true;
  appView.hidden = true;
  authView.hidden = false;
  authPassword.value = "";
  setAuthMode("login");
  showAuthMessage(message, false);
  renderTasks();
}

function showLoggedIn(user) {
  authForm.reset();
  showAuthMessage("", false);
  authView.hidden = true;
  appView.hidden = false;
  userBar.hidden = false;
  currentUser.textContent = user.username;
  apiReady = false;
  showMessage("API 서버에 연결 중입니다.", false);
  renderTasks();
  loadTasks();
}

async function loadTasks() {
  try {
    tasks = await apiRequest("/tasks");
    apiReady = true;
    showMessage("", false);
  } catch (error) {
    showMessage(error.message);
  }
  renderTasks();
}

async function initSession() {
  try {
    showLoggedIn(await apiRequest("/auth/me"));
  } catch (error) {
    showLoggedOut(error.status === 401 ? "" : error.message);
  }
}

initSession();

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
  for (const control of [
    titleInput,
    descriptionInput,
    priorityInput,
    dueDateInput,
    taskForm.querySelector('button[type="submit"]'),
    searchInput,
    statusFilter,
    priorityFilter,
  ]) {
    control.disabled = !apiReady || apiBusy;
  }

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
      !apiReady
        ? "API에서 목록을 불러오지 못했습니다."
        : tasks.length === 0
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
    status.disabled = !apiReady || apiBusy;
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
        button.disabled = !apiReady || apiBusy;
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
        button.disabled = !apiReady || apiBusy;
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

taskList.addEventListener("change", async (event) => {
  if (
    !apiReady ||
    apiBusy ||
    !(event.target instanceof HTMLSelectElement) ||
    !event.target.classList.contains("task-status")
  ) {
    return;
  }

  const { taskId } = event.target.dataset;
  const status = event.target.value;
  if (taskId && taskStatuses.includes(status)) {
    apiBusy = true;
    renderTasks();
    try {
      const updatedTask = await apiRequest(`/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      tasks = tasks.map((task) => (task.id === taskId ? updatedTask : task));
      showMessage("", false);
    } catch (error) {
      showMessage(error.message);
    } finally {
      apiBusy = false;
      renderTasks();
    }
  }
});

taskList.addEventListener("submit", async (event) => {
  if (!apiReady || apiBusy || !(event.target instanceof HTMLFormElement)) {
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

  apiBusy = true;
  renderTasks();
  try {
    const updatedTask = await apiRequest(`/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        title,
        description,
        priority,
        due_date: dueDate,
      }),
    });
    tasks = tasks.map((task) => (task.id === taskId ? updatedTask : task));
    editingTaskId = null;
    showMessage("", false);
  } catch (error) {
    showMessage(error.message);
  } finally {
    apiBusy = false;
    renderTasks();
  }
});

taskList.addEventListener("click", async (event) => {
  if (!apiReady || apiBusy || !(event.target instanceof HTMLButtonElement)) {
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
    apiBusy = true;
    renderTasks();
    try {
      await apiRequest(`/tasks/${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });
      tasks = tasks.filter((candidate) => candidate.id !== taskId);
      confirmingTaskId = null;
      showMessage("", false);
    } catch (error) {
      showMessage(error.message);
    } finally {
      apiBusy = false;
      renderTasks();
    }
  }
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!apiReady || apiBusy) {
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

  apiBusy = true;
  renderTasks();
  try {
    const createdTask = await apiRequest("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title,
        description,
        priority,
        due_date: dueDate,
      }),
    });
    tasks = [...tasks, createdTask];
    taskForm.reset();
    priorityInput.value = "NORMAL";
    showMessage("", false);
  } catch (error) {
    showMessage(error.message);
  } finally {
    apiBusy = false;
    renderTasks();
  }
  if (!formMessage.dataset.error) {
    titleInput.focus();
  }
});

for (const tab of authTabs) {
  tab.addEventListener("click", () => {
    if (!authBusy) {
      setAuthMode(tab.dataset.mode);
    }
  });
}

function authErrorMessage(error) {
  if (error.status === 401) {
    return "사용자명 또는 비밀번호가 올바르지 않습니다.";
  }
  if (error.status === 409) {
    return "이미 사용 중인 사용자명입니다.";
  }
  if (error.status === 422) {
    return "입력한 사용자명이나 비밀번호 형식을 확인해 주세요.";
  }
  return error.message;
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authBusy) {
    return;
  }

  const username = authUsername.value.trim();
  const password = authPassword.value;
  const isRegister = authMode === "register";
  if (isRegister && !/^[A-Za-z0-9_]{3,30}$/.test(username)) {
    showAuthMessage("사용자명은 영문·숫자·밑줄 3~30자로 입력해 주세요.");
    authUsername.focus();
    return;
  }
  if (!isRegister && (username.length === 0 || username.length > 30)) {
    showAuthMessage("사용자명을 입력해 주세요.");
    authUsername.focus();
    return;
  }
  if (isRegister && (password.length < 8 || password.length > 128 || password.trim() === "")) {
    showAuthMessage("비밀번호는 공백만이 아닌 8~128자로 입력해 주세요.");
    authPassword.focus();
    return;
  }
  if (!isRegister && (password.length === 0 || password.length > 128)) {
    showAuthMessage("비밀번호를 입력해 주세요.");
    authPassword.focus();
    return;
  }

  authBusy = true;
  authSubmit.disabled = true;
  showAuthMessage("", false);
  const credentials = JSON.stringify({ username, password });
  let registered = false;
  try {
    if (isRegister) {
      await apiRequest("/auth/register", { method: "POST", body: credentials });
      registered = true;
    }
    const user = await apiRequest("/auth/login", { method: "POST", body: credentials });
    authBusy = false;
    authSubmit.disabled = false;
    showLoggedIn(user);
    titleInput.focus();
    return;
  } catch (error) {
    if (registered) {
      setAuthMode("login");
      showAuthMessage("가입은 완료되었습니다. 로그인해 주세요.", false);
    } else {
      showAuthMessage(authErrorMessage(error));
    }
    authPassword.value = "";
  }
  authBusy = false;
  authSubmit.disabled = false;
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await apiRequest("/auth/logout", { method: "POST" });
    showLoggedOut("로그아웃했습니다.");
  } catch (error) {
    showMessage(error.message);
  } finally {
    logoutButton.disabled = false;
  }
});
