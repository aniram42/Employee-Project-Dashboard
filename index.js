// НАВИГАЦИЯ И СОСТОЯНИЕ UI
let isSidebarCollapsed = false;
let currentActiveTab = 'projects';
let currentPeriod;

// БОКОВАЯ ПАНЕЛЬ
function setupSidebar() {
    const sidebar = document.getElementById('sidePanel');
    const burgerBtn = document.getElementById('burgerIcon');
    const showBtn = document.getElementById('showPanelBtn');
    if (!sidebar || !burgerBtn || !showBtn) return;

    function collapseSidebar() {
        sidebar.classList.add('collapsed');
        showBtn.classList.remove('hidden');
        isSidebarCollapsed = true;
        localStorage.setItem('sidebarCollapsed', 'true');
    }
    function expandSidebar() {
        sidebar.classList.remove('collapsed');
        showBtn.classList.add('hidden');
        isSidebarCollapsed = false;
        localStorage.setItem('sidebarCollapsed', 'false');
    }
    burgerBtn.addEventListener('click', collapseSidebar);
    showBtn.addEventListener('click', expandSidebar);
    if (localStorage.getItem('sidebarCollapsed') === 'true') collapseSidebar();
    else expandSidebar();
}

// ВКЛАДКИ
function setupTabs() {
    const projectsLink = document.querySelector('.nav__link[data-page="projects"]');
    const employeesLink = document.querySelector('.nav__link[data-page="employees"]');
    const projectsPage = document.getElementById('projectsPage');
    const employeesPage = document.getElementById('employeesPage');
    if (!projectsLink || !employeesLink) return;

    function switchToProjects() {
        projectsPage.classList.remove('page--hidden');
        employeesPage.classList.add('page--hidden');
        projectsLink.classList.add('nav__link--active');
        employeesLink.classList.remove('nav__link--active');
        currentActiveTab = 'projects';
        localStorage.setItem('activeTab', 'projects');
        renderProjectsTable();
    }
    function switchToEmployees() {
        employeesPage.classList.remove('page--hidden');
        projectsPage.classList.add('page--hidden');
        employeesLink.classList.add('nav__link--active');
        projectsLink.classList.remove('nav__link--active');
        currentActiveTab = 'employees';
        localStorage.setItem('activeTab', 'employees');
        renderEmployeesTable();
    }
    projectsLink.addEventListener('click', (e) => { e.preventDefault(); switchToProjects(); });
    employeesLink.addEventListener('click', (e) => { e.preventDefault(); switchToEmployees(); });
    if (localStorage.getItem('activeTab') === 'employees') switchToEmployees();
    else switchToProjects();
}

// СЕЛЕКТОР ПЕРИОДА
function setupPeriodSelector() {
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    if (monthSelect && yearSelect) {
        function updatePeriod() {
            currentPeriod = `${yearSelect.value}-${monthSelect.value}`;
            localStorage.setItem('currentPeriod', currentPeriod);
            if (appData && appData.monthlyData) { // данные уже есть?
                if (currentActiveTab === 'projects') renderProjectsTable();
                else renderEmployeesTable();
            }
        }
        monthSelect.addEventListener('change', updatePeriod);
        yearSelect.addEventListener('change', updatePeriod);
    }
}

// УСТАНОВКА ТЕКУЩЕГО ПЕРИОДА (МЕСЯЦ/ГОД)
function setDefaultPeriod() {
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    if (!yearSelect || !monthSelect) return;

    // Всегда берём текущую дату
    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth();

    if (currentYear < 2025) currentYear = 2025;
    if (currentYear > 2027) currentYear = 2027;
    if (!yearSelect.querySelector(`option[value="${currentYear}"]`)) currentYear = 2027;

    yearSelect.value = currentYear.toString();
    monthSelect.value = currentMonth.toString();
    currentPeriod = `${currentYear}-${currentMonth}`;
}


// ДАННЫЕ
let appData = null;

function saveToLocalStorage() {
    localStorage.setItem('monthlyData', JSON.stringify(appData.monthlyData));
}

async function loadData() {
    const saved = localStorage.getItem('monthlyData');
    if (saved) {
        try {
            appData = { monthlyData: JSON.parse(saved) };
            console.log('Data loaded from localStorage');
        } catch (e) {
            console.error('Error parsing localStorage', e);
            await fetchDefaultData();
        }
    } else {
        await fetchDefaultData();
    }
    // Синхронизируем currentPeriod с селекторами
    const yearSelect = document.getElementById('yearSelect');
    const monthSelect = document.getElementById('monthSelect');
    if (yearSelect && monthSelect) {
        currentPeriod = `${yearSelect.value}-${monthSelect.value}`;
    }
    renderCurrentTable();
}

async function fetchDefaultData() {
    try {
        const response = await fetch('database.json');
        appData = await response.json();
        saveToLocalStorage();
        console.log('Default data loaded from database.json');
    } catch (error) {
        console.error('Error loading database.json:', error);
        appData = { monthlyData: {} };
    }
}

function getCurrentProjects() { return appData?.monthlyData?.[currentPeriod]?.projects || []; }
function getCurrentEmployees() { return appData?.monthlyData?.[currentPeriod]?.employees || []; }
function renderCurrentTable() { if (currentActiveTab === 'projects') renderProjectsTable(); else renderEmployeesTable(); }
function getYearFromPeriod(period) { return parseInt(period.split('-')[0]); }
function getMonthFromPeriod(period) { return parseInt(period.split('-')[1]); }

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ФИНАНСОВЫЕ РАСЧЕТЫ
function getWorkingDays(year, month) {
    const date = new Date(year, month, 1);
    let workingDays = 0;
    while (date.getMonth() === month) {
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
        date.setDate(date.getDate() + 1);
    }
    return workingDays;
}

function calculateVacationCoefficient(vacationDays, year, month) {
    if (!vacationDays || vacationDays.length === 0) return 1;
    const workingDays = getWorkingDays(year, month);
    if (workingDays === 0) return 1;
    const vacationWorkingDays = vacationDays.filter(day => {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6;
    }).length;
    return (workingDays - vacationWorkingDays) / workingDays;
}

function calculateEffectiveCapacity(capacity, fit, vacationCoefficient) {
    return capacity * fit * vacationCoefficient;
}

function calculateEmployeeRevenue(employee, project, assignment, vacationCoefficient, allEmployees) {
    const effectiveCapacity = calculateEffectiveCapacity(assignment.capacity, assignment.fit, vacationCoefficient);
    const totalEffectiveCapacity = allEmployees
        .filter(e => e.projectAssignments?.some(a => a.projectId === project.id))
        .reduce((sum, e) => {
            const empAssignment = e.projectAssignments?.find(a => a.projectId === project.id);
            if (empAssignment) {
                const empVacationCoeff = calculateVacationCoefficient(e.vacationDays, getYearFromPeriod(currentPeriod), getMonthFromPeriod(currentPeriod));
                return sum + calculateEffectiveCapacity(empAssignment.capacity, empAssignment.fit, empVacationCoeff);
            }
            return sum;
        }, 0);
    const capacityForRevenue = Math.max(project.employeeCapacity, totalEffectiveCapacity);
    const revenuePerEffectiveCapacity = project.budget / capacityForRevenue;
    return revenuePerEffectiveCapacity * effectiveCapacity;
}

function calculateEmployeeCost(employee, assignment) {
    return employee.salary * Math.max(0.5, assignment.capacity);
}

function calculateBenchCost(employee) {
    return employee.salary * 0.5;
}

// ОСНОВНЫЕ CRUD ОПЕРАЦИИ
function deleteEmployee(employeeId) {
    const employees = getCurrentEmployees();
    const index = employees.findIndex(e => e.id === employeeId);
    if (index !== -1) {
        employees.splice(index, 1);
        saveToLocalStorage();
        renderEmployeesTable();
    }
}

function attachEmployeeDeleteButtons() {
    document.querySelectorAll('.delete-employee-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            if (confirm('Delete this employee?')) {
                deleteEmployee(id);
            }
        };
    });
}

function deleteProject(projectId) {
    const projects = getCurrentProjects();
    const index = projects.findIndex(p => p.id === projectId);
    if (index !== -1) {
        projects.splice(index, 1);
        // отвязать сотрудников
        const employees = getCurrentEmployees();
        employees.forEach(emp => {
            if (emp.projectAssignments) {
                emp.projectAssignments = emp.projectAssignments.filter(a => a.projectId !== projectId);
            }
        });
        saveToLocalStorage();
        renderProjectsTable();
        renderEmployeesTable();
    }
}

