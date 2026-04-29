// ========== НАВИГАЦИЯ И СОСТОЯНИЕ UI ==========
let isSidebarCollapsed = false;
let currentActiveTab = 'projects';
let currentPeriod = '2026-3';

// ========== БОКОВАЯ ПАНЕЛЬ ==========
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

    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === 'true') {
        collapseSidebar();
    } else {
        expandSidebar();
    }
}

// ========== ВКЛАДКИ ==========
function setupTabs() {
    const projectsLink = document.querySelector('.nav__link[data-page="projects"]');
    const employeesLink = document.querySelector('.nav__link[data-page="employees"]');
    const projectsPage = document.getElementById('projectsPage');
    const employeesPage = document.getElementById('employeesPage');

    if (!projectsLink || !employeesLink || !projectsPage || !employeesPage) return;

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

    const savedTab = localStorage.getItem('activeTab');
    if (savedTab === 'employees') {
        switchToEmployees();
    } else {
        switchToProjects();
    }
}

// ========== СЕЛЕКТОР ПЕРИОДА ==========
function setupPeriodSelector() {
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');

    if (monthSelect && yearSelect) {
        currentPeriod = `${yearSelect.value}-${monthSelect.value}`;

        function updatePeriod() {
            currentPeriod = `${yearSelect.value}-${monthSelect.value}`;
            localStorage.setItem('currentPeriod', currentPeriod);

            if (currentActiveTab === 'projects') {
                renderProjectsTable();
            } else {
                renderEmployeesTable();
            }
        }

        monthSelect.addEventListener('change', updatePeriod);
        yearSelect.addEventListener('change', updatePeriod);
    }
}

// ========== ДАННЫЕ ==========
let appData = null;

function saveToLocalStorage() {
    localStorage.setItem('monthlyData', JSON.stringify(appData.monthlyData));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('monthlyData');
    if (saved) {
        appData = { monthlyData: JSON.parse(saved) };
        return true;
    }
    return false;
}

