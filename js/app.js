
"use strict";

import { EventBus, ProjectService, TaskUtilities } from "./services.js";
import { UI } from "./ui.js";

class TaskFlowApp {
    constructor() {
        this.eventBus = new EventBus();
        this.service = new ProjectService(this.eventBus);
        this.ui = new UI();

        this.handleFilterChange = this.renderFilteredTasks.bind(this);

        this.eventBus.subscribe("data:loaded", () => {
            this.render();
        });

        this.eventBus.subscribe("task:created", () => {
            this.render();
            this.ui.showToast("Task created successfully.");
        });

        this.eventBus.subscribe("task:updated", () => {
            this.render();
            this.ui.showToast("Task updated successfully.");
        });

        this.eventBus.subscribe("task:deleted", () => {
            this.render();
            this.ui.showToast("Task deleted successfully.");
        });

        this.eventBus.subscribe("project:changed", () => {
            this.render();
            this.ui.showToast("Project created successfully.");
        });
    }

    init() {
        this.service.initialize();
        this.setupEventListeners();
        this.setCurrentDate();
        this.render();
    }

    setCurrentDate() {
        document.getElementById("todayLabel").textContent =
            new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric"
            });
    }

    render() {
        const data = this.service.getApplicationData();

        this.ui.renderAll(
            data,
            this.service.searchTasks(this.getFilters())
        );
    }

    getFilters() {
        return {
            search: document.getElementById("searchInput").value,
            status: document.getElementById("statusFilter").value,
            priority: document.getElementById("priorityFilter").value,
            projectId: document.getElementById("projectFilter").value,
            userId: document.getElementById("userFilter").value
        };
    }

    renderFilteredTasks() {
        const data = this.service.getApplicationData();

        const filteredTasks = this.service.searchTasks(this.getFilters());

        this.ui.renderTasks(filteredTasks, data.projects);
    }

    setupEventListeners() {
        document.getElementById("newTaskButton").addEventListener("click", () => {
            this.ui.openTaskModal(null, this.service.getApplicationData());
        });

        document.getElementById("taskForm").addEventListener("submit", event => {
            this.handleTaskSubmit(event);
        });

        document.getElementById("searchInput").addEventListener(
            "input",
            this.handleFilterChange
        );

        [
            "statusFilter",
            "priorityFilter",
            "projectFilter",
            "userFilter"
        ].forEach(id => {
            document.getElementById(id).addEventListener(
                "change",
                this.handleFilterChange
            );
        });

        document.getElementById("clearFiltersButton").addEventListener("click", () => {
            document.getElementById("searchInput").value = "";
            document.getElementById("statusFilter").value = "all";
            document.getElementById("priorityFilter").value = "all";
            document.getElementById("projectFilter").value = "all";
            document.getElementById("userFilter").value = "all";

            this.renderFilteredTasks();
        });

        document.getElementById("taskTableBody").addEventListener("click", event => {
            const button = event.target.closest("[data-action]");

            if (!button) return;

            this.handleTaskAction(button.dataset.action, button.dataset.id);
        });

        document.getElementById("projectNav").addEventListener("click", event => {
            const button = event.target.closest("[data-project]");

            if (button) {
                this.filterByProject(button.dataset.project);
            }
        });

        document.getElementById("projectCards").addEventListener("click", event => {
            const button = event.target.closest("[data-project]");

            if (button) {
                this.filterByProject(button.dataset.project);
            }
        });

        document.getElementById("addProjectButton").addEventListener("click", () => {
            this.createProject();
        });

        document.getElementById("taskDetails").addEventListener("click", event => {
            const button = event.target.closest("[data-detail-action]");

            if (!button) return;

            this.handleDetailAction(button.dataset.detailAction, button.dataset.id);
        });

        document.getElementById("taskDetails").addEventListener("submit", event => {
            if (event.target.id !== "commentForm") return;

            event.preventDefault();

            const input = document.getElementById("commentInput");
            const taskId = this.currentDetailTaskId;

            try {
                this.service.addComment(taskId, input.value);
                this.openTaskDetails(taskId);
                this.ui.showToast("Comment added successfully.");
            } catch (error) {
                this.ui.showToast(error.message);
            }
        });

        document.getElementById("detailModal").addEventListener("click", event => {
            if (event.target.matches("[data-close-detail]")) {
                this.ui.closeDetails();
            }
        });

        document.getElementById("taskModal").addEventListener("click", event => {
            if (event.target.matches("[data-close-modal]")) {
                this.ui.closeTaskModal();
            }
        });

        document.getElementById("mobileMenu").addEventListener("click", () => {
            document.getElementById("sidebar").classList.toggle("open");
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                this.ui.closeTaskModal();
                this.ui.closeDetails();
                document.getElementById("sidebar").classList.remove("open");
            }
        });
    }

    handleTaskSubmit(event) {
        event.preventDefault();

        const formData = {
            title: document.getElementById("taskTitle").value,
            description: document.getElementById("taskDescription").value,
            projectId: document.getElementById("taskProject").value,
            type: document.getElementById("taskType").value,
            priority: document.getElementById("taskPriority").value,
            status: document.getElementById("taskStatus").value,
            dueDate: document.getElementById("taskDueDate").value,
            estimatedHours: document.getElementById("taskHours").value,
            assigneeIds: [
                ...document.getElementById("taskAssignees").selectedOptions
            ].map(option => option.value)
        };

        try {
            if (this.ui.editingTaskId) {
                this.service.updateTask(this.ui.editingTaskId, formData);
            } else {
                this.service.addTask(formData);
            }

            this.ui.closeTaskModal();
            this.render();
        } catch (error) {
            this.ui.showToast(error.message);
        }
    }

    handleTaskAction(action, taskId) {
        const task = this.service.getTask(taskId);

        if (!task) {
            this.ui.showToast("Task not found.");
            return;
        }

        try {
            switch (action) {
                case "details":
                    this.openTaskDetails(taskId);
                    break;

                case "edit":
                    this.ui.openTaskModal(
                        task,
                        this.service.getApplicationData()
                    );
                    break;

                case "duplicate":
                    this.service.duplicateTask(taskId);
                    break;

                case "delete":
                    if (confirm(`Delete "${task.title}"?`)) {
                        this.service.deleteTask(taskId);
                    }
                    break;
            }
        } catch (error) {
            this.ui.showToast(error.message);
        }
    }

    currentDetailTaskId = null;

    openTaskDetails(taskId) {
        const task = this.service.getTask(taskId);

        if (!task) return;

        this.currentDetailTaskId = taskId;

        const project = this.service.getProject(task.projectId);

        this.ui.openDetails(task, project);

        this.demonstrateFunctionBinding(task);
    }

    handleDetailAction(action, taskId) {
        try {
            if (action === "complete") {
                this.service.completeTask(taskId);
                this.openTaskDetails(taskId);
            }

            if (action === "reopen") {
                this.service.reopenTask(taskId);
                this.openTaskDetails(taskId);
            }

            if (action === "duplicate") {
                this.service.duplicateTask(taskId);
                this.ui.closeDetails();
            }
        } catch (error) {
            this.ui.showToast(error.message);
        }
    }

    filterByProject(projectId) {
        document.getElementById("projectFilter").value = projectId;

        this.renderFilteredTasks();

        document.getElementById("tasks").scrollIntoView({
            behavior: "smooth"
        });

        document.getElementById("sidebar").classList.remove("open");
    }

    createProject() {
        const title = prompt("Enter project title:");

        if (!title?.trim()) return;

        const description = prompt("Enter project description:") || "";
        const dueDate = prompt("Enter project due date (YYYY-MM-DD):");

        if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            this.ui.showToast("Please enter a valid due date.");
            return;
        }

        try {
            this.service.addProject({
                title: title.trim(),
                description,
                dueDate,
                startDate: new Date().toISOString().slice(0, 10)
            });
        } catch (error) {
            this.ui.showToast(error.message);
        }
    }

    demonstrateFunctionBinding(task) {
        const tasks = this.service.tasks;

        const result = TaskUtilities.demonstrateBinding(task, tasks);

        console.log("Function binding demonstration:", result);
    }
}

const application = new TaskFlowApp();

application.init();
