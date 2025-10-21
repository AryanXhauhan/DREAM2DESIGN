document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.getElementById('theme-btn');
  const todoForm = document.getElementById('todo-form');
  const todoInput = document.getElementById('todo-input');
  const categorySelect = document.getElementById('category-select');
  const prioritySelect = document.getElementById('priority-select');
  const searchInput = document.getElementById('search-input');
  const todoList = document.getElementById('todo-list');

  let todos = JSON.parse(localStorage.getItem('todos')) || [];

  const saveTodos = () => {
    localStorage.setItem('todos', JSON.stringify(todos));
  };

  const renderTodos = (filteredTodos = todos) => {
    todoList.innerHTML = '';
    filteredTodos.forEach((todo, index) => {
      const li = document.createElement('li');
      li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
      li.innerHTML = `
        <span>${todo.text} (${todo.category}, ${todo.priority})</span>
        <div class="actions">
          <button onclick="toggleComplete(${index})">${todo.completed ? '↻' : '✓'}</button>
          <button onclick="deleteTodo(${index})">✕</button>
        </div>
      `;
      todoList.appendChild(li);
    });
  };

  const addTodo = (text, category, priority) => {
    todos.push({ text, category, priority, completed: false });
    saveTodos();
    renderTodos();
  };

  const toggleComplete = (index) => {
    todos[index].completed = !todos[index].completed;
    saveTodos();
    renderTodos();
  };

  const deleteTodo = (index) => {
    todos.splice(index, 1);
    saveTodos();
    renderTodos();
  };

  const searchTodos = (query) => {
    const filteredTodos = todos.filter(todo =>
      todo.text.toLowerCase().includes(query.toLowerCase())
    );
    renderTodos(filteredTodos);
  };

  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = todoInput.value.trim();
    const category = categorySelect.value;
    const priority = prioritySelect.value;
    if (text) {
      addTodo(text, category, priority);
      todoInput.value = '';
    }
  });

  searchInput.addEventListener('input', () => {
    searchTodos(searchInput.value);
  });

  themeBtn.addEventListener('click', () => {
    document.body.dataset.theme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    themeBtn.textContent = document.body.dataset.theme === 'dark' ? '☀️' : '🌙';
  });

  renderTodos();
});