async function loadData() {
    if (loadFromLocalStorage()) {
        console.log('Loaded from localStorage');
        setTimeout(() => {
            if (currentActiveTab === 'projects') {
                renderProjectsTable();
            } else {
                renderEmployeesTable();
            }
        }, 50);
        return;
    }

    try {
        const response = await fetch('database.json');
        appData = await response.json();
        saveToLocalStorage();
        console.log('Loaded from JSON');
        setTimeout(() => {
            if (currentActiveTab === 'projects') {
                renderProjectsTable();
            } else {
                renderEmployeesTable();
            }
        }, 50);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function getCurrentProjects() {
    if (!appData?.monthlyData) return [];
    return appData.monthlyData[currentPeriod]?.projects || [];
}

function getCurrentEmployees() {
    if (!appData?.monthlyData) return [];
    return appData.monthlyData[currentPeriod]?.employees || [];
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function renderCurrentTable() {
    if (currentActiveTab === 'projects') {
        renderProjectsTable();
    } else {
        renderEmployeesTable();
    }
}

function getYearFromPeriod(period) {
    return parseInt(period.split('-')[0]);
}

function getMonthFromPeriod(period) {
    return parseInt(period.split('-')[1]);
}

// ========== ФИНАНСОВЫЕ РАСЧЁТЫ ==========
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

// ========== РЕНДЕРИНГ ТАБЛИЦЫ ПРОЕКТОВ ==========
function renderProjectsTable() {
    const table = document.querySelector('#projectsTable');
    const tbody = table.querySelector('tbody');
    const tfoot = table.querySelector('tfoot');
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

    projects.forEach(project => {
        const projectEmployees = employees.filter(emp =>
            emp.projectAssignments?.some(a => a.projectId === project.id)
        );

        let totalEffectiveCapacity = 0;
        let totalRevenue = 0;
        let totalCost = 0;

        projectEmployees.forEach(emp => {
            const assignment = emp.projectAssignments.find(a => a.projectId === project.id);
            if (assignment) {
                const vacationCoeff = calculateVacationCoefficient(emp.vacationDays, year, month);
                totalEffectiveCapacity += calculateEffectiveCapacity(assignment.capacity, assignment.fit, vacationCoeff);
                const revenue = calculateEmployeeRevenue(emp, project, assignment, vacationCoeff, employees);
                totalRevenue += revenue;
                totalCost += calculateEmployeeCost(emp, assignment);
            }
        });

        const unassignedEmployees = employees.filter(emp => !emp.projectAssignments || emp.projectAssignments.length === 0);
        unassignedEmployees.forEach(emp => {
            totalCost += calculateBenchCost(emp);
        });

        const totalCapacity = project.employeeCapacity;
        const isOverCapacity = totalEffectiveCapacity > totalCapacity;
        const capacityDisplay = `${totalEffectiveCapacity.toFixed(1)}/${totalCapacity}`;
        const projectProfit = totalRevenue - totalCost;
        totalIncome += projectProfit;
        const isProfitPositive = projectProfit > 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(project.companyName)}</td>
            <td>${escapeHtml(project.projectName)}</td>
            <td>$${project.budget.toFixed(2)}</td>
            <td style="${isOverCapacity ? 'color: #e74c3c; font-weight: bold;' : ''}">
                ${capacityDisplay}${isOverCapacity ? ' ⚠️' : ''}
            </td>
            <td>
                <button class="show-employees-btn" data-id="${project.id}" style="background:#4a6a8a; border:none; color:white; padding:5px 12px; border-radius:5px; cursor:pointer;">
                    Show (${projectEmployees.length})
                </button>
            </td>
            <td style="color: ${isProfitPositive ? '#27ae60' : '#e74c3c'}; font-weight: bold;">
                $${projectProfit.toFixed(2)}
            </td>
            <td>
                <button class="delete-project-btn" data-id="${project.id}" style="background:#e74c3c; border:none; color:white; padding:5px 10px; border-radius:5px; cursor:pointer;">
                    Delete️
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Обновляем или создаём tfoot с итоговой строкой
    let footer = table.querySelector('tfoot');
    if (!footer) {
        footer = document.createElement('tfoot');
        table.appendChild(footer);
    }
    footer.innerHTML = '';
    const totalRow = document.createElement('tr');
    totalRow.style.background = '#f0f2f5';
    totalRow.style.fontWeight = 'bold';
    totalRow.innerHTML = `
        <td colspan="5" style="text-align:right;">Total Estimated Income:</td>
        <td style="color: ${totalIncome >= 0 ? '#27ae60' : '#e74c3c'}; font-weight: bold;">$${totalIncome.toFixed(2)}</td>
        <td></td>
    `;
    footer.appendChild(totalRow);
}

// ========== РЕНДЕРИНГ ТАБЛИЦЫ СОТРУДНИКОВ ==========
function renderEmployeesTable() {
    const tbody = document.querySelector('#employeesTable tbody');
    if (!tbody) return;

    const employees = getCurrentEmployees();
    const projects = getCurrentProjects();
    const [year, month] = currentPeriod.split('-').map(Number);

    tbody.innerHTML = '';

    if (employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:40px;">No employees. Click "Add Employee".</table></tr>';
        return;
    }

    employees.forEach(employee => {
        // Расчёт возраста
        let age = employee.age;
        if (employee.dateOfBirth && !age) {
            const birthDate = new Date(employee.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        }

        // Расчёт предполагаемой оплаты и прибыли
        let estimatedPayment = 0;
        let totalProfit = 0;
        const assignmentsCount = employee.projectAssignments?.length || 0;

        if (employee.projectAssignments && employee.projectAssignments.length > 0) {
            employee.projectAssignments.forEach(assignment => {
                const project = projects.find(p => p.id === assignment.projectId);
                if (project) {
                    const vacationCoeff = calculateVacationCoefficient(employee.vacationDays, year, month);
                    const revenue = calculateEmployeeRevenue(employee, project, assignment, vacationCoeff, employees);
                    const cost = calculateEmployeeCost(employee, assignment);
                    estimatedPayment += cost;
                    totalProfit += (revenue - cost);
                }
            });
        } else {
            estimatedPayment = calculateBenchCost(employee);
            totalProfit = -estimatedPayment;
        }

        const isProfitPositive = totalProfit > 0;

        // Удалённая переменная projectNames (не используется)

        // Кнопка Show Assignments
        const assignmentsDisplay = assignmentsCount > 0
            ? `<button class="show-assignments-btn" data-id="${employee.id}" style="background:#4a6a8a; border:none; color:white; padding:5px 10px; border-radius:5px; cursor:pointer; margin-right:5px;">
                Show (${assignmentsCount})
               </button>`
            : 'None';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="filterable-cell" data-filter="name">${escapeHtml(employee.name || '-')}</td>
            <td class="filterable-cell" data-filter="surname">${escapeHtml(employee.surname || '-')}</td>
            <td class="sortable-cell" data-sort="age">${age || '-'}</td>
            <td class="filterable-cell" data-filter="position">${escapeHtml(employee.position || '-')}</td>
            <td class="sortable-cell" data-sort="salary">$${(employee.salary || 0).toFixed(2)}</td>
            <td class="sortable-cell" data-sort="payment">$${estimatedPayment.toFixed(2)}</td>
            <td class="filterable-cell assignments-cell" data-filter="project">${assignmentsDisplay}</td>
            <td class="sortable-cell" data-sort="projIncome" style="color: ${isProfitPositive ? '#27ae60' : '#e74c3c'}; font-weight: bold;">
                $${totalProfit.toFixed(2)}
            </td>
            <td>
                <button class="delete-employee-btn" data-id="${employee.id}" style="background:#e74c3c; border:none; color:white; padding:5px 10px; border-radius:5px; cursor:pointer;">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Добавляем обработчики для кнопок Show Assignments
    setTimeout(() => {
        document.querySelectorAll('.show-assignments-btn').forEach(btn => {
            btn.onclick = () => {
                const employeeId = parseInt(btn.dataset.id);
                const employee = getCurrentEmployees().find(e => e.id === employeeId);
                const projectsList = getCurrentProjects();
                if (employee && employee.projectAssignments?.length > 0) {
                    let message = `Assignments for ${employee.name} ${employee.surname}:\n\n`;
                    employee.projectAssignments.forEach(a => {
                        const project = projectsList.find(p => p.id === a.projectId);
                        if (project) {
                            message += `- ${project.projectName}: capacity=${a.capacity}, fit=${a.fit}\n`;
                        }
                    });
                    alert(message);
                } else {
                    alert('No assignments for this employee.');
                }
            };
        });
    }, 100);
}

// ========== ФУНКЦИЯ SEED DATA ==========
function getPeriodName(period) {
    const [year, month] = period.split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[parseInt(month)]} ${year}`;
}

function seedDataFromMonth(sourcePeriod, targetPeriod) {
    const sourceData = appData.monthlyData[sourcePeriod];
    if (!sourceData) return false;

    const copiedProjects = sourceData.projects.map(p => ({
        ...p,
        id: Date.now() + Math.random()
    }));

    const copiedEmployees = sourceData.employees.map(e => ({
        ...e,
        id: Date.now() + Math.random(),
        vacationDays: []
    }));

    appData.monthlyData[targetPeriod] = {
        projects: copiedProjects,
        employees: copiedEmployees,
        period: getPeriodName(targetPeriod)
    };

    saveToLocalStorage();
    return true;
}

function setupSeedDataButton() {
    const seedBtn = document.getElementById('seedDataBtn');
    const overlay = document.getElementById('seedOverlay');
    const popup = document.getElementById('seedPopup');
    const closePopup = document.getElementById('closePopup');

    if (!seedBtn) return;

    seedBtn.addEventListener('click', () => {
        const tableBody = document.getElementById('seedTableBody');
        if (tableBody) {
            tableBody.innerHTML = '';
            const periods = Object.keys(appData.monthlyData);
            periods.forEach(period => {
                if (period === currentPeriod) return;
                const data = appData.monthlyData[period];
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${period.split('-')[0]}</td>
                    <td>${getPeriodName(period)}</td>
                    <td>${data.projects?.length || 0}</td>
                    <td>${data.employees?.length || 0}</td>
                    <td>${data.projects?.reduce((sum, p) => sum + (p.estimatedIncome || 0), 0).toFixed(0)}</td>
                    <td><button class="seed-action-btn" data-source="${period}">Seed</button></td>
                `;
                tableBody.appendChild(row);
            });

            document.querySelectorAll('.seed-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const sourcePeriod = btn.dataset.source;
                    if (confirm(`Copy data from ${getPeriodName(sourcePeriod)} to ${getPeriodName(currentPeriod)}? Vacation days will be cleared.`)) {
                        seedDataFromMonth(sourcePeriod, currentPeriod);
                        renderCurrentTable();
                        popup.style.display = 'none';
                        overlay.style.display = 'none';
                    }
                });
            });
        }
        popup.style.display = 'block';
        overlay.style.display = 'block';
    });

    if (closePopup) {
        closePopup.addEventListener('click', () => {
            popup.style.display = 'none';
            overlay.style.display = 'none';
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            popup.style.display = 'none';
            overlay.style.display = 'none';
        });
    }
}