// INLINE EDITING (Position, Salary)
function makeEditable() {
    const table = document.querySelector('#employeesTable');
    if (!table) return;

    // Функция для поля Position
    function editPosition(cell, employeeId, currentValue) {
        const select = document.createElement('select');
        select.innerHTML = `
            <option value="Junior">Junior</option>
            <option value="Middle">Middle</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead</option>
            <option value="Architect">Architect</option>
            <option value="BO">BO</option>
        `;
        select.value = currentValue;
        cell.innerHTML = '';
        cell.appendChild(select);
        select.focus();

        const save = () => {
            const newValue = select.value;
            if (newValue !== currentValue) {
                // Обновляем данные
                const employees = getCurrentEmployees();
                const emp = employees.find(e => e.id === employeeId);
                if (emp) {
                    emp.position = newValue;
                    saveToLocalStorage();
                    // Обновляем ячейку без перерисовки всей таблицы
                    cell.innerHTML = escapeHtml(newValue);
                    // Возвращаем курсор
                    cell.style.cursor = 'pointer';
                    // Перепривязываем обработчик клика (можно просто заново вызвать makeEditable для этой ячейки)
                    makeEditable(); // перевесит обработчики на всей таблице, но не перерисует строки
                } else {
                    cell.innerHTML = escapeHtml(currentValue);
                }
            } else {
                cell.innerHTML = escapeHtml(currentValue);
            }
            cell.removeAttribute('data-editing');
        };

        select.addEventListener('blur', save);
        select.addEventListener('change', () => select.blur());
        // Запрещаем всплытие, чтобы не вызвать повторное редактирование
        select.addEventListener('click', (e) => e.stopPropagation());
        cell.setAttribute('data-editing', 'true');
    }

    // Функция для поля Salary
    function editSalary(cell, employeeId, currentSalary) {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '100';
        input.value = currentSalary;
        input.style.width = '100px';
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();

        const save = () => {
            let newSalary = parseFloat(input.value);
            if (isNaN(newSalary) || newSalary <= 0) newSalary = currentSalary;
            if (newSalary !== currentSalary) {
                const employees = getCurrentEmployees();
                const emp = employees.find(e => e.id === employeeId);
                if (emp) {
                    emp.salary = newSalary;
                    emp.estimatedPayment = newSalary;
                    saveToLocalStorage();
                    cell.innerHTML = `$${newSalary.toFixed(0)}`;
                } else {
                    cell.innerHTML = `$${currentSalary.toFixed(0)}`;
                }
            } else {
                cell.innerHTML = `$${currentSalary.toFixed(0)}`;
            }
            cell.style.cursor = 'pointer';
            makeEditable();
            cell.removeAttribute('data-editing');
        };

        input.addEventListener('blur', save);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') input.blur(); });
        input.addEventListener('click', (e) => e.stopPropagation());
        cell.setAttribute('data-editing', 'true');
    }

    // Навешиваем обработчики на все ячейки, которые ещё не редактируются и не имеют обработчика
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const deleteBtn = row.querySelector('.delete-employee-btn');
        if (!deleteBtn) return;
        const employeeId = parseInt(deleteBtn.dataset.id);
        if (isNaN(employeeId)) return;

        const positionCell = row.cells[3];
        const salaryCell = row.cells[4];

        if (positionCell && !positionCell.hasAttribute('data-editable') && !positionCell.hasAttribute('data-editing')) {
            positionCell.setAttribute('data-editable', 'true');
            positionCell.style.cursor = 'pointer';
            positionCell.onclick = (e) => {
                e.stopPropagation();
                if (positionCell.hasAttribute('data-editing')) return;
                const currentValue = positionCell.textContent.trim();
                editPosition(positionCell, employeeId, currentValue);
            };
        }

        if (salaryCell && !salaryCell.hasAttribute('data-editable') && !salaryCell.hasAttribute('data-editing')) {
            salaryCell.setAttribute('data-editable', 'true');
            salaryCell.style.cursor = 'pointer';
            salaryCell.onclick = (e) => {
                e.stopPropagation();
                if (salaryCell.hasAttribute('data-editing')) return;
                const currentSalary = parseFloat(salaryCell.textContent.replace('$', ''));
                editSalary(salaryCell, employeeId, currentSalary);
            };
        }
    });
}

// УПРАВЛЕНИЕ НАЗНАЧЕНИЯМИ
function saveAssignment(employeeId, projectId, capacity, fit) {
    const employees = getCurrentEmployees();
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    if (!employee.projectAssignments) employee.projectAssignments = [];
    const existingIndex = employee.projectAssignments.findIndex(a => a.projectId === projectId);
    if (existingIndex !== -1) {
        employee.projectAssignments[existingIndex] = { projectId, capacity, fit };
    } else {
        employee.projectAssignments.push({ projectId, capacity, fit });
    }
    saveToLocalStorage();
    renderEmployeesTable();
    renderProjectsTable();
}

function showUnassignConfirmation(employeeId, projectId, assignment) {
    const employee = getCurrentEmployees().find(e => e.id === employeeId);
    const project = getCurrentProjects().find(p => p.id === projectId);
    if (!employee || !project) return;
    const [year, month] = currentPeriod.split('-').map(Number);
    const vacationCoeff = calculateVacationCoefficient(employee.vacationDays, year, month);
    const revenue = calculateEmployeeRevenue(employee, project, assignment, vacationCoeff, getCurrentEmployees());
    const cost = employee.salary * Math.max(0.5, assignment.capacity);
    const profitImpact = revenue - cost;

    const overlayConfirm = document.createElement('div');
    overlayConfirm.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1200;display:flex;align-items:center;justify-content:center;';
    const popupConfirm = document.createElement('div');
    popupConfirm.style.cssText = 'background:white;border-radius:16px;padding:24px;width:450px;max-width:90vw;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    popupConfirm.innerHTML = `
        <h3 style="margin-top:0;">Confirm Unassignment</h3>
        <p><strong>Employee:</strong> ${escapeHtml(employee.name)} ${escapeHtml(employee.surname)}</p>
        <p><strong>Project:</strong> ${escapeHtml(project.projectName)}</p>
        <p><strong>Capacity:</strong> ${assignment.capacity.toFixed(2)}</p>
        <p><strong>Fit:</strong> ${assignment.fit.toFixed(2)}</p>
        <hr>
        <p><strong>Financial Impact:</strong></p>
        <p>Revenue: <span style="color:#27ae60;">+$${revenue.toFixed(2)}</span> → <span style="color:#e74c3c;">$0</span></p>
        <p>Cost: <span style="color:#e74c3c;">-$${cost.toFixed(2)}</span> → <span style="color:#27ae60;">$0</span></p>
        <p><strong>Net Change: <span style="color:${profitImpact >= 0 ? '#e74c3c' : '#27ae60'};">${profitImpact >= 0 ? '-' : '+'}$${Math.abs(profitImpact).toFixed(2)}</span></strong></p>
        <div style="display:flex;gap:12px;margin-top:20px;">
            <button id="confirmUnassign" style="flex:1;padding:10px;background:#27ae60;color:white;border:none;border-radius:8px;cursor:pointer;">Confirm</button>
            <button id="cancelUnassign" style="flex:1;padding:10px;background:#e74c3c;color:white;border:none;border-radius:8px;cursor:pointer;">Cancel</button>
        </div>
    `;
    overlayConfirm.appendChild(popupConfirm);
    document.body.appendChild(overlayConfirm);

    const cleanup = () => overlayConfirm.remove();
    popupConfirm.querySelector('#confirmUnassign').onclick = () => {
        const employeesList = getCurrentEmployees();
        const emp = employeesList.find(e => e.id === employeeId);
        if (emp && emp.projectAssignments) {
            emp.projectAssignments = emp.projectAssignments.filter(a => a.projectId !== projectId);
            saveToLocalStorage();
            renderEmployeesTable();
            renderProjectsTable();
            // Закрываем попап проекта, если он открыт
            const projOverlay = document.querySelector('#projectEmployeesOverlay');
            if (projOverlay) {
                // Находим кнопку закрытия и кликаем
                const closeBtn = projOverlay.querySelector('.close-popup-btn');
                if (closeBtn) closeBtn.click();
            }
        }
        cleanup();
    };
    popupConfirm.querySelector('#cancelUnassign').onclick = cleanup;
    overlayConfirm.onclick = (e) => { if (e.target === overlayConfirm) cleanup(); };
}

// ПОЗИЦИОНИРОВАНИЕ ПОПАПА НАЗНАЧЕНИЯ
function positionPopup(popup, triggerElement) {
    if (!popup || !triggerElement) return;
    const rect = triggerElement.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let top = rect.bottom + window.scrollY + 5;
    let left = rect.left + window.scrollX;
    if (left + popupRect.width > viewportWidth) left = viewportWidth - popupRect.width - 10;
    if (left < 10) left = 10;
    if (top + popupRect.height > window.scrollY + viewportHeight) {
        top = rect.top + window.scrollY - popupRect.height - 5;
    }
    if (top < window.scrollY + 10) top = window.scrollY + 10;
    popup.style.position = 'fixed';
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
}

let currentAssignmentOverlay = null;

function openAssignmentPopupWithPosition(employeeId, projectId, onSave, triggerButton) {
    if (currentAssignmentOverlay) {
        currentAssignmentOverlay.remove();
        currentAssignmentOverlay = null;
    }
    const employee = getCurrentEmployees().find(e => e.id === employeeId);
    const project = getCurrentProjects().find(p => p.id === projectId);
    if (!employee || !project) return;
    const existingAssignment = employee.projectAssignments?.find(a => a.projectId === projectId);
    const currentCapacity = existingAssignment?.capacity || 0.5;
    const currentFit = existingAssignment?.fit || 0.8;
    const totalAssigned = employee.projectAssignments?.reduce((sum, a) => sum + (a.capacity || 0), 0) || 0;
    const popup = document.createElement('div');
    popup.style.cssText = 'background:white;border-radius:16px;padding:20px;width:300px;box-shadow:0 4px 20px rgba(0,0,0,0.25);z-index:1200;border:1px solid #ddd;';
    popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0;font-size:15px;">${existingAssignment ? 'Edit' : 'Assign'} Employee</h3>
        <button class="close-assign-popup" style="background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
    </div>
    <p style="margin:0 0 6px 0;font-size:12px;"><strong>${escapeHtml(employee.name)} ${escapeHtml(employee.surname)}</strong> → ${escapeHtml(project.projectName)}</p>
    <p style="margin:0 0 6px 0;font-size:11px;">Used: ${totalAssigned.toFixed(2)}/1.5</p>
    <div style="margin:8px 0;">
        <label style="display:block;margin-bottom:2px;font-size:11px;">Capacity (0-1.5):</label>
        <input type="range" id="assignCapacity" min="0" max="1.5" step="0.1" value="${currentCapacity}" style="width:100%;">
        <span id="capacityValue" style="font-size:11px;">${currentCapacity.toFixed(1)}</span>
    </div>
    <div style="margin:8px 0;">
        <label style="display:block;margin-bottom:2px;font-size:11px;">Fit (0-1):</label>
        <input type="range" id="assignFit" min="0" max="1" step="0.1" value="${currentFit}" style="width:100%;">
        <span id="fitValue" style="font-size:11px;">${currentFit.toFixed(1)}</span>
    </div>
    <div id="assignWarning" style="color:#e74c3c;margin:6px 0;font-size:11px;display:none;">Limit exceeded</div>
    <div style="display:flex;gap:8px;margin-top:10px;">
        <button id="assignSaveBtn" style="flex:1;padding:5px;background:#27ae60;color:white;border:none;border-radius:5px;cursor:pointer;">Save</button>
        <button id="assignCancelBtn" style="flex:1;padding:5px;background:#e74c3c;color:white;border:none;border-radius:5px;cursor:pointer;">Cancel</button>
    </div>
`;
    document.body.appendChild(popup);
    currentAssignmentOverlay = popup;
    if (triggerButton) positionPopup(popup, triggerButton);
    const capacitySlider = popup.querySelector('#assignCapacity');
    const fitSlider = popup.querySelector('#assignFit');
    const warning = popup.querySelector('#assignWarning');
    function updateWarning() {
        const newCap = parseFloat(capacitySlider.value);
        const newTotal = totalAssigned - currentCapacity + newCap;
        warning.style.display = newTotal <= 1.5 ? 'none' : 'block';
    }
    capacitySlider.addEventListener('input', updateWarning);
    let repositionTimeout;
    const updatePosition = () => { if (triggerButton && document.body.contains(popup)) positionPopup(popup, triggerButton); };
    const handleScroll = () => { if (repositionTimeout) clearTimeout(repositionTimeout); repositionTimeout = setTimeout(updatePosition, 10); };
    const handleResize = () => updatePosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    const cleanup = () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
        if (currentAssignmentOverlay === popup) currentAssignmentOverlay = null;
        popup.remove();
    };
    popup.querySelector('#assignSaveBtn').onclick = () => {
        const newCap = parseFloat(capacitySlider.value);
        const newFit = parseFloat(fitSlider.value);
        const newTotal = totalAssigned - currentCapacity + newCap;
        if (newTotal > 1.5) { alert(`Total capacity would exceed 1.5!`); return; }
        if (onSave) onSave(employeeId, projectId, newCap, newFit);
        cleanup();
    };
    popup.querySelector('#assignCancelBtn').onclick = cleanup;
    popup.querySelector('.close-assign-popup').onclick = cleanup;
}

