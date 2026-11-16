
"use strict";

const escapeHTML = value => {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
};

const formatDate = date => {
    if (!date) return "No date";

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
};

const formatDateTime = date => {
    return new Date(date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
};

const statusLabel = status => ({
    "todo": "To Do",
    "in-progress": "In Progress",
    "completed": "Completed"
}[status] || status);

export class UI {
    constructor() {
        this.projectNav = document.getElementById("projectNav");
        this.projectCards = document.getElementById("projectCards");
        this.taskTableBody = document.getElementById("taskTableBody");
        this.activityList = document.getElementById("activityList");
        this.emptyState = document.getElementById("emptyState");

        this.totalTasks = document.getElementById("totalTasks");
        this.completedTasks = document.getElementById("completedTasks");
        this.pendingTasks = document.getElementById("pendingTasks");
        this.overdueTasks = document.getElementById("overdueTasks");
        this.totalHours = document.getElementById("totalHours");

        this.projectFilter = document.getElementById("projectFilter");
        this.userFilter = document.getElementById("userFilter");
        this.taskProject = document.getElementById("taskProject");
        this.taskAssignees = document.getElementById("taskAssignees");

        this.taskModal = document.getElementById("taskModal");
        this.detailModal = document.getElementById("detailModal");

        this.toast = document.getElementById("toast");

        this.taskDetails = document.getElementById("taskDetails");
        this.editingTaskId = null;
        this.lastFocusedElement = null;
    }

    renderAll(data, filteredTasks = data.tasks) {
        this.renderStats(data.tasks);
        this.renderProjectNavigation(data.projects);
        this.renderProjectCards(data.projects);
        this.renderTaskFilters(data);
        this.renderTasks(filteredTasks, data.projects);
        this.renderActivity(data.tasks);
    }

    renderStats(tasks) {
        const summary = tasks[0]?.constructor.calculateSummary(tasks) || {
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            overdueTasks: 0,
            totalHours: 0
        };

        this.totalTasks.textContent = summary.totalTasks;
        this.completedTasks.textContent = summary.completedTasks;
        this.pendingTasks.textContent = summary.pendingTasks;
        this.overdueTasks.textContent = summary.overdueTasks;
        this.totalHours.textContent = `${summary.totalHours} estimated hours`;
    }

    renderProjectNavigation(projects) {
        this.projectNav.innerHTML = projects.map(project => `
            <button class="project-nav-item" data-project="${escapeHTML(project.id)}">
                <span class="project-dot"></span>
                <span>${escapeHTML(project.title)}</span>
                <small>${project.tasks.length}</small>
            </button>
        `).join("");
    }

    renderProjectCards(projects) {
        if (!projects.length) {
            this.projectCards.innerHTML = `<p class="muted">No projects available.</p>`;
            return;
        }

        this.projectCards.innerHTML = projects.map(project => {
            const summary = project.getSummary();

            const progress = summary.totalTasks
                ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
                : 0;

            return `
                <article class="project-card">
                    <div class="project-card-top">
                        <span class="project-icon">▦</span>
                        <span class="project-status">${escapeHTML(project.status)}</span>
                    </div>

                    <h3>${escapeHTML(project.title)}</h3>
                    <p>${escapeHTML(project.description)}</p>

                    <div class="project-progress-info">
                        <span>Progress</span>
                        <strong>${progress}%</strong>
                    </div>

                    <div class="progress-track">
                        <div class="progress-fill" style="width:${progress}%"></div>
                    </div>

                    <div class="project-card-bottom">
                        <span>${summary.completedTasks}/${summary.totalTasks} tasks</span>
                        <span>${summary.totalHours} hours</span>
                    </div>

                    <div class="project-members">
                        ${project.members.map(user => `
                            <span class="avatar avatar-${escapeHTML(user.color)}"
                                title="${escapeHTML(user.name)}">
                                ${escapeHTML(user.initials)}
                            </span>
                        `).join("")}
                    </div>

                    <button class="project-open-button" data-project="${escapeHTML(project.id)}">
                        View project →
                    </button>
                </article>
            `;
        }).join("");
    }

    renderTaskFilters(data) {
        const selectedProject = this.projectFilter.value || "all";
        const selectedUser = this.userFilter.value || "all";

        this.projectFilter.innerHTML = `
            <option value="all">All Projects</option>
            ${data.projects.map(project => `
                <option value="${escapeHTML(project.id)}">
                    ${escapeHTML(project.title)}
                </option>
            `).join("")}
        `;

        this.userFilter.innerHTML = `
            <option value="all">All Members</option>
            ${data.users.map(user => `
                <option value="${escapeHTML(user.id)}">
                    ${escapeHTML(user.name)}
                </option>
            `).join("")}
        `;

        this.projectFilter.value = data.projects.some(project => project.id === selectedProject)
            ? selectedProject
            : "all";

        this.userFilter.value = data.users.some(user => user.id === selectedUser)
            ? selectedUser
            : "all";

        const currentTaskProject = document.getElementById("taskProject").value;

        this.taskProject.innerHTML = data.projects.map(project => `
            <option value="${escapeHTML(project.id)}">
                ${escapeHTML(project.title)}
            </option>
        `).join("");

        if (data.projects.some(project => project.id === currentTaskProject)) {
            this.taskProject.value = currentTaskProject;
        }

        this.taskAssignees.innerHTML = data.users.map(user => `
            <option value="${escapeHTML(user.id)}">
                ${escapeHTML(user.name)} — ${escapeHTML(user.role)}
            </option>
        `).join("");
    }

    renderTasks(tasks, projects) {
        this.emptyState.classList.toggle("hidden", tasks.length > 0);

        if (!tasks.length) {
            this.taskTableBody.innerHTML = "";
            return;
        }

        const projectMap = new Map(
            projects.map(project => [project.id, project.title])
        );

        this.taskTableBody.innerHTML = tasks.map(task => `
            <tr>
                <td>
                    <button class="task-title-button" data-action="details" data-id="${escapeHTML(task.id)}">
                        ${escapeHTML(task.title)}
                    </button>
                    <span class="task-type">${escapeHTML(task.type)}</span>
                </td>

                <td>${escapeHTML(projectMap.get(task.projectId) || "Unknown")}</td>

                <td>
                    <span class="priority priority-${escapeHTML(task.priority)}">
                        ${escapeHTML(task.priority)}
                    </span>
                </td>

                <td>
                    <span class="status status-${escapeHTML(task.status)}">
                        ${escapeHTML(statusLabel(task.status))}
                    </span>
                </td>

                <td class="${task.isOverdue ? "overdue-date" : ""}">
                    ${formatDate(task.dueDate)}
                </td>

                <td>
                    <div class="table-avatars">
                        ${task.assignees.map(user => `
                            <span class="avatar avatar-${escapeHTML(user.color)}"
                                title="${escapeHTML(user.name)}">
                                ${escapeHTML(user.initials)}
                            </span>
                        `).join("")}
                        ${task.assignees.length === 0 ? '<span class="unassigned">Unassigned</span>' : ""}
                    </div>
                </td>

                <td>
                    <div class="table-actions">
                        <button data-action="edit" data-id="${escapeHTML(task.id)}" title="Edit">✎</button>
                        <button data-action="duplicate" data-id="${escapeHTML(task.id)}" title="Duplicate">⧉</button>
                        <button data-action="delete" data-id="${escapeHTML(task.id)}" title="Delete">×</button>
                    </div>
                </td>
            </tr>
        `).join("");
    }

    renderActivity(tasks) {
        const activities = tasks
            .flatMap(task => task.activityLog.map(activity => ({
                ...activity,
                taskTitle: task.title
            })))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 6);

        if (!activities.length) {
            this.activityList.innerHTML = `<p class="muted">No recent activity.</p>`;
            return;
        }

        this.activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <span class="activity-dot"></span>
                <div>
                    <p>${escapeHTML(activity.description)}</p>
                    <span>${escapeHTML(activity.user)} · ${formatDateTime(activity.createdAt)}</span>
                </div>
            </div>
        `).join("");
    }

    openTaskModal(task = null, data = null) {
        this.lastFocusedElement = document.activeElement;

        const form = document.getElementById("taskForm");
        form.reset();

        this.editingTaskId = task?.id || null;
        document.getElementById("taskType").disabled = Boolean(task);

        document.getElementById("taskModalTitle").textContent =
            task ? "Edit Task" : "Create New Task";

        document.getElementById("saveTaskButton").textContent =
            task ? "Save Changes" : "Create Task";

        if (data) {
            this.renderTaskFilters(data);
        }

        if (task) {
            document.getElementById("taskId").value = task.id;
            document.getElementById("taskTitle").value = task.title;
            document.getElementById("taskDescription").value = task.description;
            document.getElementById("taskProject").value = task.projectId;
            document.getElementById("taskType").value = task.type;
            document.getElementById("taskPriority").value = task.priority;
            document.getElementById("taskStatus").value = task.status;
            document.getElementById("taskDueDate").value = task.dueDate;
            document.getElementById("taskHours").value = task.estimatedHours;

            const assignedIds = task.assignees.map(user => user.id);

            [...this.taskAssignees.options].forEach(option => {
                option.selected = assignedIds.includes(option.value);
            });
        } else {
            document.getElementById("taskId").value = "";
            document.getElementById("taskType").disabled = false;
        }

        this.taskModal.classList.add("open");
        this.taskModal.setAttribute("aria-hidden", "false");

        document.getElementById("taskTitle").focus();
    }

    closeTaskModal() {
        this.taskModal.classList.remove("open");
        this.taskModal.setAttribute("aria-hidden", "true");
        this.lastFocusedElement?.focus();
    }

    openDetails(task, project) {
        this.lastFocusedElement = document.activeElement;

        document.getElementById("detailTitle").textContent = task.title;

        this.taskDetails.innerHTML = `
            <div class="detail-meta">
                <span class="priority priority-${escapeHTML(task.priority)}">${escapeHTML(task.priority)}</span>
                <span class="status status-${escapeHTML(task.status)}">${escapeHTML(statusLabel(task.status))}</span>
            </div>

            <p class="detail-description">${escapeHTML(task.description || "No description provided.")}</p>

            <div class="detail-grid">
                <div><span>Project</span><strong>${escapeHTML(project?.title || "Unknown")}</strong></div>
                <div><span>Task type</span><strong>${escapeHTML(task.type)}</strong></div>
                <div><span>Due date</span><strong>${formatDate(task.dueDate)}</strong></div>
                <div><span>Estimated hours</span><strong>${task.estimatedHours} hours</strong></div>
                <div><span>Overdue</span><strong>${task.isOverdue ? "Yes" : "No"}</strong></div>
                <div><span>Comments</span><strong>${task.comments.length}</strong></div>
            </div>

            <div class="detail-section">
                <h3>Assigned Members</h3>
                <div class="detail-members">
                    ${task.assignees.length ? task.assignees.map(user => `
                        <div class="detail-member">
                            <span class="avatar avatar-${escapeHTML(user.color)}">${escapeHTML(user.initials)}</span>
                            <span>${escapeHTML(user.name)}</span>
                        </div>
                    `).join("") : "<p>No members assigned.</p>"}
                </div>
            </div>

            <div class="detail-section">
                <h3>Comments</h3>
                <div class="comment-list">
                    ${task.comments.length ? task.comments.map(comment => `
                        <div class="comment">
                            <strong>${escapeHTML(comment.user)}</strong>
                            <p>${escapeHTML(comment.text)}</p>
                            <small>${formatDateTime(comment.createdAt)}</small>
                        </div>
                    `).join("") : "<p>No comments yet.</p>"}
                </div>

                <form id="commentForm" class="comment-form">
                    <input type="text" id="commentInput" placeholder="Write a comment..." required>
                    <button class="button button-primary" type="submit">Add</button>
                </form>
            </div>

            <div class="detail-actions">
                ${task.status === "completed"
                    ? `<button class="button button-outline" data-detail-action="reopen" data-id="${escapeHTML(task.id)}">Reopen Task</button>`
                    : `<button class="button button-primary" data-detail-action="complete" data-id="${escapeHTML(task.id)}">Complete Task</button>`
                }
                <button class="button button-outline" data-detail-action="duplicate" data-id="${escapeHTML(task.id)}">Duplicate</button>
            </div>
        `;

        this.detailModal.classList.add("open");
        this.detailModal.setAttribute("aria-hidden", "false");

        this.detailModal.querySelector(".icon-button").focus();
    }

    closeDetails() {
        this.detailModal.classList.remove("open");
        this.detailModal.setAttribute("aria-hidden", "true");
        this.lastFocusedElement?.focus();
    }

    showToast(message) {
        this.toast.textContent = message;
        this.toast.classList.add("show");

        clearTimeout(this.toastTimeout);

        this.toastTimeout = setTimeout(() => {
            this.toast.classList.remove("show");
        }, 2800);
    }
}