// ========== ADD EMPLOYEE FORM ==========
function setupAddEmployeeForm() {
    const addBtn = document.getElementById('addEmployeeBtn');
    const drawer = document.getElementById('employeeDrawer');
    const cancelBtn = document.getElementById('cancelEmployee');
    const form = document.getElementById('employeeForm');
    const submitBtn = document.getElementById('submitEmployee');

    function validate() {
        const name = document.getElementById('empName')?.value || '';
        const surname = document.getElementById('empSurname')?.value || '';
        const dob = document.getElementById('empDob')?.value || '';
        const position = document.getElementById('empPosition')?.value || '';
        const salary = document.getElementById('empSalary')?.value || '';

        let isValid = true;
        const nameRegex = /^[A-Za-z]{3,}$/;
        if (!name || !nameRegex.test(name)) {
            document.getElementById('empNameError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('empNameError').style.display = 'none';
        }

        const surnameRegex = /^[A-Za-z]{3,}$/;
        if (!surname || !surnameRegex.test(surname)) {
            document.getElementById('empSurnameError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('empSurnameError').style.display = 'none';
        }

        if (dob) {
            const birthDate = new Date(dob);
            let age = new Date().getFullYear() - birthDate.getFullYear();
            if (age < 18) {
                document.getElementById('empDobError').style.display = 'block';
                isValid = false;
            } else {
                document.getElementById('empDobError').style.display = 'none';
            }
        } else {
            document.getElementById('empDobError').style.display = 'block';
            isValid = false;
        }

        if (!position) {
            document.getElementById('empPositionError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('empPositionError').style.display = 'none';
        }

        if (!salary || parseFloat(salary) <= 0) {
            document.getElementById('empSalaryError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('empSalaryError').style.display = 'none';
        }

        if (submitBtn) submitBtn.disabled = !isValid;
        return isValid;
    }

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            drawer.classList.add('open');
            document.getElementById('empName').value = '';
            document.getElementById('empSurname').value = '';
            document.getElementById('empDob').value = '';
            document.getElementById('empPosition').value = '';
            document.getElementById('empSalary').value = '';
            document.querySelectorAll('#employeeForm .form__error').forEach(err => err.style.display = 'none');
            validate();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => drawer.classList.remove('open'));
    }

    ['empName', 'empSurname', 'empDob', 'empPosition', 'empSalary'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', validate);
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (validate()) {
                const employees = getCurrentEmployees();
                const newId = employees.length > 0 ? Math.max(...employees.map(e => e.id)) + 1 : 1;
                const dob = document.getElementById('empDob').value;
                let age = new Date().getFullYear() - new Date(dob).getFullYear();

                employees.push({
                    id: newId,
                    name: document.getElementById('empName').value,
                    surname: document.getElementById('empSurname').value,
                    age: age,
                    position: document.getElementById('empPosition').value,
                    salary: parseFloat(document.getElementById('empSalary').value),
                    estimatedPayment: parseFloat(document.getElementById('empSalary').value),
                    projectAssignments: [],
                    vacationDays: []
                });

                saveToLocalStorage();
                renderEmployeesTable();
                drawer.classList.remove('open');
            }
        });
    }
}