// КАЛЕНДАРЬ ОТПУСКОВ
let selectedVacationDays = [];
function getWorkingDaysInMonth(year, month) {
    const date = new Date(year, month, 1);
    let workingDays = 0;
    while (date.getMonth() === month) {
        const dow = date.getDay();
        if (dow !== 0 && dow !== 6) workingDays++;
        date.setDate(date.getDate() + 1);
    }
    return workingDays;
}
function formatVacationDays(days, year, month) {
    if (!days || days.length === 0) return 'None';
    const sorted = [...days].sort((a,b)=>a-b);
    const ranges = [];
    let start = sorted[0], end = sorted[0];
    for (let i=1; i<=sorted.length; i++) {
        const cur = sorted[i], prev = sorted[i-1];
        if (cur === prev+1) { end = cur; }
        else {
            if (start === end) ranges.push(`${String(start).padStart(2,'0')}.${String(month+1).padStart(2,'0')}`);
            else ranges.push(`${String(start).padStart(2,'0')}.${String(month+1).padStart(2,'0')}-${String(end).padStart(2,'0')}.${String(month+1).padStart(2,'0')}`);
            start = cur; end = cur;
        }
    }
    return ranges.join(', ');
}
function openAvailabilityCalendar(employeeId) {
    const employee = getCurrentEmployees().find(e => e.id === employeeId);
    if (!employee) return;
    const [year, month] = currentPeriod.split('-').map(Number);
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
    selectedVacationDays = [...(employee.vacationDays || [])];
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const weekdays = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1200;display:flex;align-items:center;justify-content:center;';
    const popup = document.createElement('div');
    popup.style.cssText = 'background:white;border-radius:20px;width:550px;max-width:90vw;box-shadow:0 4px 25px rgba(0,0,0,0.2);overflow:hidden;';
    popup.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#4a6a8a;color:white;">
            <h3>Availability</h3>
            <button id="calendarCloseBtn" style="background:none;border:none;color:white;font-size:24px;">&times;</button>
        </div>
        <div style="padding:20px;">
            <p><strong>Employee:</strong> ${escapeHtml(employee.name)} ${escapeHtml(employee.surname)}</p>
            <p><strong>Period:</strong> ${monthNames[month]} ${year}</p>
            <div id="calendarGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin:15px 0;"></div>
            <div style="display:flex;justify-content:space-between;margin-top:15px;padding:12px;background:#f5f5f5;border-radius:10px;">
                <div><span style="font-weight:bold;">Working Days:</span> <span id="workingDaysDisplay" style="margin-left:8px;color:#27ae60;"></span></div>
                <div><span style="font-weight:bold;">Vacation Days:</span> <span id="vacationCountDisplay" style="margin-left:8px;color:#e74c3c;"></span></div>
            </div>
            <div style="margin-top:12px;padding:10px;background:#e8f4f8;border-radius:10px;">
                <span style="font-weight:bold;">Selected Vacation Days:</span> <span id="vacationDaysDisplay" style="margin-left:8px;"></span>
            </div>
            <div style="display:flex;gap:12px;margin-top:20px;">
                <button id="saveVacationBtn" style="flex:1;padding:10px;background:#27ae60;color:white;border:none;border-radius:8px;">Set Vacation</button>
                <button id="clearVacationBtn" style="flex:1;padding:10px;background:#e74c3c;color:white;border:none;border-radius:8px;">Clear All</button>
            </div>
        </div>
    `;
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    function updateDisplay() {
        const totalWork = getWorkingDaysInMonth(year, month);
        const vacationWork = selectedVacationDays.filter(day => { const d = new Date(year, month, day); const dow = d.getDay(); return dow !== 0 && dow !== 6; }).length;
        const actual = totalWork - vacationWork;
        document.getElementById('workingDaysDisplay').innerText = `${actual}/${totalWork}`;
        document.getElementById('vacationCountDisplay').innerText = `${selectedVacationDays.length}`;
        document.getElementById('vacationDaysDisplay').innerText = formatVacationDays(selectedVacationDays, year, month);
        renderCalendar();
    }
    function renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;
        grid.innerHTML = '';
        weekdays.forEach(day => { const h = document.createElement('div'); h.style.cssText = 'padding:8px;text-align:center;font-weight:bold;color:#4a6a8a;'; h.innerText = day; grid.appendChild(h); });
        for (let i=0; i<firstDay; i++) { const empty = document.createElement('div'); empty.style.cssText = 'padding:8px;text-align:center;background:#f9f9f9;color:#ccc;border-radius:8px;'; empty.innerText = ''; grid.appendChild(empty); }
        for (let d=1; d<=daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dow = date.getDay();
            const isWeekend = dow === 0 || dow === 6;
            const isToday = isCurrentMonth && today.getDate() === d;
            const isVac = selectedVacationDays.includes(d);
            const cell = document.createElement('div');
            cell.style.cssText = `padding:10px 8px;text-align:center;cursor:pointer;border-radius:8px;background:${isVac ? '#ffebee' : (isWeekend ? '#f5f5f5' : 'white')};color:${isVac ? '#e74c3c' : (isWeekend ? '#999' : '#333')};font-weight:${isToday ? 'bold' : 'normal'};border:${isToday ? '2px solid #4a6a8a' : '1px solid #e0e0e0'};`;
            cell.innerText = d;
            cell.onclick = () => {
                if (selectedVacationDays.includes(d)) selectedVacationDays = selectedVacationDays.filter(v => v !== d);
                else { selectedVacationDays.push(d); selectedVacationDays.sort((a,b)=>a-b); }
                updateDisplay();
            };
            grid.appendChild(cell);
        }
    }
    document.getElementById('saveVacationBtn').onclick = () => {
        const emp = getCurrentEmployees().find(e => e.id === employeeId);
        if (emp) { emp.vacationDays = [...selectedVacationDays]; saveToLocalStorage(); renderEmployeesTable(); renderProjectsTable(); alert(`Vacation saved for ${emp.name}`); }
        overlay.remove();
    };
    document.getElementById('clearVacationBtn').onclick = () => { selectedVacationDays = []; updateDisplay(); };
    document.getElementById('calendarCloseBtn').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    updateDisplay();
}
function addAvailabilityButtons() {
    const rows = document.querySelectorAll('#employeesTable tbody tr');
    rows.forEach(row => {
        const delBtn = row.querySelector('.delete-employee-btn');
        const empId = delBtn ? parseInt(delBtn.dataset.id) : null;
        const actionsCell = row.cells[8];
        if (actionsCell && empId && !actionsCell.querySelector('.availability-btn')) {
            const availBtn = document.createElement('button');
            availBtn.textContent = 'Availability';
            availBtn.className = 'availability-btn';
            availBtn.style.cssText = 'background:#663399;border:none;color:white;padding:5px 10px;border-radius:5px;cursor:pointer;margin:5px 5px 5px 0;';
            availBtn.onclick = () => openAvailabilityCalendar(empId);
            actionsCell.insertBefore(availBtn, delBtn);
        }
    });
}

// ПОПАПЫ ДЕТАЛЕЙ (Show Employees, Show Assignments)
function showProjectEmployees(projectId) {
    const project = getCurrentProjects().find(p => p.id === projectId);
    if (!project) return;
    const employees = getCurrentEmployees();
    const projEmps = employees.filter(emp => emp.projectAssignments?.some(a => a.projectId === projectId));
    const [year, month] = currentPeriod.split('-').map(Number);
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    // Удаляем предыдущий попап
    const existingOverlay = document.querySelector('#projectEmployeesOverlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'projectEmployeesOverlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1100;display:flex;align-items:center;justify-content:center;';
    const popup = document.createElement('div');
    popup.style.cssText = 'background:white;border-radius:16px;width:90%;max-width:1300px;max-height:85vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.3);';

    if (projEmps.length === 0) {
        popup.innerHTML = `<div style="display:flex;justify-content:space-between;padding:16px 20px;background:#4a6a8a;color:white;"><h3>Employees in "${escapeHtml(project.projectName)}"</h3><button class="close-popup-btn" style="background:none;border:none;color:white;font-size:24px;">&times;</button></div>
                          <div style="padding:40px;text-align:center;"><p>No employees assigned to this project.</p></div>`;
    } else {
        let rows = '';
        projEmps.forEach(emp => {
            const assign = emp.projectAssignments.find(a => a.projectId === projectId);
            if (assign) {
                const vacCoeff = calculateVacationCoefficient(emp.vacationDays, year, month);
                const effCap = assign.capacity * assign.fit * vacCoeff;
                const revenue = calculateEmployeeRevenue(emp, project, assign, vacCoeff, employees);
                const cost = calculateEmployeeCost(emp, assign);
                const profit = revenue - cost;
                const vacationDaysCount = emp.vacationDays?.length || 0;
                rows += `<tr>
                    <td style="padding:10px; border-bottom:1px solid #eee;">
                        <span class="employee-name-link" data-employee-id="${emp.id}" data-project-id="${projectId}" style="color:#2c3e50; text-decoration:underline; cursor:pointer;">${escapeHtml(emp.name)} ${escapeHtml(emp.surname)}</span>
                    </td>
                    <td style="padding:10px; text-align:center; border-bottom:1px solid #eee;">${assign.capacity.toFixed(2)}</td>
                    <td style="padding:10px; text-align:center; border-bottom:1px solid #eee;">${assign.fit.toFixed(2)}</td>
                    <td style="padding:10px; text-align:center; border-bottom:1px solid #eee;">${vacationDaysCount}</td>
                    <td style="padding:10px; text-align:center; font-weight:bold; border-bottom:1px solid #eee;">${effCap.toFixed(3)}</td>
                    <td style="padding:10px; text-align:center; color:#27ae60; border-bottom:1px solid #eee;">$${revenue.toFixed(2)}</td>
                    <td style="padding:10px; text-align:center; color:#e74c3c; border-bottom:1px solid #eee;">$${cost.toFixed(2)}</td>
                    <td style="padding:10px; text-align:center; color:${profit>=0?'#27ae60':'#e74c3c'}; border-bottom:1px solid #eee;">$${profit.toFixed(2)}</td>
                    <td style="padding:10px; text-align:center; border-bottom:1px solid #eee;">
                        <button class="edit-assignment-btn" data-employee-id="${emp.id}" style="background:#4a6a8a;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;margin-right:5px;">Edit</button>
                        <button class="unassign-employee-btn" data-employee-id="${emp.id}" data-project-id="${projectId}" style="background:#e74c3c;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">Unassign</button>
                    </td>
                </tr>`;
            }
        });

        // Итоги
        let totEff = 0, totRev = 0, totCost = 0, totProfit = 0;
        projEmps.forEach(emp => {
            const assign = emp.projectAssignments.find(a => a.projectId === projectId);
            if (assign) {
                const vacCoeff = calculateVacationCoefficient(emp.vacationDays, year, month);
                totEff += assign.capacity * assign.fit * vacCoeff;
                const rev = calculateEmployeeRevenue(emp, project, assign, vacCoeff, employees);
                const cost = calculateEmployeeCost(emp, assign);
                totRev += rev;
                totCost += cost;
                totProfit += (rev - cost);
            }
        });

        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:#4a6a8a;color:white;position:sticky;top:0;">
                <h3 style="margin:0;">Employees in "${escapeHtml(project.projectName)}" (${monthNames[month]} ${year})</h3>
                <button class="close-popup-btn" style="background:none;border:none;color:white;font-size:28px;cursor:pointer;">&times;</button>
            </div>
            <div style="padding:20px; overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f0f2f5;">
                            <th>Employee</th><th>Capacity</th><th>Fit</th><th>Vacation</th><th>Effective</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background:#f0f2f5; font-weight:bold;">
                            <td colspan="4">Total:</td>
                            <td style="text-align:center;">${totEff.toFixed(3)}</td>
                            <td style="text-align:center;">$${totRev.toFixed(2)}</td>
                            <td style="text-align:center;">$${totCost.toFixed(2)}</td>
                            <td style="text-align:center; color:${totProfit>=0?'#27ae60':'#e74c3c'};">$${totProfit.toFixed(2)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Функция закрытия попапа
    const closePopup = () => overlay.remove();
    popup.querySelector('.close-popup-btn').onclick = closePopup;
    overlay.onclick = (e) => { if (e.target === overlay) closePopup(); };

    // Функция обновления попапа (переоткрытие)
    const refreshPopup = () => {
        overlay.remove();
        setTimeout(() => showProjectEmployees(projectId), 50);
    };

    // Обработчики для кнопок Unassign (с финансовым попапом)
    popup.querySelectorAll('.unassign-employee-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const empId = parseInt(btn.dataset.employeeId);
            const projId = parseInt(btn.dataset.projectId);
            const emp = getCurrentEmployees().find(e => e.id === empId);
            if (!emp) return;
            const assignment = emp.projectAssignments?.find(a => a.projectId === projId);
            if (assignment) {
                showUnassignConfirmation(empId, projId, assignment);
            }
        });
    });

    // Обработчики для кнопок Edit
    popup.querySelectorAll('.edit-assignment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const empId = parseInt(btn.dataset.employeeId);
            const emp = getCurrentEmployees().find(e => e.id === empId);
            if (!emp) return;
            const currentAssignment = emp.projectAssignments?.find(a => a.projectId === projectId);
            if (!currentAssignment) return;
            const saveAndRefresh = (employeeId, projectId, newCapacity, newFit) => {
                saveAssignment(employeeId, projectId, newCapacity, newFit);
                refreshPopup();
            };
            openAssignmentPopupWithPosition(empId, projectId, saveAndRefresh, e.target);
        });
    });

    // ========== КЛИКАБЕЛЬНЫЕ ИМЕНА – МЕНЮ ДЕЙСТВИЙ ==========
    popup.querySelectorAll('.employee-name-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            const empId = parseInt(link.dataset.employeeId);
            const emp = getCurrentEmployees().find(e => e.id === empId);
            if (!emp) return;

            // Удаляем предыдущее меню
            const existingMenu = document.querySelector('.employee-action-menu');
            if (existingMenu) existingMenu.remove();

            // Создаём меню с двумя пунктами
            const menu = document.createElement('div');
            menu.className = 'employee-action-menu';
            menu.style.cssText = 'position:fixed; background:white; border:1px solid #ccc; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.2); z-index:1300; min-width:180px;';
            menu.innerHTML = `
            <div style="padding:8px 12px; border-bottom:1px solid #eee; font-weight:bold; background:#f5f5f5;">${escapeHtml(emp.name)} ${escapeHtml(emp.surname)}</div>
            <div class="menu-item" data-action="employeesTab" style="padding:8px 12px; cursor:pointer;">See in Employees Tab</div>
            <div class="menu-item" data-action="unassign" style="padding:8px 12px; cursor:pointer;">Unassign from Project</div>
        `;
            const rect = link.getBoundingClientRect();
            menu.style.left = rect.left + 'px';
            menu.style.top = (rect.bottom + 5) + 'px';
            document.body.appendChild(menu);

            // Упрощённая обработка действий (только employeesTab и unassign)
            const handleAction = (action) => {
                menu.remove();
                if (action === 'employeesTab') {
                    document.querySelector('.nav__link[data-page="employees"]').click();
                    setTimeout(() => {
                        const row = document.querySelector(`#employeesTable .delete-employee-btn[data-id="${empId}"]`);
                        if (row) row.closest('tr').scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                } else if (action === 'unassign') {
                    const assignment = emp.projectAssignments?.find(a => a.projectId === projectId);
                    if (assignment) showUnassignConfirmation(empId, projectId, assignment);
                }
            };

            menu.querySelectorAll('.menu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleAction(item.dataset.action);
                });
            });

            // Закрытие меню при клике вне
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) menu.remove();
                document.removeEventListener('click', closeMenu);
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        });
    });
}

