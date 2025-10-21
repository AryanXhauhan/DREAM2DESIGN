// DOM Elements
const todoInput = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const taskCount = document.getElementById('task-count');
const clearCompletedBtn = document.getElementById('clear-completed');
const filterBtns = document.querySelectorAll('.filter-btn');
const themeToggle = document.querySelector('.theme-toggle');
const emptyState = document.getElementById('empty-state');

// State
let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = 'all';
let editMode = false;
let editId = null;

// Initialize
function init() {
  renderTodos();
  updateTaskCount();
  checkEmptyState();
  
  // Load theme preference
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  }
}

// Add todo
function addTodo() {
  const text = todoInput.value.trim();
  
  if (text === '') {
    showError('Task cannot be empty!');
    return;
  }
  
  if (editMode) {
    // Update existing todo
    todos = todos.map(todo => 
      todo.id === editId ? { ...todo, text } : todo
    );
    editMode = false;
    editId = null;
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
  } else {
    // Add new todo
    const newTodo = {
      id: Date.now(),
      text,
      completed: false,
      createdAt: new Date().toISOString()
    };
    todos.push(newTodo);
  }
  
  saveTodos();
  renderTodos();
  updateTaskCount();
  checkEmptyState();
  todoInput.value = '';
  todoInput.focus();
}

// Toggle todo completion
function toggleTodo(id) {
  todos = todos.map(todo => 
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  );
  saveTodos();
  renderTodos();
  updateTaskCount();
}

// Delete todo
function deleteTodo(id) {
  todos = todos.filter(todo => todo.id !== id);
  saveTodos();
  renderTodos();
  updateTaskCount();
  checkEmptyState();
}

// Edit todo
function editTodo(id) {
  const todo = todos.find(todo => todo.id === id);
  if (todo) {
    todoInput.value = todo.text;
    editMode = true;
    editId = id;
    addBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    todoInput.focus();
  }
}

// Clear completed todos
function clearCompleted() {
  todos = todos.filter(todo => !todo.completed);
  saveTodos();
  renderTodos();
  updateTaskCount();
  checkEmptyState();
}

// Filter todos
function filterTodos(filter) {
  currentFilter = filter;
  
  // Update active filter button
  filterBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    }
  });
  
  renderTodos();
}

// Render todos based on current filter
function renderTodos() {
  // Filter todos
  let filteredTodos = [];
  
  switch (currentFilter) {
    case 'active':
      filteredTodos = todos.filter(todo => !todo.completed);
      break;
    case 'completed':
      filteredTodos = todos.filter(todo => todo.completed);
      break;
    default:
      filteredTodos = [...todos];
  }
  
  // Render todos
  todoList.innerHTML = '';
  
  if (filteredTodos.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  filteredTodos.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.innerHTML = `
      <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
      <span class="todo-text">${todo.text}</span>
      <div class="todo-actions">
        <button class="todo-edit" title="Edit task">
          <i class="fas fa-edit"></i>
        </button>
        <button class="todo-delete" title="Delete task">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;
    
    // Add event listeners
    li.querySelector('.todo-checkbox').addEventListener('change', () => toggleTodo(todo.id));
    li.querySelector('.todo-edit').addEventListener('click', () => editTodo(todo.id));
    li.querySelector('.todo-delete').addEventListener('click', () => deleteTodo(todo.id));
    
    todoList.appendChild(li);
  });
}

// Update task count
function updateTaskCount() {
  const activeCount = todos.filter(todo => !todo.completed).length;
  taskCount.textContent = `${activeCount} ${activeCount === 1 ? 'task' : 'tasks'} remaining`;
}

// Check if empty state should be shown
function checkEmptyState() {
  emptyState.style.display = todos.length === 0 ? 'block' : 'none';
}

// Save todos to localStorage
function saveTodos() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

// Show error message
function showError(message) {
  // Create error element if it doesn't exist
  let errorEl = document.querySelector('.error-message');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef476f;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      transform: translateX(120%);
      transition: transform 0.3s ease;
    `;
    document.body.appendChild(errorEl);
  }
  
  errorEl.textContent = message;
  errorEl.style.transform = 'translateX(0)';
  
  setTimeout(() => {
    errorEl.style.transform = 'translateX(120%)';
  }, 3000);
}

// Toggle theme
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  themeToggle.innerHTML = newTheme === 'dark' 
    ? '<i class="fas fa-sun"></i>' 
    : '<i class="fas fa-moon"></i>';
}

// Event Listeners
addBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTodo();
});
clearCompletedBtn.addEventListener('click', clearCompleted);
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => filterTodos(btn.dataset.filter));
});
themeToggle.addEventListener('click', toggleTheme);

// Initialize app
init();