// ========== ADD PROJECT FORM ==========
function setupAddProjectForm() {
    const addBtn = document.getElementById('addProjectBtn');
    const drawer = document.getElementById('projectDrawer');
    const cancelBtn = document.getElementById('cancelProject');
    const form = document.getElementById('projectForm');
    const submitBtn = document.getElementById('submitProject');

    function validate() {
        const name = document.getElementById('projName')?.value || '';
        const company = document.getElementById('projCompany')?.value || '';
        const budget = document.getElementById('projBudget')?.value || '';
        const capacity = document.getElementById('projCapacity')?.value || '';

        let isValid = true;
        const nameRegex = /^[A-Za-z0-9\s]{3,}$/;
        if (!name || !nameRegex.test(name)) {
            document.getElementById('projNameError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('projNameError').style.display = 'none';
        }

        const companyRegex = /^[A-Za-z0-9\s]{2,}$/;
        if (!company || !companyRegex.test(company)) {
            document.getElementById('projCompanyError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('projCompanyError').style.display = 'none';
        }

        if (!budget || parseFloat(budget) <= 0) {
            document.getElementById('projBudgetError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('projBudgetError').style.display = 'none';
        }

        if (!capacity || parseInt(capacity) < 1) {
            document.getElementById('projCapacityError').style.display = 'block';
            isValid = false;
        } else {
            document.getElementById('projCapacityError').style.display = 'none';
        }

        if (submitBtn) submitBtn.disabled = !isValid;
        return isValid;
    }

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            drawer.classList.add('open');
            document.getElementById('projName').value = '';
            document.getElementById('projCompany').value = '';
            document.getElementById('projBudget').value = '';
            document.getElementById('projCapacity').value = '';
            document.querySelectorAll('#projectForm .form__error').forEach(err => err.style.display = 'none');
            validate();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => drawer.classList.remove('open'));
    }

    ['projName', 'projCompany', 'projBudget', 'projCapacity'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', validate);
    });

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (validate()) {
                const projects = getCurrentProjects();
                const newId = projects.length > 0 ? Math.max(...projects.map(p => p.id)) + 1 : 1;
                const budget = parseFloat(document.getElementById('projBudget').value);

                projects.push({
                    id: newId,
                    companyName: document.getElementById('projCompany').value,
                    projectName: document.getElementById('projName').value,
                    budget: budget,
                    employeeCapacity: parseInt(document.getElementById('projCapacity').value),
                    estimatedIncome: budget * 2.4
                });

                saveToLocalStorage();
                renderProjectsTable();
                drawer.classList.remove('open');
            }
        });
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function init() {
    console.log('Initializing...');
    setupSidebar();
    setupTabs();
    setupPeriodSelector();
    setupSeedDataButton();
    setupAddEmployeeForm();
    setupAddProjectForm();
    loadData();
}