function showEmployeeAssignments(employeeId) {
    const employee = getCurrentEmployees().find(e => e.id === employeeId);
    if (!employee) return;
    const projects = getCurrentProjects();
    const assignments = employee.projectAssignments || [];
    const [year, month] = currentPeriod.split('-').map(Number);
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1100;display:flex;align-items:center;justify-content:center;';
    const popup = document.createElement('div');
    popup.style.cssText = 'background:white;border-radius:16px;width:90%;max-width:1100px;max-height:80vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.3);';

    if (assignments.length === 0) {
        popup.innerHTML = `<div style="display:flex;justify-content:space-between;padding:12px 16px;background:#4a6a8a;color:white;"><h3 style="margin:0;">Projects for ${escapeHtml(employee.name)} ${escapeHtml(employee.surname)}</h3><button class="close-popup-btn" style="background:none;border:none;color:white;font-size:24px;">&times;</button></div>
                          <div style="padding:40px;text-align:center;">No assignments for this employee.</div>`;
    } else {
        let rows = '';
        assignments.forEach(assign => {
            const proj = projects.find(p => p.id === assign.projectId);
            if (proj) {
                const vacCoeff = calculateVacationCoefficient(employee.vacationDays, year, month);
                const effCap = assign.capacity * assign.fit * vacCoeff;
                const revenue = calculateEmployeeRevenue(employee, proj, assign, vacCoeff, getCurrentEmployees());
                const cost = employee.salary * Math.max(0.5, assign.capacity);
                const profit = revenue - cost;
                rows += `<tr>
                    <td style="padding:8px;">${escapeHtml(proj.projectName)}</td>
                    <td style="text-align:center;">${assign.capacity.toFixed(2)}</td>
                    <td style="text-align:center;">${assign.fit.toFixed(2)}</td>
                    <td style="text-align:center;">${employee.vacationDays?.length || 0}</td>
                    <td style="text-align:center;">${effCap.toFixed(3)}</td>
                    <td style="text-align:center;color:#27ae60;">$${Math.round(revenue)}</td>
                    <td style="text-align:center;color:#e74c3c;">$${Math.round(cost)}</td>
                    <td style="text-align:center;color:${profit>=0?'#27ae60':'#e74c3c'};">$${Math.round(profit)}</td>
                </tr>`;
            }
        });
        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#4a6a8a;color:white;">
                <h3 style="margin:0;">${escapeHtml(employee.name)} ${escapeHtml(employee.surname)} – Projects (${monthNames[month]} ${year})</h3>
                <button class="close-popup-btn" style="background:none;border:none;color:white;font-size:24px;">&times;</button>
            </div>
            <div style="padding:16px; overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead><tr style="background:#f0f2f5;"><th>Project</th><th>Capacity</th><th>Fit</th><th>Vacation</th><th>Effective</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    popup.querySelector('.close-popup-btn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
}

function addAssignButtonsWithPositioning() {
    document.querySelectorAll('#employeesTable tbody tr').forEach(row => {
        const deleteBtn = row.querySelector('.delete-employee-btn');
        const employeeId = deleteBtn ? parseInt(deleteBtn.dataset.id) : null;
        const actionsCell = row.cells[8];
        if (actionsCell && employeeId && !actionsCell.querySelector('.assign-btn')) {
            const totalAssigned = (getCurrentEmployees().find(e => e.id === employeeId)?.projectAssignments?.reduce((s,a)=>s+(a.capacity||0),0)||0);
            const available = 1.5 - totalAssigned;
            const isMax = totalAssigned >= 1.5;
            const assignBtn = document.createElement('button');
            assignBtn.textContent = 'Assign';
            assignBtn.className = 'assign-btn';
            assignBtn.disabled = isMax;
            assignBtn.style.cssText = `background:${isMax ? '#95a5a6' : '#27ae60'};border:none;color:white;padding:5px 10px;border-radius:5px;cursor:${isMax ? 'not-allowed' : 'pointer'};margin-right:5px;opacity:${isMax ? '0.6' : '1'};`;
            assignBtn.onclick = () => {
                if (isMax) return; // дополнительная страховка, но кнопка уже disabled
                const projects = getCurrentProjects();
                if (!projects.length) { alert('No projects available'); return; }

                // Создаём модальное окно с дропдауном и информацией о загрузке
                const selectOverlay = document.createElement('div');
                selectOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1150;display:flex;align-items:center;justify-content:center;';
                const selectPopup = document.createElement('div');
                selectPopup.style.cssText = 'background:white;border-radius:16px;padding:20px;width:320px;';
                selectPopup.innerHTML = `
                    <h3 style="margin:0 0 12px 0;font-size:18px;">Assign Employee</h3>
                    <div style="background:#f0f2f8;padding:10px;border-radius:8px;margin-bottom:15px;">
                        <p style="margin:0 0 5px 0;"><strong>Employee:</strong> ${escapeHtml(getCurrentEmployees().find(e=>e.id===employeeId)?.name)} ${escapeHtml(getCurrentEmployees().find(e=>e.id===employeeId)?.surname)}</p>
                        <p style="margin:0 0 5px 0;"><strong>Current Capacity:</strong> ${totalAssigned.toFixed(2)} / 1.5</p>
                        <p style="margin:0;"><strong>Available:</strong> ${available.toFixed(2)}</p>
                    </div>
                    <label style="display:block;margin-bottom:8px;">Select Project:</label>
                    <select id="projectSelect" style="width:100%;padding:10px;margin-bottom:20px;border-radius:8px;border:1px solid #ccc;">
                        <option value="">-- Select project --</option>
                        ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.projectName)}</option>`).join('')}
                    </select>
                    <div style="display:flex;gap:10px;">
                        <button id="confirmSelect" style="flex:1;padding:8px;background:#27ae60;color:white;border:none;border-radius:8px;cursor:pointer;">Assign</button>
                        <button id="cancelSelect" style="flex:1;padding:8px;background:#e74c3c;color:white;border:none;border-radius:8px;cursor:pointer;">Cancel</button>
                    </div>
                `;
                selectOverlay.appendChild(selectPopup);
                document.body.appendChild(selectOverlay);

                const projectSelect = selectPopup.querySelector('#projectSelect');
                selectPopup.querySelector('#confirmSelect').onclick = () => {
                    const projectId = parseInt(projectSelect.value);
                    if (projectId) {
                        // Назначаем с дефолтными значениями capacity=0.5, fit=0.8
                        // Можно также добавить поля для ввода, но по вашему запросу - без ползунков
                        saveAssignment(employeeId, projectId, 0.5, 0.8);
                        selectOverlay.remove();
                    } else {
                        alert('Please select a project');
                    }
                };
                selectPopup.querySelector('#cancelSelect').onclick = () => selectOverlay.remove();
                selectOverlay.onclick = (e) => { if (e.target === selectOverlay) selectOverlay.remove(); };
            };
            actionsCell.insertBefore(assignBtn, actionsCell.firstChild);
        }
    });
}

function attachProjectButtonsWithPopup() {
    document.querySelectorAll('.delete-project-btn').forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); if (confirm('Delete project?')) deleteProject(parseInt(btn.dataset.id)); };
    });
    document.querySelectorAll('.show-employees-btn').forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); showProjectEmployees(parseInt(btn.dataset.id)); };
    });
}
function attachShowAssignmentsButtons() {
    document.querySelectorAll('.show-assignments-btn').forEach(btn => {
        btn.onclick = (e) => { e.stopPropagation(); showEmployeeAssignments(parseInt(btn.dataset.id)); };
    });
}

// СОРТИРОВКА
let currentSort = { projects: { column: null, direction: 'asc' }, employees: { column: null, direction: 'asc' } };
function addSortIcons() {
    const tables = [
        { id: '#projectsTable', columns: ['Company Name', 'Project Name', 'Budget', 'Employee Capacity', 'Estimated Income'] },
        { id: '#employeesTable', columns: ['Name', 'Surname', 'Age', 'Position', 'Salary', 'Estimated Payment', 'Project', 'Projected Income'] }
    ];
    tables.forEach(({ id, columns }) => {
        const table = document.querySelector(id);
        if (!table) return;
        table.querySelectorAll('thead th').forEach(th => {
            const txt = th.textContent.trim();
            if (columns.some(c => txt.includes(c))) {
                th.classList.add('sortable');
                th.style.cursor = 'pointer';
                if (!th.querySelector('.sort-icon')) {
                    const span = document.createElement('span');
                    span.className = 'sort-icon';
                    span.textContent = '⇅';
                    span.style.marginLeft = '8px';
                    th.appendChild(span);
                }
            }
        });
    });
}
function updateSortIcons(tableType, column, direction) {
    const table = document.querySelector(`#${tableType === 'projects' ? 'projectsTable' : 'employeesTable'}`);
    if (!table) return;
    table.querySelectorAll('thead th').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = '⇅';
    });
    let target = null;
    if (tableType === 'projects') {
        if (column === 'company') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Company'));
        else if (column === 'project') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Project'));
        else if (column === 'budget') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Budget'));
        else if (column === 'capacity') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Capacity'));
        else if (column === 'income') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Income'));
    } else {
        if (column === 'name') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent === 'Name');
        else if (column === 'surname') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent === 'Surname');
        else if (column === 'age') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Age'));
        else if (column === 'position') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Position'));
        else if (column === 'salary') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Salary'));
        else if (column === 'payment') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Payment'));
        else if (column === 'projIncome') target = Array.from(table.querySelectorAll('th')).find(th => th.textContent.includes('Projected'));
    }
    if (target) { const icon = target.querySelector('.sort-icon'); if (icon) icon.textContent = direction === 'asc' ? '↑' : '↓'; }
}
function sortProjectsTable(column, direction) {
    const tbody = document.querySelector('#projectsTable tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;
    rows.sort((a,b) => {
        let va, vb;
        if (column === 'company') { va = a.cells[0]?.textContent || ''; vb = b.cells[0]?.textContent || ''; return direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
        if (column === 'project') { va = a.cells[1]?.textContent || ''; vb = b.cells[1]?.textContent || ''; return direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
        if (column === 'budget') { va = parseFloat(a.cells[2]?.textContent.replace('$','')) || 0; vb = parseFloat(b.cells[2]?.textContent.replace('$','')) || 0; return direction === 'asc' ? va - vb : vb - va; }
        if (column === 'capacity') { va = parseFloat(a.cells[3]?.textContent.split('/')[0]) || 0; vb = parseFloat(b.cells[3]?.textContent.split('/')[0]) || 0; return direction === 'asc' ? va - vb : vb - va; }
        if (column === 'income') { va = parseFloat(a.cells[5]?.textContent.replace('$','')) || 0; vb = parseFloat(b.cells[5]?.textContent.replace('$','')) || 0; return direction === 'asc' ? va - vb : vb - va; }
        return 0;
    });
    rows.forEach(r => tbody.appendChild(r));
    currentSort.projects = { column, direction };
    updateSortIcons('projects', column, direction);
}
function sortEmployeesTable(column, direction) {
    const tbody = document.querySelector('#employeesTable tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;
    rows.sort((a,b) => {
        let va, vb;
        if (column === 'name') { va = a.cells[0]?.textContent || ''; vb = b.cells[0]?.textContent || ''; return direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
        if (column === 'surname') { va = a.cells[1]?.textContent || ''; vb = b.cells[1]?.textContent || ''; return direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
        if (column === 'age') { va = parseInt(a.cells[2]?.textContent) || 0; vb = parseInt(b.cells[2]?.textContent) || 0; return direction === 'asc' ? va - vb : vb - va; }
        if (column === 'position') { va = a.cells[3]?.textContent || ''; vb = b.cells[3]?.textContent || ''; return direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
        if (column === 'salary') { va = parseFloat(a.cells[4]?.textContent.replace('$','')) || 0; vb = parseFloat(b.cells[4]?.textContent.replace('$','')) || 0; return direction === 'asc' ? va - vb : vb - va; }
        if (column === 'payment') { va = parseFloat(a.cells[5]?.textContent.replace('$','')) || 0; vb = parseFloat(b.cells[5]?.textContent.replace('$','')) || 0; return direction === 'asc' ? va - vb : vb - va; }
        if (column === 'project') { va = a.cells[6]?.textContent || ''; vb = b.cells[6]?.textContent || ''; return direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
        if (column === 'projIncome') { va = parseFloat(a.cells[7]?.textContent.replace('$','')) || 0; vb = parseFloat(b.cells[7]?.textContent.replace('$','')) || 0; return direction === 'asc' ? va - vb : vb - va; }
        return 0;
    });
    rows.forEach(r => tbody.appendChild(r));
    currentSort.employees = { column, direction };
    updateSortIcons('employees', column, direction);
}
function setupSorting() {
    const pTable = document.querySelector('#projectsTable');
    if (pTable) {
        pTable.querySelectorAll('thead th.sortable').forEach(th => {
            th.onclick = () => {
                const txt = th.textContent.toLowerCase();
                let col = '';
                if (txt.includes('company')) col = 'company';
                else if (txt.includes('project')) col = 'project';
                else if (txt.includes('budget')) col = 'budget';
                else if (txt.includes('capacity')) col = 'capacity';
                else if (txt.includes('income')) col = 'income';
                if (col) {
                    let dir = 'asc';
                    if (currentSort.projects.column === col && currentSort.projects.direction === 'asc') dir = 'desc';
                    sortProjectsTable(col, dir);
                }
            };
        });
    }
    const eTable = document.querySelector('#employeesTable');
    if (eTable) {
        eTable.querySelectorAll('thead th.sortable').forEach(th => {
            th.onclick = () => {
                const txt = th.textContent.toLowerCase();
                let col = '';
                if (txt.includes('name') && !txt.includes('surname')) col = 'name';
                else if (txt.includes('surname')) col = 'surname';
                else if (txt.includes('age')) col = 'age';
                else if (txt.includes('position')) col = 'position';
                else if (txt.includes('salary')) col = 'salary';
                else if (txt.includes('payment')) col = 'payment';
                else if (txt.includes('project')) col = 'project';
                else if (txt.includes('income')) col = 'projIncome';
                if (col) {
                    let dir = 'asc';
                    if (currentSort.employees.column === col && currentSort.employees.direction === 'asc') dir = 'desc';
                    sortEmployeesTable(col, dir);
                }
            };
        });
    }
}

// ФИЛЬТРАЦИЯ
let activeFilters = { projects: {}, employees: {} };
function createFilterPopup(column, type, values, currentFilter) {
    const popup = document.createElement('div');
    popup.style.cssText = 'position:fixed;background:white;border:1px solid #ddd;border-radius:12px;padding:16px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:1000;min-width:220px;';
    if (type === 'dropdown') {
        const sel = document.createElement('select');
        sel.style.cssText = 'width:100%;padding:8px;border-radius:6px;border:1px solid #ccc;';
        sel.innerHTML = '<option value="">All</option>' + values.map(v => `<option value="${v}" ${currentFilter===v?'selected':''}>${v}</option>`).join('');
        popup.appendChild(sel);
        const btnDiv = document.createElement('div');
        btnDiv.style.cssText = 'display:flex;gap:10px;margin-top:15px;';
        const apply = document.createElement('button');
        apply.textContent = 'Apply';
        apply.style.cssText = 'flex:1;padding:8px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;';
        apply.onclick = () => { if (sel.value) setFilter(column, sel.value); else removeFilter(column); popup.remove(); };
        const cancel = document.createElement('button');
        cancel.textContent = 'Cancel';
        cancel.style.cssText = 'flex:1;padding:8px;background:#95a5a6;color:white;border:none;border-radius:6px;cursor:pointer;';
        cancel.onclick = () => popup.remove();
        btnDiv.append(apply, cancel);
        popup.appendChild(btnDiv);
    } else {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = `Filter by ${column}...`;
        inp.value = currentFilter || '';
        inp.style.cssText = 'width:100%;padding:8px;border-radius:6px;border:1px solid #ccc;margin-bottom:12px;';
        popup.appendChild(inp);
        const btnDiv = document.createElement('div');
        btnDiv.style.cssText = 'display:flex;gap:10px;';
        const apply = document.createElement('button');
        apply.textContent = 'Apply';
        apply.style.cssText = 'flex:1;padding:8px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;';
        apply.onclick = () => { if (inp.value.trim()) setFilter(column, inp.value.trim()); else removeFilter(column); popup.remove(); };
        const cancel = document.createElement('button');
        cancel.textContent = 'Cancel';
        cancel.style.cssText = 'flex:1;padding:8px;background:#95a5a6;color:white;border:none;border-radius:6px;cursor:pointer;';
        cancel.onclick = () => popup.remove();
        btnDiv.append(apply, cancel);
        popup.appendChild(btnDiv);
    }
    return popup;
}
function setFilter(column, value) {
    if (!activeFilters[currentActiveTab]) activeFilters[currentActiveTab] = {};
    activeFilters[currentActiveTab][column] = value;
    applyFilters(); updateFilterChips();
}
function removeFilter(column) {
    if (activeFilters[currentActiveTab]) delete activeFilters[currentActiveTab][column];
    applyFilters(); updateFilterChips();
}
function clearAllFilters() {
    activeFilters[currentActiveTab] = {};
    applyFilters(); updateFilterChips();
}
function applyFilters() {
    const filters = activeFilters[currentActiveTab] || {};
    const tbody = document.querySelector(`#${currentActiveTab === 'projects' ? 'projectsTable' : 'employeesTable'} tbody`);
    if (!tbody) return;
    Array.from(tbody.querySelectorAll('tr')).forEach(row => {
        let show = true;
        if (currentActiveTab === 'projects') {
            if (filters.company && !row.cells[0]?.textContent.toLowerCase().includes(filters.company.toLowerCase())) show = false;
            if (filters.project && !row.cells[1]?.textContent.toLowerCase().includes(filters.project.toLowerCase())) show = false;
        } else {
            if (filters.name && !row.cells[0]?.textContent.toLowerCase().includes(filters.name.toLowerCase())) show = false;
            if (filters.surname && !row.cells[1]?.textContent.toLowerCase().includes(filters.surname.toLowerCase())) show = false;
            if (filters.position && row.cells[3]?.textContent.toLowerCase() !== filters.position.toLowerCase()) show = false;
            if (filters.project && !row.cells[6]?.textContent.toLowerCase().includes(filters.project.toLowerCase())) show = false;
        }
        row.style.display = show ? '' : 'none';
    });
}
function updateFilterChips() {
    const filters = activeFilters[currentActiveTab] || {};
    const container = document.getElementById(`${currentActiveTab === 'projects' ? 'projectFilters' : 'employeeFilters'}`);
    if (!container) return;
    const keys = Object.keys(filters);
    let html = '';
    keys.forEach(k => {
        html += `<div class="filter-chip" data-filter="${k}" style="display:inline-flex;align-items:center;background:#e8e8e8;border-radius:20px;padding:6px 14px;margin-right:10px;margin-bottom:8px;gap:8px;font-size:13px;">
            ${k}: ${filters[k]}<span class="remove-filter" data-filter="${k}" style="cursor:pointer;color:#e74c3c;">×</span>
        </div>`;
    });
    if (keys.length >= 2) {
        html += `<div class="clear-filters-btn" style="display:inline-flex;align-items:center;background:#e74c3c;color:white;border-radius:20px;padding:6px 14px;margin-bottom:8px;cursor:pointer;">Clear All Filters</div>`;
    }
    container.innerHTML = html;
    document.querySelectorAll('.remove-filter').forEach(el => el.onclick = (e) => { e.stopPropagation(); removeFilter(el.dataset.filter); });
    const clearBtn = container.querySelector('.clear-filters-btn');
    if (clearBtn) clearBtn.onclick = () => clearAllFilters();
}
function addFilterIcons() {
    const tables = [
        { id: '#projectsTable', cols: ['Company Name', 'Project Name'] },
        { id: '#employeesTable', cols: ['Name', 'Surname', 'Position', 'Project'] }
    ];
    tables.forEach(({ id, cols }) => {
        const table = document.querySelector(id);
        if (!table) return;
        table.querySelectorAll('thead th').forEach(th => {
            const txt = th.textContent.trim();
            if (txt.includes('Projected Income')) return;
            if (cols.some(c => txt.includes(c)) && !th.querySelector('.filter-icon')) {
                const span = document.createElement('span');
                span.className = 'filter-icon';
                span.textContent = '⌕';
                span.style.marginLeft = '10px';
                span.style.cursor = 'pointer';
                th.appendChild(span);
            }
        });
    });
}
function setupFilters() {
    ['projectsTable', 'employeesTable'].forEach(tid => {
        const table = document.getElementById(tid);
        if (!table) return;
        table.querySelectorAll('thead th').forEach(th => {
            const icon = th.querySelector('.filter-icon');
            if (!icon) return;
            icon.onclick = (e) => {
                e.stopPropagation();
                const txt = th.textContent.trim().toLowerCase();
                let col = '', type = 'text', dropdown = [];
                if (tid === 'projectsTable') {
                    if (txt.includes('company')) col = 'company';
                    else if (txt.includes('project')) col = 'project';
                } else {
                    if (txt.includes('name') && !txt.includes('surname')) col = 'name';
                    else if (txt.includes('surname')) col = 'surname';
                    else if (txt.includes('position')) { col = 'position'; type = 'dropdown'; dropdown = ['Junior','Middle','Senior','Lead','Architect','BO']; }
                    else if (txt.includes('project')) col = 'project';
                }
                if (col) {
                    const rect = icon.getBoundingClientRect();
                    const curFilter = activeFilters[currentActiveTab]?.[col] || '';
                    const popup = createFilterPopup(col, type, dropdown, curFilter);
                    popup.style.left = rect.left + 'px';
                    popup.style.top = rect.bottom + 5 + 'px';
                    document.body.appendChild(popup);
                    const closeHandler = (e) => { if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', closeHandler); } };
                    setTimeout(() => document.addEventListener('click', closeHandler), 100);
                }
            };
        });
    });
}

// SEED DATA
function getPeriodName(period) {
    const [y,m] = period.split('-');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${months[parseInt(m)]} ${y}`;
}
function seedDataFromMonth(source, target) {
    const src = appData.monthlyData[source];
    if (!src) return false;
    const copiedProjects = src.projects.map(p => ({ ...p, id: Date.now() + Math.random() }));
    const copiedEmployees = src.employees.map(e => ({ ...e, id: Date.now() + Math.random(), vacationDays: [] }));
    appData.monthlyData[target] = { projects: copiedProjects, employees: copiedEmployees, period: getPeriodName(target) };
    saveToLocalStorage();
    return true;
}
function setupSeedDataButton() {
    const btn = document.getElementById('seedDataBtn');
    const overlay = document.getElementById('seedOverlay');
    const popup = document.getElementById('seedPopup');
    const close = document.getElementById('closePopup');
    if (!btn) return;
    btn.onclick = () => {
        const tbody = document.getElementById('seedTableBody');
        if (tbody) {
            tbody.innerHTML = '';
            Object.keys(appData.monthlyData).forEach(period => {
                if (period === currentPeriod) return;
                const data = appData.monthlyData[period];
                const row = document.createElement('tr');
                row.innerHTML = `<td>${period.split('-')[0]}</td><td>${getPeriodName(period)}</td><td>${data.projects?.length || 0}</td><td>${data.employees?.length || 0}</td><td>${data.projects?.reduce((s,p)=>s+(p.estimatedIncome||0),0).toFixed(0)}</td><td><button class="seed-action-btn" data-source="${period}">Seed</button></td>`;
                tbody.appendChild(row);
            });
            document.querySelectorAll('.seed-action-btn').forEach(b => {
                b.onclick = () => {
                    const src = b.dataset.source;
                    if (confirm(`Copy data from ${getPeriodName(src)} to ${getPeriodName(currentPeriod)}? Vacation days will be cleared.`)) {
                        seedDataFromMonth(src, currentPeriod);
                        renderCurrentTable();
                        popup.style.display = 'none';
                        overlay.style.display = 'none';
                    }
                };
            });
        }
        popup.style.display = 'block';
        overlay.style.display = 'block';
    };
    if (close) close.onclick = () => { popup.style.display = 'none'; overlay.style.display = 'none'; };
    if (overlay) overlay.onclick = () => { popup.style.display = 'none'; overlay.style.display = 'none'; };
}

// ФОРМЫ
function setupAddEmployeeForm() {
    const add = document.getElementById('addEmployeeBtn');
    const drawer = document.getElementById('employeeDrawer');
    const cancel = document.getElementById('cancelEmployee');
    const form = document.getElementById('employeeForm');
    const submit = document.getElementById('submitEmployee');

    const nameError = document.getElementById('empNameError');
    const surnameError = document.getElementById('empSurnameError');
    const dobError = document.getElementById('empDobError');
    const positionError = document.getElementById('empPositionError');
    const salaryError = document.getElementById('empSalaryError');

    function validate() {
        let valid = true;

        // Имя: только буквы, мин 3
        const name = document.getElementById('empName')?.value.trim();
        const nameRegex = /^[A-Za-z]{3,}$/;
        if (!name || !nameRegex.test(name)) {
            if (nameError) nameError.style.display = 'block';
            valid = false;
        } else if (nameError) nameError.style.display = 'none';

        // Фамилия: только буквы, мин 3
        const surname = document.getElementById('empSurname')?.value.trim();
        const surnameRegex = /^[A-Za-z]{3,}$/;
        if (!surname || !surnameRegex.test(surname)) {
            if (surnameError) surnameError.style.display = 'block';
            valid = false;
        } else if (surnameError) surnameError.style.display = 'none';

        // Дата рождения и возраст 18+
        const dob = document.getElementById('empDob')?.value;
        if (!dob) {
            if (dobError) dobError.style.display = 'block';
            valid = false;
        } else {
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (age < 18) {
                if (dobError) dobError.style.display = 'block';
                valid = false;
            } else {
                if (dobError) dobError.style.display = 'none';
            }
        }

        // Должность выбрана
        const pos = document.getElementById('empPosition')?.value;
        if (!pos) {
            if (positionError) positionError.style.display = 'block';
            valid = false;
        } else if (positionError) positionError.style.display = 'none';

        // Зарплата: положительное число, до 2 знаков
        const salRaw = document.getElementById('empSalary')?.value;
        const salary = parseFloat(salRaw);
        const salaryRegex = /^\d+(\.\d{1,2})?$/;
        if (!salRaw || salary <= 0 || !salaryRegex.test(salRaw)) {
            if (salaryError) salaryError.style.display = 'block';
            valid = false;
        } else if (salaryError) salaryError.style.display = 'none';

        if (submit) submit.disabled = !valid;
        return valid;
    }

    if (add) add.onclick = () => {
        drawer.classList.add('open');
        ['empName','empSurname','empDob','empPosition','empSalary'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        // Скрываем все ошибки (текст не меняем)
        [nameError, surnameError, dobError, positionError, salaryError].forEach(err => {
            if (err) err.style.display = 'none';
        });
        validate();
    };
    if (cancel) cancel.onclick = () => drawer.classList.remove('open');

    ['empName','empSurname','empDob','empPosition','empSalary'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', validate);
    });

    if (form) form.onsubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;

        const employees = getCurrentEmployees();
        const newId = employees.length > 0 ? Math.max(...employees.map(e => e.id)) + 1 : 1;
        const dob = document.getElementById('empDob').value;
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;

        let salary = parseFloat(document.getElementById('empSalary').value);
        salary = Math.round(salary * 100) / 100;

        const newEmployee = {
            id: newId,
            name: document.getElementById('empName').value.trim(),
            surname: document.getElementById('empSurname').value.trim(),
            age: age,
            position: document.getElementById('empPosition').value,
            salary: salary,
            estimatedPayment: salary,
            projectAssignments: [],
            vacationDays: []
        };
        employees.push(newEmployee);
        saveToLocalStorage();
        renderEmployeesTable();
        drawer.classList.remove('open');
    };
}

function setupAddProjectForm() {
    const add = document.getElementById('addProjectBtn');
    const drawer = document.getElementById('projectDrawer');
    const cancel = document.getElementById('cancelProject');
    const form = document.getElementById('projectForm');
    const submit = document.getElementById('submitProject');

    // Элементы для отображения ошибок (добавьте их в HTML, если отсутствуют)
    const nameError = document.getElementById('projNameError');
    const companyError = document.getElementById('projCompanyError');
    const budgetError = document.getElementById('projBudgetError');
    const capacityError = document.getElementById('projCapacityError');

    function validate() {
        let valid = true;

        // 1. Название проекта: обязательное, минимум 3 буквенно-цифровых символа (можно пробелы)
        const name = document.getElementById('projName')?.value.trim();
        const nameRegex = /^[A-Za-z0-9\s]{3,}$/;
        if (!name || !nameRegex.test(name)) {
            if (nameError) nameError.style.display = 'block';
            valid = false;
        } else {
            if (nameError) nameError.style.display = 'none';
        }

        // 2. Название компании: обязательное, минимум 2 буквенно-цифровых символа (можно пробелы)
        const company = document.getElementById('projCompany')?.value.trim();
        const companyRegex = /^[A-Za-z0-9\s]{2,}$/;
        if (!company || !companyRegex.test(company)) {
            if (companyError) companyError.style.display = 'block';
            valid = false;
        } else {
            if (companyError) companyError.style.display = 'none';
        }

        // 3. Бюджет: положительное число, максимум 2 знака после запятой
        const budgetRaw = document.getElementById('projBudget')?.value;
        const budget = parseFloat(budgetRaw);
        const budgetRegex = /^\d+(\.\d{1,2})?$/; // целое или до 2 знаков
        if (!budgetRaw || budget <= 0 || !budgetRegex.test(budgetRaw)) {
            if (budgetError) budgetError.style.display = 'block';
            valid = false;
        } else {
            if (budgetError) budgetError.style.display = 'none';
        }

        // 4. Employee Capacity: целое число, минимум 1
        const capacityRaw = document.getElementById('projCapacity')?.value;
        const capacity = parseInt(capacityRaw, 10);
        if (!capacityRaw || isNaN(capacity) || capacity < 1 || !Number.isInteger(capacity)) {
            if (capacityError) capacityError.style.display = 'block';
            valid = false;
        } else {
            if (capacityError) capacityError.style.display = 'none';
        }

        if (submit) submit.disabled = !valid;
        return valid;
    }

    if (add) add.onclick = () => {
        drawer.classList.add('open');
        ['projName','projCompany','projBudget','projCapacity'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        // Скрыть все сообщения об ошибках
        [nameError, companyError, budgetError, capacityError].forEach(err => {
            if (err) err.style.display = 'none';
        });
        validate();
    };
    if (cancel) cancel.onclick = () => drawer.classList.remove('open');

    ['projName','projCompany','projBudget','projCapacity'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', validate);
    });

    if (form) form.onsubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;

        const projects = getCurrentProjects();
        const newId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
        const budget = parseFloat(document.getElementById('projBudget').value);
        // Округляем бюджет до 2 знаков (на всякий случай)
        const roundedBudget = Math.round(budget * 100) / 100;
        const newProject = {
            id: newId,
            companyName: document.getElementById('projCompany').value.trim(),
            projectName: document.getElementById('projName').value.trim(),
            budget: roundedBudget,
            employeeCapacity: parseInt(document.getElementById('projCapacity').value, 10),
            estimatedIncome: roundedBudget * 2.4
        };
        projects.push(newProject);
        saveToLocalStorage();
        renderProjectsTable();
        drawer.classList.remove('open');
    };
}

// ОСНОВНЫЕ РЕНДЕРЫ ТАБЛИЦ
function renderProjectsTable() {
    const table = document.querySelector('#projectsTable');
    const tbody = table?.querySelector('tbody');
    const tfoot = table?.querySelector('tfoot');
    if (!tbody) return;
    const projects = getCurrentProjects();
    const employees = getCurrentEmployees();
    const [year, month] = currentPeriod.split('-').map(Number);
    tbody.innerHTML = '';
    if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px;">No projects. Click "Add Project".</td></tr>';
        if (tfoot) tfoot.innerHTML = '';
        return;
    }
    let totalIncome = 0;
    projects.forEach(proj => {
        const projEmps = employees.filter(e => e.projectAssignments?.some(a => a.projectId === proj.id));
        let totalEff = 0, totalRev = 0, totalCost = 0;
        projEmps.forEach(emp => {
            const assign = emp.projectAssignments.find(a => a.projectId === proj.id);
            if (assign) {
                const vcoeff = calculateVacationCoefficient(emp.vacationDays, year, month);
                totalEff += assign.capacity * assign.fit * vcoeff;
                totalRev += calculateEmployeeRevenue(emp, proj, assign, vcoeff, employees);
                totalCost += calculateEmployeeCost(emp, assign);
            }
        });
        const unassigned = employees.filter(e => !e.projectAssignments || e.projectAssignments.length === 0);
        unassigned.forEach(e => totalCost += calculateBenchCost(e));
        const isOver = totalEff > proj.employeeCapacity;
        const capDisplay = `${totalEff.toFixed(1)}/${proj.employeeCapacity}`;
        const profit = totalRev - totalCost;
        totalIncome += profit;
        const row = document.createElement('tr');
        row.innerHTML = `<td>${escapeHtml(proj.companyName)}</td><td>${escapeHtml(proj.projectName)}</td>
            <td>$${proj.budget.toFixed(2)}</td>
            <td style="${isOver ? 'color:#e74c3c;font-weight:bold' : ''}">${capDisplay}${isOver ? 'Warning' : ''}</td>
            <td><button class="show-employees-btn" data-id="${proj.id}" style="background:#4a6a8a;border:none;color:white;padding:5px 12px;border-radius:5px;cursor:pointer;">Show (${projEmps.length})</button></td>
            <td style="color:${profit>=0?'#27ae60':'#e74c3c'};font-weight:bold;">$${profit.toFixed(2)}</td>
            <td><button class="delete-project-btn" data-id="${proj.id}" style="background:#e74c3c;border:none;color:white;padding:5px 10px;border-radius:5px;cursor:pointer;">Delete</button></td>`;
        tbody.appendChild(row);
    });
    let footer = table.querySelector('tfoot');
    if (!footer) { footer = document.createElement('tfoot'); table.appendChild(footer); }
    footer.innerHTML = '';
    const totalRow = document.createElement('tr');
    totalRow.style.background = '#f0f2f5';
    totalRow.style.fontWeight = 'bold';
    totalRow.innerHTML = `<td colspan="5" style="text-align:right;">Total Estimated Income:</td><td style="color:${totalIncome>=0?'#27ae60':'#e74c3c'};font-weight:bold;">$${totalIncome.toFixed(2)}</td><td></td>`;
    footer.appendChild(totalRow);
}

function renderEmployeesTable() {
    const tbody = document.querySelector('#employeesTable tbody');
    if (!tbody) return;
    const employees = getCurrentEmployees();
    const projects = getCurrentProjects();
    const [year, month] = currentPeriod.split('-').map(Number);
    tbody.innerHTML = '';
    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:40px;">No employees. Click "Add Employee".</td></tr>';
        return;
    }
    employees.forEach(emp => {
        // Возраст
        let age = emp.age;
        if (emp.dateOfBirth && !age) {
            const birth = new Date(emp.dateOfBirth);
            age = new Date().getFullYear() - birth.getFullYear();
        }
        // Расчёты по назначениям
        let estimatedPayment = 0;
        let totalProfit = 0;
        const assignments = emp.projectAssignments || [];
        const assignmentsCount = assignments.length;
        let totalCapacityUsed = 0;
        let projectNamesList = [];

        if (assignments.length) {
            assignments.forEach(assign => {
                const proj = projects.find(p => p.id === assign.projectId);
                if (proj) {
                    const vacCoeff = calculateVacationCoefficient(emp.vacationDays, year, month);
                    const revenue = calculateEmployeeRevenue(emp, proj, assign, vacCoeff, employees);
                    const cost = calculateEmployeeCost(emp, assign);
                    estimatedPayment += cost;
                    totalProfit += (revenue - cost);
                    totalCapacityUsed += assign.capacity;   // суммируем capacity
                    projectNamesList.push(proj.projectName);
                }
            });
        } else {
            estimatedPayment = calculateBenchCost(emp);
            totalProfit = -estimatedPayment;
        }
        const isProfitPositive = totalProfit > 0;
        const capacityDisplay = `${totalCapacityUsed.toFixed(1)}/1.5`;
        const projectNames = projectNamesList.join(', ') || '—';

        const assignmentsDisplay = assignmentsCount > 0
            ? `<button class="show-assignments-btn" data-id="${emp.id}" style="background:#4a6a8a;border:none;color:white;padding:5px 10px;border-radius:5px;cursor:pointer;margin-right:5px;">Show (${assignmentsCount})</button>`
            : 'None';

        // Ячейка Project содержит: текст проектов + индикатор загрузки + кнопку
        const projectCellContent = `
            <div style="margin-bottom:4px;">${escapeHtml(projectNames)}</div>
            <div><span style="font-size:12px; color:#555;">${capacityDisplay}</span> ${assignmentsDisplay}</div>
        `;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="filterable-cell" data-filter="name">${escapeHtml(emp.name || '-')}</td>
            <td class="filterable-cell" data-filter="surname">${escapeHtml(emp.surname || '-')}</td>
            <td class="sortable-cell" data-sort="age">${age || '-'}</td>
            <td class="filterable-cell" data-filter="position">${escapeHtml(emp.position || '-')}</td>
            <td class="sortable-cell" data-sort="salary">$${(emp.salary || 0).toFixed(0)}</td>
            <td class="sortable-cell" data-sort="payment">$${estimatedPayment.toFixed(2)}</td>
            <td class="filterable-cell assignments-cell" data-filter="project">${projectCellContent}</td>
            <td class="sortable-cell" data-sort="projIncome" style="color:${isProfitPositive ? '#27ae60' : '#e74c3c'}; font-weight:bold;">$${totalProfit.toFixed(2)}</td>
            <td><button class="delete-employee-btn" data-id="${emp.id}" style="background:#e74c3c;border:none;color:white;padding:5px 10px;border-radius:5px;cursor:pointer;">Delete</button></td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll('.delete-employee-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            if (confirm('Delete this employee?')) deleteEmployee(id);
        };
    });
}

// ЕДИНОЕ ПЕРЕОПРЕДЕЛЕНИЕ РЕНДЕРОВ
const baseRenderProjects = renderProjectsTable;
const baseRenderEmployees = renderEmployeesTable;

window.renderProjectsTable = function() {
    baseRenderProjects();
    setTimeout(() => {
        addSortIcons();
        setupSorting();
        addFilterIcons();
        setupFilters();
        updateFilterChips();
        attachProjectButtonsWithPopup();
    }, 50);
};

window.renderEmployeesTable = function() {
    baseRenderEmployees();
    setTimeout(() => {
        addSortIcons();
        setupSorting();
        addFilterIcons();
        setupFilters();
        updateFilterChips();
        addAssignButtonsWithPositioning();
        makeEditable();
        attachShowAssignmentsButtons();
        addAvailabilityButtons();
        attachEmployeeDeleteButtons();
    }, 100);
};

// ИНИЦИАЛИЗАЦИЯ
function init() {
    setupSidebar();
    setupPeriodSelector();
    setDefaultPeriod();
    setupSeedDataButton();
    setupAddEmployeeForm();
    setupAddProjectForm();
    setupTabs();
    loadData();
}

document.addEventListener('DOMContentLoaded', init);