// ========== СОРТИРОВКА (10 баллов) ==========
let currentSort = { projects: { column: null, direction: 'asc' }, employees: { column: null, direction: 'asc' } };

function addSortIcons() {
    const tables = [
        { id: '#projectsTable', columns: ['Company Name', 'Project Name', 'Budget', 'Employee Capacity', 'Estimated Income'] },
        { id: '#employeesTable', columns: ['Name', 'Surname', 'Age', 'Position', 'Salary', 'Estimated Payment', 'Project', 'Projected Income'] }
    ];
    tables.forEach(({ id, columns }) => {
        const table = document.querySelector(id);
        if (!table) return;
        const headers = table.querySelectorAll('thead th');
        headers.forEach(header => {
            const headerText = header.textContent.trim();
            if (columns.some(col => headerText.includes(col))) {
                header.classList.add('sortable');
                header.style.cursor = 'pointer';
                if (!header.querySelector('.sort-icon')) {
                    const sortSpan = document.createElement('span');
                    sortSpan.className = 'sort-icon';
                    sortSpan.textContent = '⇅';
                    sortSpan.style.marginLeft = '8px';
                    header.appendChild(sortSpan);
                }
            }
        });
    });
}

function updateSortIcons(tableType, column, direction) {
    const table = document.querySelector(`#${tableType === 'projects' ? 'projectsTable' : 'employeesTable'}`);
    if (!table) return;
    const headers = table.querySelectorAll('thead th');
    headers.forEach(header => {
        const sortSpan = header.querySelector('.sort-icon');
        if (sortSpan) sortSpan.textContent = '⇅';
    });
    const activeHeader = Array.from(headers).find(h => {
        const text = h.textContent.toLowerCase();
        if (tableType === 'projects') {
            return (column === 'company' && text.includes('company')) ||
                (column === 'project' && text.includes('project')) ||
                (column === 'budget' && text.includes('budget')) ||
                (column === 'capacity' && text.includes('capacity')) ||
                (column === 'income' && text.includes('income'));
        } else {
            return (column === 'name' && text.includes('name') && !text.includes('surname')) ||
                (column === 'surname' && text.includes('surname')) ||
                (column === 'age' && text.includes('age')) ||
                (column === 'position' && text.includes('position')) ||
                (column === 'salary' && text.includes('salary')) ||
                (column === 'payment' && text.includes('payment')) ||
                (column === 'projIncome' && text.includes('income'));
        }
    });
    if (activeHeader) {
        const sortSpan = activeHeader.querySelector('.sort-icon');
        if (sortSpan) sortSpan.textContent = direction === 'asc' ? '↑' : '↓';
    }
}

function sortProjectsTable(column, direction) {
    const table = document.querySelector('#projectsTable');
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;

    rows.sort((a, b) => {
        let valA, valB;

        if (column === 'company') {
            valA = a.cells[0]?.textContent.trim() || '';
            valB = b.cells[0]?.textContent.trim() || '';
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (column === 'project') {
            valA = a.cells[1]?.textContent.trim() || '';
            valB = b.cells[1]?.textContent.trim() || '';
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (column === 'budget') {
            valA = parseFloat(a.cells[2]?.textContent.replace('$', '')) || 0;
            valB = parseFloat(b.cells[2]?.textContent.replace('$', '')) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }
        if (column === 'capacity') {
            const capA = a.cells[3]?.textContent.split('/')[0] || '0';
            const capB = b.cells[3]?.textContent.split('/')[0] || '0';
            valA = parseFloat(capA) || 0;
            valB = parseFloat(capB) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }
        if (column === 'income') {
            valA = parseFloat(a.cells[5]?.textContent.replace('$', '')) || 0;
            valB = parseFloat(b.cells[5]?.textContent.replace('$', '')) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
    });

    // Переставляем строки в правильном порядке
    rows.forEach(row => tbody.appendChild(row));

    // Сохраняем состояние сортировки
    currentSort.projects = { column, direction };
    updateSortIcons('projects', column, direction);
}

function sortEmployeesTable(column, direction) {
    const tbody = document.querySelector('#employeesTable tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;
    rows.sort((a, b) => {
        let valA, valB;
        if (column === 'name') {
            valA = a.cells[0]?.textContent.trim() || '';
            valB = b.cells[0]?.textContent.trim() || '';
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (column === 'surname') {
            valA = a.cells[1]?.textContent.trim() || '';
            valB = b.cells[1]?.textContent.trim() || '';
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (column === 'age') {
            valA = parseInt(a.cells[2]?.textContent) || 0;
            valB = parseInt(b.cells[2]?.textContent) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }
        if (column === 'position') {
            valA = a.cells[3]?.textContent.trim() || '';
            valB = b.cells[3]?.textContent.trim() || '';
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (column === 'salary') {
            valA = parseFloat(a.cells[4]?.textContent.replace('$', '')) || 0;
            valB = parseFloat(b.cells[4]?.textContent.replace('$', '')) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }
        if (column === 'payment') {
            valA = parseFloat(a.cells[5]?.textContent.replace('$', '')) || 0;
            valB = parseFloat(b.cells[5]?.textContent.replace('$', '')) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }
        if (column === 'project') {
            valA = a.cells[6]?.textContent.trim() || '';
            valB = b.cells[6]?.textContent.trim() || '';
            return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (column === 'projIncome') {
            valA = parseFloat(a.cells[7]?.textContent.replace('$', '')) || 0;
            valB = parseFloat(b.cells[7]?.textContent.replace('$', '')) || 0;
            return direction === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
    });
    rows.forEach(row => tbody.appendChild(row));
    currentSort.employees = { column, direction };
    updateSortIcons('employees', column, direction);
}

function setupSorting() {
    const projectsTable = document.querySelector('#projectsTable');
    if (projectsTable) {
        const headers = projectsTable.querySelectorAll('thead th.sortable');
        headers.forEach(header => {
            header.removeEventListener('click', header._sortHandler);
            header._sortHandler = () => {
                const text = header.textContent.toLowerCase();
                let column = '';
                if (text.includes('company')) column = 'company';
                else if (text.includes('project')) column = 'project';
                else if (text.includes('budget')) column = 'budget';
                else if (text.includes('capacity')) column = 'capacity';
                else if (text.includes('income')) column = 'income';
                else if (text.includes('project')) column = 'project';
                if (column) {
                    let direction = 'asc';
                    if (currentSort.projects.column === column && currentSort.projects.direction === 'asc') direction = 'desc';
                    sortProjectsTable(column, direction);
                }
            };
            header.addEventListener('click', header._sortHandler);
        });
    }
    const employeesTable = document.querySelector('#employeesTable');
    if (employeesTable) {
        const headers = employeesTable.querySelectorAll('thead th.sortable');
        headers.forEach(header => {
            header.removeEventListener('click', header._sortHandler);
            header._sortHandler = () => {
                const text = header.textContent.toLowerCase();
                let column = '';
                if (text.includes('name') && !text.includes('surname')) column = 'name';
                else if (text.includes('surname')) column = 'surname';
                else if (text.includes('age')) column = 'age';
                else if (text.includes('position')) column = 'position';
                else if (text.includes('salary')) column = 'salary';
                else if (text.includes('payment')) column = 'payment';
                else if (text.includes('income')) column = 'projIncome';
                if (column) {
                    let direction = 'asc';
                    if (currentSort.employees.column === column && currentSort.employees.direction === 'asc') direction = 'desc';
                    sortEmployeesTable(column, direction);
                }
            };
            header.addEventListener('click', header._sortHandler);
        });
    }
}

// ========== ФИЛЬТРАЦИЯ (10 баллов) ==========
let activeFilters = { projects: {}, employees: {} };

function createFilterPopup(column, type, values, currentFilter) {
    const popup = document.createElement('div');
    popup.className = 'filter-popup';
    popup.style.cssText = 'position:fixed;background:white;border:1px solid #ddd;border-radius:12px;padding:16px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:1000;min-width:220px;';
    if (type === 'dropdown') {
        const select = document.createElement('select');
        select.style.cssText = 'width:100%;padding:8px;border-radius:6px;border:1px solid #ccc;';
        select.innerHTML = '<option value="">All</option>';
        values.forEach(val => { select.innerHTML += `<option value="${val}" ${currentFilter === val ? 'selected' : ''}>${val}</option>`; });
        popup.appendChild(select);
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display:flex;gap:10px;margin-top:15px;';
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = 'flex:1;padding:8px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;';
        applyBtn.onclick = () => { if (select.value) setFilter(column, select.value); else removeFilter(column); document.body.removeChild(popup); };
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'flex:1;padding:8px;background:#95a5a6;color:white;border:none;border-radius:6px;cursor:pointer;';
        cancelBtn.onclick = () => document.body.removeChild(popup);
        buttons.appendChild(applyBtn); buttons.appendChild(cancelBtn); popup.appendChild(buttons);
    } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Filter by ${column}...`;
        input.value = currentFilter || '';
        input.style.cssText = 'width:100%;padding:8px;border-radius:6px;border:1px solid #ccc;margin-bottom:12px;';
        popup.appendChild(input);
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display:flex;gap:10px;';
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = 'flex:1;padding:8px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;';
        applyBtn.onclick = () => { if (input.value.trim()) setFilter(column, input.value.trim()); else removeFilter(column); document.body.removeChild(popup); };
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'flex:1;padding:8px;background:#95a5a6;color:white;border:none;border-radius:6px;cursor:pointer;';
        cancelBtn.onclick = () => document.body.removeChild(popup);
        buttons.appendChild(applyBtn); buttons.appendChild(cancelBtn); popup.appendChild(buttons);
    }
    return popup;
}

function setFilter(column, value) {
    if (!activeFilters[currentActiveTab]) activeFilters[currentActiveTab] = {};
    activeFilters[currentActiveTab][column] = value;
    applyFilters();
    updateFilterChips();
}

function removeFilter(column) {
    if (activeFilters[currentActiveTab]) delete activeFilters[currentActiveTab][column];
    applyFilters();
    updateFilterChips();
}

function clearAllFilters() {
    activeFilters[currentActiveTab] = {};
    applyFilters();
    updateFilterChips();
}

function applyFilters() {
    const filters = activeFilters[currentActiveTab] || {};
    const tbody = document.querySelector(`#${currentActiveTab === 'projects' ? 'projectsTable' : 'employeesTable'} tbody`);
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');

    rows.forEach(row => {
        let show = true;

        if (currentActiveTab === 'projects') {
            if (filters.company) {
                const val = row.cells[0]?.textContent.toLowerCase() || '';
                if (!val.includes(filters.company.toLowerCase())) show = false;
            }
            if (filters.project) {
                const val = row.cells[1]?.textContent.toLowerCase() || '';
                if (!val.includes(filters.project.toLowerCase())) show = false;
            }
        } else {
            if (filters.name) {
                const val = row.cells[0]?.textContent.toLowerCase() || '';
                if (!val.includes(filters.name.toLowerCase())) show = false;
            }
            if (filters.surname) {
                const val = row.cells[1]?.textContent.toLowerCase() || '';
                if (!val.includes(filters.surname.toLowerCase())) show = false;
            }
            if (filters.position) {
                const val = row.cells[3]?.textContent.toLowerCase() || '';
                if (val !== filters.position.toLowerCase()) show = false;
            }
            if (filters.project) {
                const val = row.cells[6]?.textContent.toLowerCase() || '';
                if (!val.includes(filters.project.toLowerCase())) show = false;
            }
        }

        row.style.display = show ? '' : 'none';
    });
}

function updateFilterChips() {
    const filters = activeFilters[currentActiveTab] || {};
    const container = document.getElementById(`${currentActiveTab === 'projects' ? 'projectFilters' : 'employeeFilters'}`);
    if (!container) return;
    const filterKeys = Object.keys(filters);
    let html = '';
    filterKeys.forEach(key => {
        html += `<div class="filter-chip" data-filter="${key}" style="display:inline-flex;align-items:center;background:#e8e8e8;border-radius:20px;padding:6px 14px;margin-right:10px;margin-bottom:8px;gap:8px;font-size:13px;">
            ${key}: ${filters[key]}
            <span class="remove-filter" data-filter="${key}" style="cursor:pointer;color:#e74c3c;font-weight:bold;">×</span>
        </div>`;
    });
    if (filterKeys.length >= 2) {
        html += `<div class="clear-filters-btn" style="display:inline-flex;align-items:center;background:#e74c3c;color:white;border-radius:20px;padding:6px 14px;margin-bottom:8px;cursor:pointer;font-size:13px;">Clear All Filters</div>`;
    }
    container.innerHTML = html;
    document.querySelectorAll('.remove-filter').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); removeFilter(el.dataset.filter); }); });
    const clearBtn = container.querySelector('.clear-filters-btn');
    if (clearBtn) clearBtn.addEventListener('click', () => clearAllFilters());
}

function addFilterIcons() {
    const tables = [
        { id: '#projectsTable', cols: ['Company Name', 'Project Name'] },
        { id: '#employeesTable', cols: ['Name', 'Surname', 'Position', 'Project'] }
    ];
    tables.forEach(({ id, cols }) => {
        const table = document.querySelector(id);
        if (!table) return;
        const headers = table.querySelectorAll('thead th');
        headers.forEach(header => {
            const text = header.textContent.trim();
            if (cols.some(col => text.includes(col)) && !header.querySelector('.filter-icon')) {
                const filterSpan = document.createElement('span');
                filterSpan.className = 'filter-icon';
                filterSpan.textContent = '⌕';
                filterSpan.style.marginLeft = '10px';
                filterSpan.style.cursor = 'pointer';
                header.appendChild(filterSpan);
            }
        });
    });
}

function setupFilters() {
    const tables = ['projectsTable', 'employeesTable'];
    tables.forEach(tableId => {
        const table = document.getElementById(tableId);
        if (!table) return;
        const headers = table.querySelectorAll('thead th');
        headers.forEach(header => {
            const filterSpan = header.querySelector('.filter-icon');
            if (filterSpan) {
                filterSpan.removeEventListener('click', filterSpan._handler);
                filterSpan._handler = (e) => {
                    e.stopPropagation();
                    const headerText = header.textContent.trim().toLowerCase();
                    let column = '', filterType = 'text', dropdownValues = [];
                    if (tableId === 'projectsTable') {
                        if (headerText.includes('company')) column = 'company';
                        else if (headerText.includes('project')) column = 'project';
                    } else {
                        if (headerText.includes('name') && !headerText.includes('surname')) column = 'name';
                        else if (headerText.includes('surname')) column = 'surname';
                        else if (headerText.includes('position')) { column = 'position'; filterType = 'dropdown'; dropdownValues = ['Junior', 'Middle', 'Senior', 'Lead', 'Architect', 'BO']; }
                        else if (headerText.includes('project')) column = 'project';  // ДОБАВЛЕНО
                    }
                    if (column) {
                        const rect = filterSpan.getBoundingClientRect();
                        const currentFilter = activeFilters[currentActiveTab]?.[column] || '';
                        const popup = createFilterPopup(column, filterType, dropdownValues, currentFilter);
                        popup.style.left = `${rect.left}px`;
                        popup.style.top = `${rect.bottom + 5}px`;
                        document.body.appendChild(popup);
                        const closeHandler = (e) => { if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', closeHandler); } };
                        setTimeout(() => document.addEventListener('click', closeHandler), 100);
                    }
                };
                filterSpan.addEventListener('click', filterSpan._handler);
            }
        });
    });
}

// Обновляем рендер таблиц
const originalProjectsRender = renderProjectsTable;
const originalEmployeesRender = renderEmployeesTable;

window.renderProjectsTable = function() {
    originalProjectsRender();
    setTimeout(() => { addSortIcons(); setupSorting(); addFilterIcons(); setupFilters(); updateFilterChips(); }, 50);
};

window.renderEmployeesTable = function() {
    originalEmployeesRender();
    setTimeout(() => { addSortIcons(); setupSorting(); addFilterIcons(); setupFilters(); updateFilterChips(); }, 50);
};




document.addEventListener('DOMContentLoaded', init);